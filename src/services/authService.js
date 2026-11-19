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

const PERFIS_CADASTRO = ["ADMIN", "PESSOA_ASSISTIDA", "COLABORADOR"];

async function cadastrar(db, { nome: nomeBruto, email: emailBruto, senha: senhaBruta, perfil: perfilBruto }) {
  const perfil = String(perfilBruto || "COLABORADOR");
  if (!PERFIS_CADASTRO.includes(perfil)) return { status: 400, body: { error: "Perfil inválido." } };
  const nome = String(nomeBruto || "").trim();
  const email = String(emailBruto || "").trim().toLowerCase();
  const senha = String(senhaBruta || "");
  if (!nome || !email || !senha) return { status: 400, body: { error: "Informe nome, e-mail e senha." } };
  if (nome.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 400, body: { error: "Dados inválidos." } };
  if (senha.length < 8) return { status: 400, body: { error: "A senha deve ter ao menos 8 caracteres." } };
  if (await usuarioRepository.emailExiste(db, email)) return { status: 409, body: { error: "E-mail já cadastrado." } };

  if (perfil === "ADMIN" && (await usuarioRepository.existeAdmin(db))) {
    return { status: 403, body: { error: "Já existe um administrador. Peça a ele para criar seu acesso como administrador." } };
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const id = await usuarioRepository.inserir(db, { nome, email, senhaHash, perfil });
  // Sem vínculo automático: o administrador vincula o usuário à pessoa assistida.
  const sessionUser = { id, nome, email, perfil };
  return { status: 201, body: { user: sessionUser }, sessionUser };
}

module.exports = { login, cadastrar, MAX_FALHAS, BLOQUEIO_MINUTOS };
