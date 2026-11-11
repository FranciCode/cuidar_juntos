const usuarioService = require("../services/usuarioService");

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

const listar = (getPool) => handler(getPool, (db) => usuarioService.listar(db));
const criar = (getPool) => handler(getPool, (db, req) => usuarioService.criar(db, req.session.user, req.body || {}));
const editar = (getPool) =>
  handler(getPool, (db, req) => usuarioService.editar(db, req.session.user, Number(req.params.id), req.body || {}));
const alterarStatus = (getPool) =>
  handler(getPool, (db, req) => usuarioService.alterarStatus(db, req.session.user, Number(req.params.id), req.body || {}));

module.exports = { listar, criar, editar, alterarStatus };
