const express = require("express");
const historicoController = require("../controllers/historicoController");
const { requireAuth } = require("../middlewares/auth");

module.exports = (getPool) => {
  const router = express.Router();
  router.use(requireAuth);
  router.get("/", historicoController.listar(getPool));
  return router;
};
