const painelRepository = require("../repositories/painelRepository");

const LIMITE_PROXIMOS = 5;

function total(linhas, status) {
  const linha = linhas.find((l) => l.status === status);
  return linha ? Number(linha.total) || 0 : 0;
}

async function obter(db, usuario) {
  const contagens = await painelRepository.contarAtividadesPorStatus(db, usuario.id);
  const proximos = await painelRepository.listarProximosCompromissos(db, usuario.id);

  return {
    status: 200,
    body: {
      pendentes: total(contagens, "PENDENTE"),
      assumidas: total(contagens, "ASSUMIDA"),
      concluidas: total(contagens, "CONCLUIDA"),
      proximos_compromissos: proximos.slice(0, LIMITE_PROXIMOS)
    }
  };
}

module.exports = { obter };
