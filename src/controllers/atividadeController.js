const atividadeService = require("../services/atividadeService");

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
    if (!id) return { status: 404, body: { error: "Atividade não encontrada." } };
    return fn(db, req.session.user, id, req.body || {});
  });
}

const listar = (getPool) => handler(getPool, (db, req) => atividadeService.listar(db, req.session.user, req.query.status));
const criar = (getPool) => handler(getPool, (db, req) => atividadeService.criar(db, req.session.user, req.body || {}));
const editar = (getPool) => comId(getPool, (db, u, id, corpo) => atividadeService.editar(db, u, id, corpo));
const cancelar = (getPool) => comId(getPool, (db, u, id) => atividadeService.cancelar(db, u, id));
const assumir = (getPool) => comId(getPool, (db, u, id) => atividadeService.assumir(db, u, id));
const liberar = (getPool) => comId(getPool, (db, u, id) => atividadeService.liberar(db, u, id));
const concluir = (getPool) => comId(getPool, (db, u, id) => atividadeService.concluir(db, u, id));

module.exports = { listar, criar, editar, cancelar, assumir, liberar, concluir };
