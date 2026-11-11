const { withTransaction } = require("../db");
const pessoaRepository = require("../repositories/pessoaRepository");
const historicoRepository = require("../repositories/historicoRepository");

const ENTIDADE = "PESSOA_ASSISTIDA";

function erro(status, mensagem, extra = {}) {
  return { status, body: { error: mensagem, ...extra } };
}

function hojeISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function validarDados(dados) {
  const nome = String((dados && dados.nome) || "").trim();
  if (!nome) return { erro: "Informe o nome da pessoa." };
  if (nome.length > 120) return { erro: "O nome deve ter no máximo 120 caracteres." };

  const nascimento = String((dados && dados.data_nascimento) || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return { erro: "Informe a data de nascimento no formato AAAA-MM-DD." };
  const data = new Date(`${nascimento}T00:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== nascimento) {
    return { erro: "Data de nascimento inválida." };
  }
  if (nascimento > hojeISO()) return { erro: "A data de nascimento não pode estar no futuro." };
  return { nome, nascimento };
}

async function listar(db, usuario) {
  const pessoas = await pessoaRepository.listarAtivasDoUsuario(db, usuario.id);
  return { status: 200, body: { pessoas } };
}

async function criar(db, usuario, dados) {
  const valido = validarDados(dados);
  if (valido.erro) return erro(400, valido.erro);
  if (!dados || dados.consentimento !== true) return erro(400, "O consentimento é obrigatório.");

  const pessoa = await withTransaction(db, async (conn) => {
    const idPessoa = await pessoaRepository.inserir(conn, valido.nome, valido.nascimento);
    const usuarios = await pessoaRepository.listarUsuariosAtivos(conn);
    for (const u of usuarios) {
      await pessoaRepository.vincular(conn, u.id_usuario, idPessoa, u.perfil === "ADMIN");
    }
    await historicoRepository.registrar(conn, usuario.id, "PESSOA_CRIADA", ENTIDADE, idPessoa);
    return pessoaRepository.buscarDoUsuario(conn, idPessoa, usuario.id);
  });
  return { status: 201, body: { pessoa } };
}

async function editar(db, usuario, idPessoa, dados) {
  const valido = validarDados(dados);
  if (valido.erro) return erro(400, valido.erro);

  const pessoa = await withTransaction(db, async (conn) => {
    await pessoaRepository.atualizar(conn, idPessoa, usuario.id, valido.nome, valido.nascimento);
    await historicoRepository.registrar(conn, usuario.id, "PESSOA_ALTERADA", ENTIDADE, idPessoa);
    return pessoaRepository.buscarDoUsuario(conn, idPessoa, usuario.id);
  });
  return { status: 200, body: { pessoa } };
}

async function alterarStatus(db, usuario, idPessoa, dados) {
  const status = dados && dados.status;
  if (status !== "ATIVO" && status !== "INATIVO") return erro(400, "Status inválido.");
  const confirmar = dados.confirmar === true;

  return withTransaction(db, async (conn) => {
    const atual = await pessoaRepository.buscarDoUsuario(conn, idPessoa, usuario.id);
    if (!atual) return erro(404, "Pessoa não encontrada.");
    if (atual.status === status) return { status: 200, body: { pessoa: atual } };

    if (status === "INATIVO" && !confirmar) {
      const pendentes = await pessoaRepository.contarPendentes(conn, idPessoa, usuario.id);
      if (pendentes > 0) {
        return erro(409, `Há ${pendentes} atividade(s) pendente(s). Confirme para desativar.`, { pendentes });
      }
    }

    await pessoaRepository.atualizarStatus(conn, idPessoa, usuario.id, status);
    const acao = status === "INATIVO" ? "PESSOA_DESATIVADA" : "PESSOA_REATIVADA";
    await historicoRepository.registrar(conn, usuario.id, acao, ENTIDADE, idPessoa);
    const pessoa = await pessoaRepository.buscarDoUsuario(conn, idPessoa, usuario.id);
    return { status: 200, body: { pessoa } };
  });
}

module.exports = { listar, criar, editar, alterarStatus, validarDados };
