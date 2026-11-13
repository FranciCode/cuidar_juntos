require("dotenv").config();

const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const path = require("path");
const mysql = require("mysql2/promise");
const loginLimiter = require("./middlewares/loginLimiter");

const app = express();

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: "cuidarjuntos.sid",
  secret: process.env.SESSION_SECRET || "somente-desenvolvimento-altere-esta-chave",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 4
  }
}));
app.use(express.static(path.join(__dirname, "public")));

let pool;

async function getPool() {
  if (app.locals.pool) return app.locals.pool;
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "cuidar_juntos",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "FaÃ§a login para continuar." });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.perfil !== "ADMIN") {
    return res.status(403).json({ error: "Esta aÃ§Ã£o exige permissÃ£o de administrador familiar." });
  }
  next();
}

app.get("/api/health", async (_req, res) => {
  try {
    const db = await getPool();
    await db.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (_error) {
    res.status(503).json({ status: "error", database: "unavailable", message: "Confira a configuraÃ§Ã£o do MySQL e o arquivo .env." });
  }
});

app.use("/api/login", loginLimiter, require("./routes/auth")(getPool));
app.use("/api/usuarios", require("./routes/usuarios")(getPool, requireAuth, requireAdmin));

app.use("/api/atividades", require("./routes/atividades")(getPool));
app.use("/api/compromissos", require("./routes/compromissos")(getPool));
app.use("/api/pessoas", require("./routes/pessoas")(getPool));
app.use("/api/medicamentos", require("./routes/medicamentos")(getPool));

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "NÃ£o autenticado." });
  res.json({ user: req.session.user });
});

app.get("/api/historico", requireAuth, async (_req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.execute(
      `SELECT h.acao, h.entidade, h.id_registro, h.data_hora, h.detalhes, u.nome AS usuario_nome
       FROM HISTORICO h JOIN USUARIO u ON u.id_usuario = h.id_usuario
       ORDER BY h.data_hora DESC LIMIT 100`
    );
    res.json({ historico: rows });
  } catch (_error) {
    res.status(500).json({ error: "NÃ£o foi possÃ­vel consultar o histÃ³rico." });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "pages", "index.html")));

module.exports = app;

