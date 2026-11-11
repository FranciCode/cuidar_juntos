require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const { getPool } = require("./db");
const authRoutes = require("./routes/auth");
const usuariosRoutes = require("./routes/usuarios");
const pessoasRoutes = require("./routes/pessoas");

const app = express();

app.use(helmet());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret-troque",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 8 }
}));

app.use(express.static(path.join(__dirname, "public")));

app.use("/api/login", authRoutes(getPool));
app.use("/api/usuarios", usuariosRoutes(getPool));
app.use("/api/pessoas", pessoasRoutes(getPool));

app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Faça login para continuar." });
  res.json({ user: req.session.user });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = app;
