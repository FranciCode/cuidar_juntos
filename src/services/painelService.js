const painelRepository = require("../repositories/painelRepository");

async function obter(db, usuario) {
  const contagens = await painelRepository.contarAtividadesPorStatus(db, usuario.id);
  const total = (status) => {
    const linha = contagens.find((c) => c.status === status);
    return linha ? Number(linha.total) : 0;
  };
  const proximos = await painelRepository.proximosCompromissos(db, usuario.id, 5);
  return {
    status: 200,
    body: {
      pendentes: total("PENDENTE"),
      assumidas: total("ASSUMIDA"),
      concluidas: total("CONCLUIDA"),
      proximos_compromissos: proximos.slice(0, 5)
    }
  };
}

module.exports = { obter };
