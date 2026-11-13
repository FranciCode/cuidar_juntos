const express = require("express");
const compromissoController = require("../controllers/compromissoController");
const { requireAuth, requireRole } = require("../middlewares/auth");

module.exports = (getPool) => {
  const router = express.Router();
  router.use(requireAuth);
  router.get("/", compromissoController.listar(getPool));
  router.post("/", requireRole("ADMIN"), compromissoController.criar(getPool));
  router.put("/:id", requireRole("ADMIN"), compromissoController.editar(getPool));
  router.delete("/:id", requireRole("ADMIN"), compromissoController.excluir(getPool));
  return router;
};
