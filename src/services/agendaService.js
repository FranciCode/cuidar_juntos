const agendaRepository = require("../repositories/agendaRepository");

const STATUS_VALIDOS = ["PENDENTE", "ASSUMIDA", "CONCLUIDA", "CANCELADA"];

function dataValida(texto) {
  if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const data = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto;
}

function tempo(valor) {
  return valor instanceof Date ? valor.getTime() : new Date(valor).getTime();
}

function erro(mensagem) {
  return { status: 400, body: { error: mensagem } };
}

async function listar(db, usuario, query = {}) {
  const { de, ate, status } = query;
  if (de !== undefined && !dataValida(de)) return erro("Data inicial inválida. Use AAAA-MM-DD.");
  if (ate !== undefined && !dataValida(ate)) return erro("Data final inválida. Use AAAA-MM-DD.");
  if (de !== undefined && ate !== undefined && de > ate) return erro("A data inicial não pode ser maior que a final.");
  if (status !== undefined && !STATUS_VALIDOS.includes(status)) return erro("Status inválido.");

  const filtros = {
    inicio: de !== undefined ? `${de} 00:00:00` : null,
    fim: ate !== undefined ? `${ate} 23:59:59` : null,
    status: status !== undefined ? status : null
  };

  const atividades = await agendaRepository.listarAtividades(db, usuario.id, filtros);
  const compromissos = status !== undefined ? [] : await agendaRepository.listarCompromissos(db, usuario.id, filtros);

  const itens = [...atividades, ...compromissos].map((i) => ({
    origem: i.origem,
    id: i.id,
    titulo: i.titulo,
    data_hora: i.data_hora,
    status: i.origem === "COMPROMISSO" ? null : i.status,
    id_pessoa: i.id_pessoa,
    pessoa: i.pessoa
  }));

  itens.sort((a, b) => {
    if (!a.data_hora && !b.data_hora) return 0;
    if (!a.data_hora) return 1;
    if (!b.data_hora) return -1;
    return tempo(a.data_hora) - tempo(b.data_hora);
  });

  return { status: 200, body: { itens } };
}

module.exports = { listar };
