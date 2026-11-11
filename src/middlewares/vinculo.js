const pessoaRepository = require("../repositories/pessoaRepository");

function vinculo(getPool) {
  return async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: "Pessoa não encontrada." });
      const db = await getPool();
      if (!(await pessoaRepository.existe(db, id))) return res.status(404).json({ error: "Pessoa não encontrada." });
      if (!(await pessoaRepository.temVinculo(db, id, req.session.user.id))) {
        return res.status(403).json({ error: "Acesso negado." });
      }
      req.pessoaId = id;
      next();
    } catch (_error) {
      res.status(500).json({ error: "Não foi possível verificar o acesso." });
    }
  };
}

module.exports = vinculo;
