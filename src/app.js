require("dotenv").config();

const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();

const behindProxy = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
if (behindProxy) app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const sessionStore = behindProxy && process.env.NODE_ENV !== "test"
  ? new (require("./utils/mysqlSessionStore")(session))(() => getPool())
  : undefined;

app.use(session({
  store: sessionStore,
  proxy: behindProxy ? true : undefined,
  name: "cuidarjuntos.sid",
  secret: process.env.SESSION_SECRET || "somente-desenvolvimento-altere-esta-chave",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: behindProxy,
    maxAge: 1000 * 60 * 60 * 4
  }
}));
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (p.startsWith("/pages/") && p !== "/pages/index.html" && !(req.session && req.session.user)) {
    return res.redirect("/");
  }
  next();
});
app.get("/js/config.js", (_req, res) => {
  res.type("application/javascript");
  res.send(`window.BASE_URL = ${JSON.stringify((process.env.URL_DOMINIO || "").replace(/\/+$/, ""))};`);
});
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

app.use("/api/login", require("./routes/auth")(getPool));
app.use("/api/usuarios", require("./routes/usuarios")(getPool, requireAuth, requireAdmin));

app.use("/api/atividades", require("./routes/atividades")(getPool));
app.use("/api/compromissos", require("./routes/compromissos")(getPool));
app.use("/api/pessoas", require("./routes/pessoas")(getPool));
app.use("/api/medicamentos", require("./routes/medicamentos")(getPool));
app.use("/api/ocorrencias", require("./routes/ocorrencias")(getPool));
app.use("/api/agenda", require("./routes/agenda")(getPool));
app.use("/api/historico", require("./routes/historico")(getPool));

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "NÃ£o autenticado." });
  res.json({ user: req.session.user });
});

app.use("/api", (_req, res) => res.status(404).json({ error: "Recurso não encontrado." }));

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "pages", "index.html")));

module.exports = app;

