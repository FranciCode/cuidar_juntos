const { withTransaction } = require("../db");
const medicamentoRepository = require("../repositories/medicamentoRepository");
const usuarioRepository = require("../repositories/usuarioRepository");
const historicoRepository = require("../repositories/historicoRepository");

const ENTIDADE_MEDICAMENTO = "MEDICAMENTO";
const ENTIDADE_ADMINISTRACAO = "ADMINISTRACAO";

function falha(status, mensagem) {
  const e = new Error(mensagem);
  e.resposta = { status, body: { error: mensagem } };
  throw e;
}

async function executar(db, fn) {
  try {
    return await withTransaction(db, fn);
  } catch (e) {
    if (e && e.resposta) return e.resposta;
    throw e;
  }
}

function validarMedicamento(dados) {
  const nome = String((dados && dados.nome) || "").trim();
  if (!nome) return { erro: "Informe o nome do medicamento." };
  if (nome.length > 150) return { erro: "O nome deve ter no máximo 150 caracteres." };
  const instrucao = String((dados && dados.instrucao_cadastrada) || "").trim();
  if (!instrucao) return { erro: "Informe a instrução profissional." };
  if (instrucao.length > 500) return { erro: "A instrução deve ter no máximo 500 caracteres." };
  return { nome, instrucao };
}

function validarAdministracao(dados, agora = new Date()) {
  const bruto = dados && dados.data_hora;
  if (bruto === undefined || bruto === null || String(bruto).trim() === "") {
    return { erro: "Informe a data e hora da administração." };
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(bruto).trim());
  if (!m) return { erro: "Data e hora inválidas." };
  const [, a, mes, d, h, mi, s = "00"] = m;
  const dt = new Date(+a, +mes - 1, +d, +h, +mi, +s);
  if (
    dt.getFullYear() !== +a || dt.getMonth() !== +mes - 1 || dt.getDate() !== +d ||
    dt.getHours() !== +h || dt.getMinutes() !== +mi
  ) {
    return { erro: "Data e hora inválidas." };
  }
  if (dt.getTime() > agora.getTime()) return { erro: "A data e hora da administração não pode ser futura." };

  let observacao = null;
  if (dados.observacao !== undefined && dados.observacao !== null && String(dados.observacao).trim() !== "") {
    observacao = String(dados.observacao);
    if (observacao.length > 500) return { erro: "A observação deve ter no máximo 500 caracteres." };
  }
  return { dataHora: `${a}-${mes}-${d} ${h}:${mi}:${s}`, observacao };
}

async function listar(db, usuario, idPessoa) {
  let filtro = null;
  if (idPessoa !== undefined && idPessoa !== null && idPessoa !== "") {
    filtro = Number(idPessoa);
    if (!Number.isInteger(filtro) || filtro <= 0) return { status: 400, body: { error: "Pessoa inválida." } };
  }
  const linhas = await medicamentoRepository.listar(db, usuario.id, filtro);
  const medicamentos = linhas.map((l) => ({
    ...l,
    pode_registrar_administracao: usuario.perfil === "ADMIN" || Boolean(l.pode_registrar_administracao)
  }));
  return { status: 200, body: { medicamentos } };
}

async function criar(db, usuario, dados) {
  dados = dados || {};
  const idPessoa = Number(dados.id_pessoa);
  if (!Number.isInteger(idPessoa) || idPessoa <= 0) return { status: 400, body: { error: "Informe a pessoa assistida." } };
  const valido = validarMedicamento(dados);
  if (valido.erro) return { status: 400, body: { error: valido.erro } };

  return executar(db, async (conn) => {
    if (!(await medicamentoRepository.buscarVinculo(conn, idPessoa, usuario.id))) falha(403, "Acesso negado.");
    const id = await medicamentoRepository.inserir(conn, idPessoa, valido.nome, valido.instrucao);
    await historicoRepository.registrarEntidade(conn, usuario.id, "MEDICAMENTO_CRIADO", ENTIDADE_MEDICAMENTO, id);
    const medicamento = await medicamentoRepository.buscarDetalhe(conn, id);
    return { status: 201, body: { medicamento } };
  });
}

async function carregar(conn, usuario, id) {
  const atual = await medicamentoRepository.buscar(conn, id);
  if (!atual) falha(404, "Medicamento não encontrado.");
  const vinculo = await medicamentoRepository.buscarVinculo(conn, atual.id_pessoa, usuario.id);
  if (!vinculo) falha(403, "Acesso negado.");
  return { atual, vinculo };
}

async function editar(db, usuario, id, dados) {
  dados = dados || {};
  return executar(db, async (conn) => {
    await carregar(conn, usuario, id);
    const valido = validarMedicamento(dados);
    if (valido.erro) falha(400, valido.erro);
    await medicamentoRepository.atualizar(conn, id, valido.nome, valido.instrucao);
    await historicoRepository.registrarEntidade(conn, usuario.id, "MEDICAMENTO_ALTERADO", ENTIDADE_MEDICAMENTO, id);
    const medicamento = await medicamentoRepository.buscarDetalhe(conn, id);
    return { status: 200, body: { medicamento } };
  });
}

async function excluir(db, usuario, id) {
  return executar(db, async (conn) => {
    await carregar(conn, usuario, id);
    if ((await medicamentoRepository.contarAdministracoes(conn, id)) > 0) {
      falha(409, "Medicamento com administrações registradas não pode ser excluído.");
    }
    await medicamentoRepository.excluir(conn, id);
    await historicoRepository.registrarEntidade(conn, usuario.id, "MEDICAMENTO_EXCLUIDO", ENTIDADE_MEDICAMENTO, id);
    return { status: 200, body: { ok: true } };
  });
}

async function registrarAdministracao(db, usuario, id, dados, agora) {
  dados = dados || {};
  return executar(db, async (conn) => {
    const { vinculo } = await carregar(conn, usuario, id);
    const logado = await usuarioRepository.buscarPorId(conn, usuario.id);
    const ehAdmin = usuario.perfil === "ADMIN";
    if (!logado || logado.status !== "ATIVO") falha(403, "Acesso negado.");
    if (!ehAdmin && !vinculo.pode_registrar_administracao) falha(403, "Sem permissão para registrar administração.");
    const valido = validarAdministracao(dados, agora);
    if (valido.erro) falha(400, valido.erro);

    const idAdm = await medicamentoRepository.inserirAdministracao(conn, id, usuario.id, valido.dataHora, valido.observacao);
    await historicoRepository.registrarEntidade(conn, usuario.id, "ADMINISTRACAO_REGISTRADA", ENTIDADE_ADMINISTRACAO, idAdm);
    const administracao = await medicamentoRepository.buscarAdministracao(conn, idAdm);
    return { status: 201, body: { administracao } };
  });
}

async function listarAdministracoes(db, usuario, id) {
  return executar(db, async (conn) => {
    await carregar(conn, usuario, id);
    const administracoes = await medicamentoRepository.listarAdministracoes(conn, id);
    return { status: 200, body: { administracoes } };
  });
}

module.exports = {
  listar, criar, editar, excluir, registrarAdministracao, listarAdministracoes,
  validarMedicamento, validarAdministracao
};
