const express = require("express");
const medicamentoController = require("../controllers/medicamentoController");
const { requireAuth, requireRole } = require("../middlewares/auth");

module.exports = (getPool) => {
  const router = express.Router();
  router.use(requireAuth);
  router.get("/", medicamentoController.listar(getPool));
  router.post("/", requireRole("ADMIN"), medicamentoController.criar(getPool));
  router.put("/:id", requireRole("ADMIN"), medicamentoController.editar(getPool));
  router.delete("/:id", requireRole("ADMIN"), medicamentoController.excluir(getPool));
  router.get("/:id/administracoes", medicamentoController.listarAdministracoes(getPool));
  router.post("/:id/administracoes", medicamentoController.registrarAdministracao(getPool));
  return router;
};
