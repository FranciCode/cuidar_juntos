const TRANSICOES = {
  assumir: { de: ["PENDENTE"], para: "ASSUMIDA" },
  liberar: { de: ["ASSUMIDA"], para: "PENDENTE" },
  concluir: { de: ["ASSUMIDA"], para: "CONCLUIDA" },
  cancelar: { de: ["PENDENTE", "ASSUMIDA"], para: "CANCELADA" }
};

const STATUS = ["PENDENTE", "ASSUMIDA", "CONCLUIDA", "CANCELADA"];

function podeTransitar(acao, statusAtual) {
  return !!TRANSICOES[acao] && TRANSICOES[acao].de.includes(statusAtual);
}

function destino(acao) {
  return TRANSICOES[acao] ? TRANSICOES[acao].para : null;
}

function statusValido(status) {
  return STATUS.includes(status);
}

function editavel(statusAtual) {
  return statusAtual === "PENDENTE" || statusAtual === "ASSUMIDA";
}

module.exports = { TRANSICOES, STATUS, podeTransitar, destino, statusValido, editavel };
