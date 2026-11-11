const authService = require("../services/authService");

function login(getPool) {
  return async (req, res) => {
    try {
      const db = await getPool();
      const body = req.body || {};
      const result = await authService.login(db, body.email, body.senha);
      if (result.sessionUser) req.session.user = result.sessionUser;
      res.status(result.status).json(result.body);
    } catch (_error) {
      res.status(500).json({ error: "Não foi possível realizar o login. Confira se o banco foi configurado." });
    }
  };
}

module.exports = { login };
