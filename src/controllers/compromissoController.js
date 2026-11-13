const compromissoService = require("../services/compromissoService");

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

function idDe(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

function comId(getPool, fn) {
  return handler(getPool, (db, req) => {
    const id = idDe(req);
    if (!id) return { status: 404, body: { error: "Compromisso não encontrado." } };
    return fn(db, req.session.user, id, req.body || {});
  });
}

const listar = (getPool) => handler(getPool, (db, req) => compromissoService.listar(db, req.session.user, req.query.id_pessoa));
const criar = (getPool) => handler(getPool, (db, req) => compromissoService.criar(db, req.session.user, req.body || {}));
const editar = (getPool) => comId(getPool, (db, u, id, corpo) => compromissoService.editar(db, u, id, corpo));
const excluir = (getPool) => comId(getPool, (db, u, id) => compromissoService.excluir(db, u, id));

module.exports = { listar, criar, editar, excluir };
