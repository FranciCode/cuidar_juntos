const authService = require("../services/authService");
const usuarioRepository = require("../repositories/usuarioRepository");

function iniciarSessao(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.user = user;
      resolve();
    });
  });
}

function login(getPool) {
  return async (req, res) => {
    try {
      const db = await getPool();
      const body = req.body || {};
      const result = await authService.login(db, body.email, body.senha);
      if (result.sessionUser) await iniciarSessao(req, result.sessionUser);
      res.status(result.status).json(result.body);
    } catch (_error) {
      res.status(500).json({ error: "Não foi possível realizar o login. Confira se o banco foi configurado." });
    }
  };
}

function cadastrar(getPool) {
  return async (req, res) => {
    try {
      const db = await getPool();
      const result = await authService.cadastrar(db, req.body || {});
      if (result.sessionUser) await iniciarSessao(req, result.sessionUser);
      res.status(result.status).json(result.body);
    } catch (_error) {
      res.status(500).json({ error: "Não foi possível criar a conta." });
    }
  };
}

function redefinirSenha(getPool) {
  return async (req, res) => {
    try {
      const result = await authService.redefinirSenha(await getPool(), req.body || {});
      res.status(result.status).json(result.body);
    } catch (_error) {
      res.status(500).json({ error: "Não foi possível redefinir a senha." });
    }
  };
}

function estado(getPool) {
  return async (_req, res) => {
    try {
      const db = await getPool();
      res.json({ primeiro_acesso: !(await usuarioRepository.existeAdmin(db)) });
    } catch (_error) {
      res.json({ primeiro_acesso: false });
    }
  };
}

module.exports = { login, cadastrar, redefinirSenha, estado };
