const express = require("express");
const atividadeController = require("../controllers/atividadeController");
const { requireAuth, requireRole } = require("../middlewares/auth");

module.exports = (getPool) => {
  const router = express.Router();
  router.use(requireAuth);
  router.get("/", atividadeController.listar(getPool));
  router.post("/", requireRole("ADMIN"), atividadeController.criar(getPool));
  router.put("/:id", requireRole("ADMIN"), atividadeController.editar(getPool));
  router.patch("/:id/cancelar", requireRole("ADMIN"), atividadeController.cancelar(getPool));
  router.patch("/:id/assumir", atividadeController.assumir(getPool));
  router.patch("/:id/liberar", atividadeController.liberar(getPool));
  router.patch("/:id/concluir", atividadeController.concluir(getPool));
  return router;
};
