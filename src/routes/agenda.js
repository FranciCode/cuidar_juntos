const express = require("express");
const agendaController = require("../controllers/agendaController");
const { requireAuth } = require("../middlewares/auth");

module.exports = (getPool) => {
  const router = express.Router();
  router.use(requireAuth);
  router.get("/", agendaController.listar(getPool));
  return router;
};
