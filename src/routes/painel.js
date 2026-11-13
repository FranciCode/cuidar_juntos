const express = require("express");
const painelController = require("../controllers/painelController");
const { requireAuth } = require("../middlewares/auth");

module.exports = (getPool) => {
  const router = express.Router();
  router.use(requireAuth);
  router.get("/", painelController.obter(getPool));
  return router;
};
