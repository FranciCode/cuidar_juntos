const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const usuarioRepository = require("../repositories/usuarioRepository");
const conviteRepository = require("../repositories/conviteRepository");
const redefinicaoRepository = require("../repositories/redefinicaoSenhaRepository");
const historicoRepository = require("../repositories/historicoRepository");

const MAX_FALHAS = 5;
const BLOQUEIO_MINUTOS = 15;
const MSG_GENERICA = "E-mail ou senha inválidos.";
const MSG_CONVITE = "Convite inválido ou expirado.";
const LOCK_PRIMEIRO_ADMIN = "cuidar_primeiro_admin";
const HASH_FICTICIO = bcrypt.hashSync("senha-ficticia", 10);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

async function login(db, emailBruto, senhaBruta) {
  const email = String(emailBruto || "").trim().toLowerCase();
  const senha = String(senhaBruta || "");
  if (!email || !senha) return { status: 400, body: { error: "Informe e-mail e senha." } };

  const user = await usuarioRepository.buscarPorEmail(db, email);
  if (!user) {
    await bcrypt.compare(senha, HASH_FICTICIO);
    return { status: 401, body: { error: MSG_GENERICA } };
  }

  if (user.bloqueado_ate && new Date(user.bloqueado_ate) > new Date()) {
    return { status: 429, body: { error: "Muitas tentativas inválidas. Tente novamente em alguns minutos." } };
  }

  if (!(await bcrypt.compare(senha, user.senha_hash))) {
    const falhas = Number(user.tentativas_falhas || 0) + 1;
    const bloqueio = falhas >= MAX_FALHAS ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60000) : null;
    await usuarioRepository.registrarFalha(db, user.id_usuario, bloqueio ? 0 : falhas, bloqueio);
    return { status: 401, body: { error: MSG_GENERICA } };
  }

  if (user.status !== "ATIVO") return { status: 403, body: { error: "não autorizado" } };

  await usuarioRepository.zerarFalhas(db, user.id_usuario);
  const sessionUser = { id: user.id_usuario, nome: user.nome, email: user.email, perfil: user.perfil };
  return { status: 200, body: { user: sessionUser }, sessionUser };
}

// Uma única conexão dedicada: trava, transação e liberação da trava (no finally).
async function executarTransacao(pool, fn, { lock = null } = {}) {
  const conn = await pool.getConnection();
  let travou = false;
  try {
    if (lock) {
      const [rows] = await conn.query("SELECT GET_LOCK(?, 5) AS ok", [lock]);
      if (Number(rows && rows[0] && rows[0].ok) !== 1) {
        return { status: 503, body: { error: "Serviço ocupado. Tente novamente." } };
      }
      travou = true;
    }
    await conn.beginTransaction();
    try {
      const resultado = await fn(conn);
      if (resultado.status >= 400) await conn.rollback();
      else await conn.commit();
      return resultado;
    } catch (error) {
      await conn.rollback();
      throw error;
    }
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") return { status: 409, body: { error: "E-mail já cadastrado." } };
    throw error;
  } finally {
    if (travou) {
      try { await conn.query("SELECT RELEASE_LOCK(?)", [lock]); } catch (_e) { /* não mascara o erro original */ }
    }
    conn.release();
  }
}

async function vincularAPessoa(conn, idUsuario, idPessoa, pode) {
  const pessoa = idPessoa || (await usuarioRepository.pessoaUnica(conn));
  if (pessoa) await usuarioRepository.vincularPessoa(conn, idUsuario, pessoa, pode);
}

async function cadastrarPrimeiroAdmin(pool, { nome, email, senhaHash }) {
  return executarTransacao(pool, async (conn) => {
    if (await usuarioRepository.existeAdmin(conn)) {
      return { status: 403, body: { error: "O cadastro depende de um convite válido." } };
    }
    if (await usuarioRepository.emailExiste(conn, email)) {
      return { status: 409, body: { error: "E-mail já cadastrado." } };
    }
    const id = await usuarioRepository.inserir(conn, { nome, email, senhaHash, perfil: "ADMIN" });
    await vincularAPessoa(conn, id, null, true);
    const sessionUser = { id, nome, email, perfil: "ADMIN" };
    return { status: 201, body: { user: sessionUser }, sessionUser };
  }, { lock: LOCK_PRIMEIRO_ADMIN });
}

async function cadastrarPorConvite(pool, { token, nome, email, senha }) {
  const invalido = { status: 400, body: { error: MSG_CONVITE } };
  return executarTransacao(pool, async (conn) => {
    const agora = new Date();
    const convite = await conviteRepository.buscarPorHashParaAtualizar(conn, hashToken(token));
    if (!convite || convite.usado_em || new Date(convite.expira_em) <= agora) return invalido;
    const emailConvite = String(convite.email).toLowerCase();
    if (email !== emailConvite) return invalido;

    const existente = await usuarioRepository.buscarPorEmail(conn, emailConvite);
    if (existente) {
      if (existente.status !== "ATIVO") return invalido;
      if (existente.bloqueado_ate && new Date(existente.bloqueado_ate) > agora) return invalido;
      if (!(await bcrypt.compare(senha, existente.senha_hash))) {
        const falhas = Number(existente.tentativas_falhas || 0) + 1;
        const bloqueio = falhas >= MAX_FALHAS ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60000) : null;
        await usuarioRepository.registrarFalha(conn, existente.id_usuario, bloqueio ? 0 : falhas, bloqueio);
        await conn.commit();
        await conn.beginTransaction();
        return invalido;
      }
      if (!(await conviteRepository.consumir(conn, convite.id_convite, existente.id_usuario, agora))) return invalido;
      await vincularAPessoa(conn, existente.id_usuario, convite.id_pessoa, false);
      await usuarioRepository.zerarFalhas(conn, existente.id_usuario);
      const sessionUser = { id: existente.id_usuario, nome: existente.nome, email: existente.email, perfil: existente.perfil };
      return { status: 200, body: { user: sessionUser }, sessionUser };
    }

    if (!nome) return { status: 400, body: { error: "Informe nome, e-mail e senha." } };
    const senhaHash = await bcrypt.hash(senha, 10);
    const id = await usuarioRepository.inserir(conn, { nome, email: emailConvite, senhaHash, perfil: convite.perfil });
    if (!(await conviteRepository.consumir(conn, convite.id_convite, id, agora))) return invalido;
    await vincularAPessoa(conn, id, convite.id_pessoa, convite.perfil === "ADMIN");
    const sessionUser = { id, nome, email: emailConvite, perfil: convite.perfil };
    return { status: 201, body: { user: sessionUser }, sessionUser };
  });
}

async function cadastrar(pool, { nome: nomeBruto, email: emailBruto, senha: senhaBruta, convite: conviteBruto } = {}) {
  const nome = String(nomeBruto || "").trim();
  const email = String(emailBruto || "").trim().toLowerCase();
  const senha = String(senhaBruta || "");
  const token = typeof conviteBruto === "string" ? conviteBruto.trim() : "";
  if (!email || !senha) return { status: 400, body: { error: "Informe nome, e-mail e senha." } };
  if (nome.length > 120 || !EMAIL_RE.test(email)) return { status: 400, body: { error: "Dados inválidos." } };
  if (senha.length < 8) return { status: 400, body: { error: "A senha deve ter ao menos 8 caracteres." } };

  if (token) return cadastrarPorConvite(pool, { token, nome, email, senha });

  if (!nome) return { status: 400, body: { error: "Informe nome, e-mail e senha." } };
  const senhaHash = await bcrypt.hash(senha, 10);
  return cadastrarPrimeiroAdmin(pool, { nome, email, senhaHash });
}

async function redefinirSenha(pool, { token: tokenBruto, senha: senhaBruta } = {}) {
  const token = typeof tokenBruto === "string" ? tokenBruto.trim() : "";
  const senha = String(senhaBruta || "");
  const invalido = { status: 400, body: { error: "Link inválido ou expirado." } };
  if (!token) return invalido;
  if (senha.length < 8) return { status: 400, body: { error: "A senha deve ter ao menos 8 caracteres." } };
  const senhaHash = await bcrypt.hash(senha, 10);
  return executarTransacao(pool, async (conn) => {
    const agora = new Date();
    const redef = await redefinicaoRepository.buscarPorHashParaAtualizar(conn, hashToken(token));
    if (!redef || redef.usado_em || new Date(redef.expira_em) <= agora) return invalido;
    const user = await usuarioRepository.buscarPorId(conn, redef.id_usuario);
    if (!user || user.status !== "ATIVO") return invalido;
    if (!(await redefinicaoRepository.consumir(conn, redef.id_redefinicao, agora))) return invalido;
    await usuarioRepository.atualizarSenha(conn, user.id_usuario, senhaHash);
    await historicoRepository.registrar(conn, { idUsuario: user.id_usuario, acao: "SENHA_REDEFINIDA", idRegistro: user.id_usuario, detalhes: "Senha redefinida pelo próprio usuário" });
    return { status: 200, body: { ok: true } };
  });
}

module.exports = { login, cadastrar, redefinirSenha, hashToken, MAX_FALHAS, BLOQUEIO_MINUTOS };
