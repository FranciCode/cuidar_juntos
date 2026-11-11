const express = require("express");
const pessoaController = require("../controllers/pessoaController");
const { requireAuth, requireRole } = require("../middlewares/auth");
const vinculo = require("../middlewares/vinculo");

module.exports = (getPool) => {
  const router = express.Router();
  router.use(requireAuth);
  router.get("/", pessoaController.listar(getPool));
  router.post("/", requireRole("ADMIN"), pessoaController.criar(getPool));
  router.put("/:id", requireRole("ADMIN"), vinculo(getPool), pessoaController.editar(getPool));
  router.patch("/:id/status", requireRole("ADMIN"), vinculo(getPool), pessoaController.alterarStatus(getPool));
  return router;
};
