const bcrypt = require("bcryptjs");
const { withTransaction } = require("../db");
const usuarioRepository = require("../repositories/usuarioRepository");
const historicoRepository = require("../repositories/historicoRepository");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERFIS = ["ADMIN", "COLABORADOR"];

function erro(status, mensagem) {
  return { status, body: { error: mensagem } };
}

async function listar(db) {
  return { status: 200, body: { usuarios: await usuarioRepository.listar(db) } };
}

async function criar(db, autor, dados) {
  const nome = String((dados && dados.nome) || "").trim();
  const email = String((dados && dados.email) || "").trim().toLowerCase();
  const senha = String((dados && dados.senha) || "");
  const perfil = dados && dados.perfil;
  if (!nome) return erro(400, "Informe o nome.");
  if (!EMAIL_REGEX.test(email)) return erro(400, "E-mail inválido.");
  if (senha.length < 8) return erro(400, "A senha deve ter pelo menos 8 caracteres.");
  if (!PERFIS.includes(perfil)) return erro(400, "Perfil inválido.");

  const hash = await bcrypt.hash(senha, 10);
  try {
    const usuario = await withTransaction(db, async (conn) => {
      if (await usuarioRepository.buscarPorEmail(conn, email)) {
        const e = new Error("duplicado");
        e.duplicado = true;
        throw e;
      }
      const id = await usuarioRepository.inserir(conn, nome, email, hash, perfil);
      await usuarioRepository.vincularPessoaExistente(conn, id, perfil === "ADMIN");
      await historicoRepository.registrar(conn, autor.id, "USUARIO_CRIADO", "USUARIO", id);
      return usuarioRepository.buscarPorId(conn, id);
    });
    return { status: 201, body: { usuario } };
  } catch (error) {
    if (error.duplicado || error.code === "ER_DUP_ENTRY") return erro(409, "E-mail já cadastrado.");
    throw error;
  }
}

async function editar(db, autor, id, dados) {
  const nome = String((dados && dados.nome) || "").trim();
  const perfil = dados && dados.perfil;
  if (!nome) return erro(400, "Informe o nome.");
  if (!PERFIS.includes(perfil)) return erro(400, "Perfil inválido.");
  const pode = dados.pode_registrar_administracao === true;

  return withTransaction(db, async (conn) => {
    const alvo = await usuarioRepository.buscarPorId(conn, id, true);
    if (!alvo) return erro(404, "Usuário não encontrado.");
    if (alvo.perfil === "ADMIN" && alvo.status === "ATIVO" && perfil !== "ADMIN") {
      if ((await usuarioRepository.contarAdminsAtivos(conn)) <= 1) {
        return erro(409, "A família precisa ter pelo menos um administrador ativo.");
      }
    }
    await usuarioRepository.atualizar(conn, id, nome, perfil);
    await usuarioRepository.atualizarPermissao(conn, id, pode);
    await historicoRepository.registrar(conn, autor.id, "USUARIO_ALTERADO", "USUARIO", id);
    return { status: 200, body: { usuario: await usuarioRepository.buscarPorId(conn, id) } };
  });
}

async function alterarStatus(db, autor, id, dados) {
  const status = dados && dados.status;
  if (status !== "ATIVO" && status !== "INATIVO") return erro(400, "Status inválido.");
  if (status === "INATIVO" && Number(id) === autor.id) return erro(400, "Você não pode desativar a si mesmo.");

  return withTransaction(db, async (conn) => {
    const alvo = await usuarioRepository.buscarPorId(conn, id, true);
    if (!alvo) return erro(404, "Usuário não encontrado.");
    if (status === "INATIVO" && alvo.perfil === "ADMIN" && alvo.status === "ATIVO") {
      if ((await usuarioRepository.contarAdminsAtivos(conn)) <= 1) {
        return erro(409, "A família precisa ter pelo menos um administrador ativo.");
      }
    }
    await usuarioRepository.atualizarStatus(conn, id, status);
    const acao = status === "INATIVO" ? "USUARIO_DESATIVADO" : "USUARIO_REATIVADO";
    await historicoRepository.registrar(conn, autor.id, acao, "USUARIO", id);
    return { status: 200, body: { usuario: await usuarioRepository.buscarPorId(conn, id) } };
  });
}

module.exports = { listar, criar, editar, alterarStatus };
