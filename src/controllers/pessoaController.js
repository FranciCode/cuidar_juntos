const pessoaService = require("../services/pessoaService");

function handler(getPool, acao) {
  return async (req, res) => {
    try {
      const db = await getPool();
      const result = await acao(db, req);
      res.status(result.status).json(result.body);
    } catch (_error) {
      res.status(500).json({ error: "Não foi possível concluir a operação." });
    }
  };
}

const listar = (getPool) => handler(getPool, (db, req) => pessoaService.listar(db, req.session.user));
const criar = (getPool) => handler(getPool, (db, req) => pessoaService.criar(db, req.session.user, req.body || {}));
const editar = (getPool) =>
  handler(getPool, (db, req) => pessoaService.editar(db, req.session.user, req.pessoaId, req.body || {}));
const alterarStatus = (getPool) =>
  handler(getPool, (db, req) => pessoaService.alterarStatus(db, req.session.user, req.pessoaId, req.body || {}));

module.exports = { listar, criar, editar, alterarStatus };
