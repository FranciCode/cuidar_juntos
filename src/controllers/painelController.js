const painelService = require("../services/painelService");

const obter = (getPool) => async (req, res) => {
  try {
    const db = await getPool();
    const result = await painelService.obter(db, req.session.user, req.query);
    res.status(result.status).json(result.body);
  } catch (_error) {
    res.status(500).json({ error: "Não foi possível concluir a operação." });
  }
};

module.exports = { obter };
