const bcrypt = require("bcryptjs");
const usuarioRepository = require("../repositories/usuarioRepository");
const historicoRepository = require("../repositories/historicoRepository");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERFIS = ["ADMIN", "COLABORADOR"];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function transacao(pool, fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function listar(pool) {
  return usuarioRepository.listar(pool);
}

async function criar(pool, autor, dados) {
  const nome = String(dados.nome || "").trim();
  const email = String(dados.email || "").trim().toLowerCase();
  const senha = String(dados.senha || "");
  const perfil = dados.perfil;
  if (!nome || !EMAIL_REGEX.test(email) || senha.length < 8 || !PERFIS.includes(perfil)) {
    throw new HttpError(400, "Informe nome, e-mail válido, senha com 8 ou mais caracteres e perfil válido.");
  }
  const senhaHash = await bcrypt.hash(senha, 10);
  try {
    return await transacao(pool, async (conn) => {
      if (await usuarioRepository.emailExiste(conn, email)) throw new HttpError(409, "E-mail já cadastrado.");
      const id = await usuarioRepository.inserir(conn, { nome, email, senhaHash, perfil });
      const idPessoa = await usuarioRepository.pessoaUnica(conn);
      if (idPessoa) await usuarioRepository.vincularPessoa(conn, id, idPessoa, perfil === "ADMIN");
      await historicoRepository.registrar(conn, { idUsuario: autor.id, acao: "USUARIO_CRIADO", idRegistro: id, detalhes: `Usuário ${email} criado` });
      return usuarioRepository.buscarPorId(conn, id);
    });
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") throw new HttpError(409, "E-mail já cadastrado.");
    throw error;
  }
}

async function editar(pool, autor, id, dados) {
  const nome = String(dados.nome || "").trim();
  const perfil = dados.perfil;
  if (!nome || !PERFIS.includes(perfil) || typeof dados.pode_registrar_administracao !== "boolean") {
    throw new HttpError(400, "Informe nome, perfil válido e a permissão de registrar administração.");
  }
  return transacao(pool, async (conn) => {
    const alvo = await usuarioRepository.buscarPorIdParaAtualizar(conn, id);
    if (!alvo) throw new HttpError(404, "Usuário não encontrado.");
    if (alvo.perfil === "ADMIN" && alvo.status === "ATIVO" && perfil !== "ADMIN") {
      const admins = await usuarioRepository.contarAdminsAtivosParaAtualizar(conn);
      if (admins <= 1) throw new HttpError(409, "A família precisa ter ao menos um administrador ativo.");
    }
    await usuarioRepository.atualizar(conn, id, { nome, perfil });
    await usuarioRepository.atualizarPermissao(conn, id, dados.pode_registrar_administracao);
    await historicoRepository.registrar(conn, { idUsuario: autor.id, acao: "USUARIO_ALTERADO", idRegistro: id, detalhes: "Usuário alterado" });
    return usuarioRepository.buscarPorId(conn, id);
  });
}

async function alterarStatus(pool, autor, id, status) {
  if (status !== "ATIVO" && status !== "INATIVO") throw new HttpError(400, "Status deve ser ATIVO ou INATIVO.");
  if (status === "INATIVO" && Number(autor.id) === id) throw new HttpError(400, "Você não pode desativar a si mesmo.");
  return transacao(pool, async (conn) => {
    const alvo = await usuarioRepository.buscarPorIdParaAtualizar(conn, id);
    if (!alvo) throw new HttpError(404, "Usuário não encontrado.");
    if (status === "INATIVO" && alvo.perfil === "ADMIN" && alvo.status === "ATIVO") {
      const admins = await usuarioRepository.contarAdminsAtivosParaAtualizar(conn);
      if (admins <= 1) throw new HttpError(409, "A família precisa ter ao menos um administrador ativo.");
    }
    await usuarioRepository.atualizarStatus(conn, id, status);
    await historicoRepository.registrar(conn, {
      idUsuario: autor.id,
      acao: status === "INATIVO" ? "USUARIO_DESATIVADO" : "USUARIO_REATIVADO",
      idRegistro: id,
      detalhes: status === "INATIVO" ? "Usuário desativado" : "Usuário reativado"
    });
    return usuarioRepository.buscarPorId(conn, id);
  });
}

module.exports = { listar, criar, editar, alterarStatus, HttpError };
