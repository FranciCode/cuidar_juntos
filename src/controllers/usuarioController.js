const usuarioService = require("../services/usuarioService");

function tratar(res, error) {
  if (error instanceof usuarioService.HttpError) return res.status(error.status).json({ error: error.message });
  return res.status(500).json({ error: "Não foi possível concluir a operação." });
}

function idParam(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const listar = (getPool) => async (_req, res) => {
  try {
    res.json({ usuarios: await usuarioService.listar(await getPool()) });
  } catch (error) { tratar(res, error); }
};

const criar = (getPool) => async (req, res) => {
  try {
    const usuario = await usuarioService.criar(await getPool(), req.session.user, req.body || {});
    res.status(201).json({ usuario });
  } catch (error) { tratar(res, error); }
};

const editar = (getPool) => async (req, res) => {
  const id = idParam(req);
  if (!id) return res.status(404).json({ error: "Usuário não encontrado." });
  try {
    const usuario = await usuarioService.editar(await getPool(), req.session.user, id, req.body || {});
    res.json({ usuario });
  } catch (error) { tratar(res, error); }
};

const alterarStatus = (getPool) => async (req, res) => {
  const id = idParam(req);
  if (!id) return res.status(404).json({ error: "Usuário não encontrado." });
  try {
    const usuario = await usuarioService.alterarStatus(await getPool(), req.session.user, id, (req.body || {}).status);
    res.json({ usuario });
  } catch (error) { tratar(res, error); }
};

module.exports = { listar, criar, editar, alterarStatus };
