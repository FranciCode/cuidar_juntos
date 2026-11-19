const express = require("express");
const authController = require("../controllers/authController");

module.exports = (getPool) => {
  const router = express.Router();
  router.post("/", authController.login(getPool));
  router.post("/cadastro", authController.cadastrar(getPool));
  return router;
};
