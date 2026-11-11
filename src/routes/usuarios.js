const express = require("express");
const usuarioController = require("../controllers/usuarioController");

module.exports = (getPool, requireAuth, requireAdmin) => {
  const router = express.Router();
  router.use(requireAuth, requireAdmin);
  router.get("/", usuarioController.listar(getPool));
  router.post("/", usuarioController.criar(getPool));
  router.put("/:id", usuarioController.editar(getPool));
  router.patch("/:id/status", usuarioController.alterarStatus(getPool));
  return router;
};
