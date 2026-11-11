const { withTransaction } = require("../db");
const atividadeRepository = require("../repositories/atividadeRepository");
const pessoaRepository = require("../repositories/pessoaRepository");
const usuarioRepository = require("../repositories/usuarioRepository");
const historicoRepository = require("../repositories/historicoRepository");
const statusAtividade = require("../utils/statusAtividade");

const ENTIDADE = "ATIVIDADE";
const MSG_JA_ASSUMIDA = "atividade já assumida por outra pessoa";

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

function validarDados(dados) {
  const titulo = String((dados && dados.titulo) || "").trim();
  if (!titulo) return { erro: "Informe o título da atividade." };
  if (titulo.length > 150) return { erro: "O título deve ter no máximo 150 caracteres." };

  let descricao = null;
  if (dados.descricao !== undefined && dados.descricao !== null && String(dados.descricao).trim() !== "") {
    descricao = String(dados.descricao);
    if (descricao.length > 500) return { erro: "A descrição deve ter no máximo 500 caracteres." };
  }

  let dataHora = null;
  const bruto = dados.data_hora;
  if (bruto !== undefined && bruto !== null && String(bruto).trim() !== "") {
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(bruto).trim());
    if (!m) return { erro: "Data e hora inválidas." };
    const [, a, mes, d, h, mi, s = "00"] = m;
    const dt = new Date(Date.UTC(+a, +mes - 1, +d, +h, +mi, +s));
    if (
      dt.getUTCFullYear() !== +a || dt.getUTCMonth() !== +mes - 1 || dt.getUTCDate() !== +d ||
      dt.getUTCHours() !== +h || dt.getUTCMinutes() !== +mi
    ) {
      return { erro: "Data e hora inválidas." };
    }
    dataHora = `${a}-${mes}-${d} ${h}:${mi}:${s}`;
  }
  return { titulo, descricao, dataHora };
}

async function listar(db, usuario, status) {
  if (status !== undefined && !statusAtividade.statusValido(status)) {
    return { status: 400, body: { error: "Status inválido." } };
  }
  const atividades = await atividadeRepository.listar(db, usuario.id, status);
  return { status: 200, body: { atividades } };
}

async function criar(db, usuario, dados) {
  dados = dados || {};
  const idPessoa = Number(dados.id_pessoa);
  if (!Number.isInteger(idPessoa) || idPessoa <= 0) return { status: 400, body: { error: "Informe a pessoa assistida." } };
  const valido = validarDados(dados);
  if (valido.erro) return { status: 400, body: { error: valido.erro } };

  return executar(db, async (conn) => {
    if (!(await pessoaRepository.temVinculo(conn, idPessoa, usuario.id))) falha(403, "Acesso negado.");
    const id = await atividadeRepository.inserir(conn, idPessoa, valido.titulo, valido.descricao, valido.dataHora, usuario.id);
    await historicoRepository.registrar(conn, usuario.id, "ATIVIDADE_CRIADA", ENTIDADE, id);
    const atividade = await atividadeRepository.buscarDetalhe(conn, id);
    return { status: 201, body: { atividade } };
  });
}

async function carregar(conn, usuario, id) {
  const atual = await atividadeRepository.buscarBloqueada(conn, id);
  if (!atual) falha(404, "Atividade não encontrada.");
  if (!(await pessoaRepository.temVinculo(conn, atual.id_pessoa, usuario.id))) falha(403, "Acesso negado.");
  return atual;
}

function avisoPara(responsavel, usuario) {
  if (responsavel && responsavel.id_usuario !== usuario.id) {
    return {
      aviso: `Responsável avisado: usuário ${responsavel.id_usuario}`,
      detalhes: `responsável avisado: ${responsavel.id_usuario}`
    };
  }
  return { aviso: null, detalhes: null };
}

async function editar(db, usuario, id, dados) {
  dados = dados || {};
  return executar(db, async (conn) => {
    const atual = await carregar(conn, usuario, id);
    const valido = validarDados(dados);
    if (valido.erro) falha(400, valido.erro);
    if (!statusAtividade.editavel(atual.status)) falha(409, "Atividade concluída ou cancelada não pode ser alterada.");

    const resp = atual.status === "ASSUMIDA" ? await atividadeRepository.responsavelAtivo(conn, id) : null;
    const { aviso, detalhes } = avisoPara(resp, usuario);
    await atividadeRepository.atualizarDados(conn, id, valido.titulo, valido.descricao, valido.dataHora);
    await historicoRepository.registrar(conn, usuario.id, "ATIVIDADE_ALTERADA", ENTIDADE, id, detalhes);
    const atividade = await atividadeRepository.buscarDetalhe(conn, id);
    const body = { atividade };
    if (aviso) body.aviso = aviso;
    return { status: 200, body };
  });
}

async function cancelar(db, usuario, id) {
  return executar(db, async (conn) => {
    const atual = await carregar(conn, usuario, id);
    if (!statusAtividade.podeTransitar("cancelar", atual.status)) {
      falha(409, "Atividade concluída ou cancelada não pode ser cancelada.");
    }
    const resp = atual.status === "ASSUMIDA" ? await atividadeRepository.responsavelAtivo(conn, id) : null;
    const { aviso, detalhes } = avisoPara(resp, usuario);
    if ((await atividadeRepository.mudarStatus(conn, id, atual.status, "CANCELADA")) === 0) {
      falha(409, "A atividade foi alterada por outra pessoa.");
    }
    await atividadeRepository.liberarResponsabilidade(conn, id);
    await historicoRepository.registrar(conn, usuario.id, "ATIVIDADE_CANCELADA", ENTIDADE, id, detalhes);
    const atividade = await atividadeRepository.buscarDetalhe(conn, id);
    const body = { atividade };
    if (aviso) body.aviso = aviso;
    return { status: 200, body };
  });
}

async function assumir(db, usuario, id) {
  return executar(db, async (conn) => {
    const atual = await carregar(conn, usuario, id);
    const logado = await usuarioRepository.buscarPorId(conn, usuario.id);
    if (!logado || logado.status !== "ATIVO") falha(403, "Acesso negado.");
    if (!statusAtividade.podeTransitar("assumir", atual.status)) {
      falha(409, atual.status === "ASSUMIDA" ? MSG_JA_ASSUMIDA : "Atividade concluída ou cancelada não pode ser assumida.");
    }
    if ((await atividadeRepository.mudarStatus(conn, id, "PENDENTE", "ASSUMIDA")) === 0) falha(409, MSG_JA_ASSUMIDA);
    await atividadeRepository.inserirResponsabilidade(conn, id, usuario.id);
    await historicoRepository.registrar(conn, usuario.id, "ATIVIDADE_ASSUMIDA", ENTIDADE, id);
    const atividade = await atividadeRepository.buscarDetalhe(conn, id);
    return { status: 200, body: { atividade } };
  });
}

async function finalizar(db, usuario, id, acao) {
  return executar(db, async (conn) => {
    const atual = await carregar(conn, usuario, id);
    if (!statusAtividade.podeTransitar(acao, atual.status)) {
      falha(409, `Só é possível ${acao} uma atividade assumida.`);
    }
    const resp = await atividadeRepository.responsavelAtivo(conn, id);
    const ehResponsavel = resp && resp.id_usuario === usuario.id;
    if (!ehResponsavel && usuario.perfil !== "ADMIN") falha(403, "Apenas o responsável ou o administrador pode fazer isso.");

    if ((await atividadeRepository.mudarStatus(conn, id, "ASSUMIDA", statusAtividade.destino(acao))) === 0) {
      falha(409, "A atividade foi alterada por outra pessoa.");
    }
    if (acao === "liberar") await atividadeRepository.liberarResponsabilidade(conn, id);
    else await atividadeRepository.concluirResponsabilidade(conn, id);
    const nome = acao === "liberar" ? "ATIVIDADE_LIBERADA" : "ATIVIDADE_CONCLUIDA";
    const detalhes = acao === "concluir" ? `concluída por usuário ${usuario.id}` : null;
    await historicoRepository.registrar(conn, usuario.id, nome, ENTIDADE, id, detalhes);
    const atividade = await atividadeRepository.buscarDetalhe(conn, id);
    return { status: 200, body: { atividade } };
  });
}

const liberar = (db, usuario, id) => finalizar(db, usuario, id, "liberar");
const concluir = (db, usuario, id) => finalizar(db, usuario, id, "concluir");

module.exports = { listar, criar, editar, cancelar, assumir, liberar, concluir, validarDados };
