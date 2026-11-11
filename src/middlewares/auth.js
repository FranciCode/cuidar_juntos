function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) return res.status(401).json({ error: "Faça login para continuar." });
  next();
}

function requireRole(...perfis) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: "Faça login para continuar." });
    if (!perfis.includes(req.session.user.perfil)) return res.status(403).json({ error: "Acesso negado." });
    next();
  };
}

const requireAdmin = requireRole("ADMIN");

module.exports = { requireAuth, requireRole, requireAdmin };
