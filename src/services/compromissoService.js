const { withTransaction } = require("../db");
const compromissoRepository = require("../repositories/compromissoRepository");
const pessoaRepository = require("../repositories/pessoaRepository");
const historicoRepository = require("../repositories/historicoRepository");

const ENTIDADE = "COMPROMISSO";
const TIPOS = ["CONSULTA", "EXAME"];

function falha(status, mensagem, extra) {
  const e = new Error(mensagem);
  e.resposta = { status, body: { error: mensagem, ...(extra || {}) } };
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

function validarDados(dados) {
  const tipo = dados.tipo;
  if (!TIPOS.includes(tipo)) return { erro: "Tipo inválido. Use CONSULTA ou EXAME." };

  const bruto = dados.data_hora;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(bruto === undefined || bruto === null ? "" : bruto).trim());
  if (!m) return { erro: "Data e hora inválidas." };
  const [, a, mes, d, h, mi, s = "00"] = m;
  const dt = new Date(Date.UTC(+a, +mes - 1, +d, +h, +mi, +s));
  if (
    dt.getUTCFullYear() !== +a || dt.getUTCMonth() !== +mes - 1 || dt.getUTCDate() !== +d ||
    dt.getUTCHours() !== +h || dt.getUTCMinutes() !== +mi || dt.getUTCSeconds() !== +s
  ) {
    return { erro: "Data e hora inválidas." };
  }
  const dataHora = `${a}-${mes}-${d} ${h}:${mi}:${s}`;

  const descricao = typeof dados.descricao === "string" ? dados.descricao : "";
  if (!descricao.trim()) return { erro: "Informe a descrição do compromisso." };
  if (descricao.length > 250) return { erro: "A descrição deve ter no máximo 250 caracteres." };

  let observacao = null;
  if (dados.observacao !== undefined && dados.observacao !== null && String(dados.observacao).trim() !== "") {
    observacao = String(dados.observacao);
    if (observacao.length > 500) return { erro: "A observação deve ter no máximo 500 caracteres." };
  }
  return { tipo, dataHora, descricao, observacao };
}

async function listar(db, usuario, idPessoaBruto) {
  let idPessoa = null;
  if (idPessoaBruto !== undefined) {
    if (!/^\d+$/.test(String(idPessoaBruto)) || Number(idPessoaBruto) <= 0) {
      return { status: 400, body: { error: "Pessoa inválida." } };
    }
    idPessoa = Number(idPessoaBruto);
  }
  const compromissos = await compromissoRepository.listar(db, usuario.id, idPessoa);
  return { status: 200, body: { compromissos } };
}

async function criar(db, usuario, dados) {
  dados = dados || {};
  const idPessoa = Number(dados.id_pessoa);
  if (!Number.isInteger(idPessoa) || idPessoa <= 0) return { status: 400, body: { error: "Informe a pessoa assistida." } };
  const valido = validarDados(dados);
  if (valido.erro) return { status: 400, body: { error: valido.erro } };

  return executar(db, async (conn) => {
    if (!(await pessoaRepository.temVinculo(conn, idPessoa, usuario.id))) falha(403, "Acesso negado.");
    if (dados.confirmar !== true && (await compromissoRepository.existeConflito(conn, idPessoa, valido.dataHora, 0))) {
      falha(409, "A pessoa já tem um compromisso neste horário.", { conflito: true });
    }
    const id = await compromissoRepository.inserir(conn, idPessoa, valido.tipo, valido.descricao, valido.dataHora, valido.observacao);
    await historicoRepository.registrarEntidade(conn, usuario.id, "COMPROMISSO_CRIADO", ENTIDADE, id);
    const compromisso = await compromissoRepository.buscarDetalhe(conn, id);
    return { status: 201, body: { compromisso } };
  });
}

async function carregar(conn, usuario, id) {
  const atual = await compromissoRepository.buscarBloqueado(conn, id);
  if (!atual) falha(404, "Compromisso não encontrado.");
  if (!(await pessoaRepository.temVinculo(conn, atual.id_pessoa, usuario.id))) falha(403, "Acesso negado.");
  return atual;
}

async function editar(db, usuario, id, dados) {
  dados = dados || {};
  return executar(db, async (conn) => {
    const atual = await carregar(conn, usuario, id);
    const valido = validarDados(dados);
    if (valido.erro) falha(400, valido.erro);
    if (dados.confirmar !== true && (await compromissoRepository.existeConflito(conn, atual.id_pessoa, valido.dataHora, id))) {
      falha(409, "A pessoa já tem um compromisso neste horário.", { conflito: true });
    }
    await compromissoRepository.atualizar(conn, id, valido.tipo, valido.descricao, valido.dataHora, valido.observacao);
    await historicoRepository.registrarEntidade(conn, usuario.id, "COMPROMISSO_ALTERADO", ENTIDADE, id);
    const compromisso = await compromissoRepository.buscarDetalhe(conn, id);
    return { status: 200, body: { compromisso } };
  });
}

async function excluir(db, usuario, id) {
  return executar(db, async (conn) => {
    await carregar(conn, usuario, id);
    await compromissoRepository.excluir(conn, id);
    await historicoRepository.registrarEntidade(conn, usuario.id, "COMPROMISSO_EXCLUIDO", ENTIDADE, id);
    return { status: 200, body: { ok: true } };
  });
}

module.exports = { listar, criar, editar, excluir };
