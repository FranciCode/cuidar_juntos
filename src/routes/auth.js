const express = require("express");
const authController = require("../controllers/authController");

module.exports = (getPool) => {
  const router = express.Router();
  router.get("/estado", authController.estado(getPool));
  router.post("/", authController.login(getPool));
  router.post("/cadastro", authController.cadastrar(getPool));
  router.post("/redefinir-senha", authController.redefinirSenha(getPool));
  return router;
};
