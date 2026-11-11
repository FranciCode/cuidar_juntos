const bcrypt = require("bcryptjs");
const usuarioRepository = require("../repositories/usuarioRepository");

const MAX_FALHAS = 5;
const BLOQUEIO_MINUTOS = 15;
const MSG_GENERICA = "E-mail ou senha inválidos.";

async function login(db, emailBruto, senhaBruta) {
  const email = String(emailBruto || "").trim().toLowerCase();
  const senha = String(senhaBruta || "");
  if (!email || !senha) return { status: 400, body: { error: "Informe e-mail e senha." } };

  const user = await usuarioRepository.buscarPorEmail(db, email);
  if (!user) return { status: 401, body: { error: MSG_GENERICA } };

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

module.exports = { login, MAX_FALHAS, BLOQUEIO_MINUTOS };
