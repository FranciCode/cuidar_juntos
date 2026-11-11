const express = require("express");
const usuarioController = require("../controllers/usuarioController");
const { requireAuth, requireAdmin } = require("../middlewares/auth");

module.exports = (getPool) => {
  const router = express.Router();
  router.use(requireAuth, requireAdmin);
  router.get("/", usuarioController.listar(getPool));
  router.post("/", usuarioController.criar(getPool));
  router.put("/:id", usuarioController.editar(getPool));
  router.patch("/:id/status", usuarioController.alterarStatus(getPool));
  return router;
};
