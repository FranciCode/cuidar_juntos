require("dotenv").config();

const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
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

app.use("/api/login", require("./routes/auth")(getPool));
app.use("/api/usuarios", require("./routes/usuarios")(getPool, requireAuth, requireAdmin));

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "NÃ£o autenticado." });
  res.json({ user: req.session.user });
});

app.get("/api/atividades", requireAuth, async (req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.execute(
      `SELECT a.id_atividade, a.titulo, a.descricao, a.data_hora, a.status,
              p.nome AS pessoa_assistida, u.nome AS criado_por_nome,
              (SELECT r.id_usuario FROM RESPONSABILIDADE r
               WHERE r.id_atividade = a.id_atividade AND r.liberada_em IS NULL
               ORDER BY r.assumida_em DESC LIMIT 1) AS responsavel_id,
              (SELECT u2.nome FROM RESPONSABILIDADE r2
               JOIN USUARIO u2 ON u2.id_usuario = r2.id_usuario
               WHERE r2.id_atividade = a.id_atividade AND r2.liberada_em IS NULL
               ORDER BY r2.assumida_em DESC LIMIT 1) AS responsavel_nome
       FROM ATIVIDADE a
       JOIN PESSOA_ASSISTIDA p ON p.id_pessoa = a.id_pessoa
       JOIN USUARIO u ON u.id_usuario = a.criado_por
       ORDER BY CASE a.status WHEN 'PENDENTE' THEN 0 WHEN 'ASSUMIDA' THEN 1 ELSE 2 END,
                a.data_hora IS NULL, a.data_hora ASC`,
      []
    );
    res.json({ atividades: rows, usuario: req.session.user });
  } catch (_error) {
    res.status(500).json({ error: "NÃ£o foi possÃ­vel consultar as atividades." });
  }
});

app.post("/api/atividades", requireAdmin, async (req, res) => {
  const titulo = String(req.body.titulo || "").trim();
  const descricao = String(req.body.descricao || "").trim();
  const dataHora = req.body.data_hora || null;
  const idPessoa = Number(req.body.id_pessoa);
  if (!titulo || !Number.isInteger(idPessoa) || idPessoa < 1) {
    return res.status(400).json({ error: "Informe um tÃ­tulo e uma pessoa assistida vÃ¡lida." });
  }
  try {
    const db = await getPool();
    const [result] = await db.execute(
      "INSERT INTO ATIVIDADE (id_pessoa, titulo, descricao, data_hora, status, criado_por) VALUES (?, ?, ?, ?, 'PENDENTE', ?)",
      [idPessoa, titulo, descricao || null, dataHora || null, req.session.user.id]
    );
    res.status(201).json({ id_atividade: result.insertId });
  } catch (_error) {
    res.status(500).json({ error: "NÃ£o foi possÃ­vel salvar a atividade. Verifique se a pessoa assistida existe." });
  }
});

app.post("/api/atividades/:id/assumir", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Identificador invÃ¡lido." });
  const db = await getPool();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute("SELECT status FROM ATIVIDADE WHERE id_atividade = ? FOR UPDATE", [id]);
    if (!rows[0] || rows[0].status !== "PENDENTE") {
      await conn.rollback();
      return res.status(409).json({ error: "A atividade nÃ£o estÃ¡ disponÃ­vel para ser assumida." });
    }
    await conn.execute(
      "INSERT INTO RESPONSABILIDADE (id_atividade, id_usuario, assumida_em) VALUES (?, ?, NOW())",
      [id, req.session.user.id]
    );
    await conn.execute("UPDATE ATIVIDADE SET status = 'ASSUMIDA', atualizado_em = NOW() WHERE id_atividade = ?", [id]);
    await conn.execute(
      "INSERT INTO HISTORICO (id_usuario, acao, entidade, id_registro, data_hora, detalhes) VALUES (?, 'ASSUMIU_ATIVIDADE', 'ATIVIDADE', ?, NOW(), 'Responsabilidade assumida')",
      [req.session.user.id, id]
    );
    await conn.commit();
    res.json({ ok: true });
  } catch (_error) {
    await conn.rollback();
    res.status(500).json({ error: "NÃ£o foi possÃ­vel assumir a atividade." });
  } finally {
    conn.release();
  }
});

app.post("/api/atividades/:id/liberar", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const db = await getPool();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      "SELECT id_responsabilidade FROM RESPONSABILIDADE WHERE id_atividade = ? AND id_usuario = ? AND liberada_em IS NULL ORDER BY assumida_em DESC LIMIT 1 FOR UPDATE",
      [id, req.session.user.id]
    );
    if (!rows[0]) {
      await conn.rollback();
      return res.status(409).json({ error: "VocÃª nÃ£o possui uma responsabilidade ativa nesta atividade." });
    }
    await conn.execute("UPDATE RESPONSABILIDADE SET liberada_em = NOW() WHERE id_responsabilidade = ?", [rows[0].id_responsabilidade]);
    await conn.execute("UPDATE ATIVIDADE SET status = 'PENDENTE', atualizado_em = NOW() WHERE id_atividade = ?", [id]);
    await conn.execute(
      "INSERT INTO HISTORICO (id_usuario, acao, entidade, id_registro, data_hora, detalhes) VALUES (?, 'LIBEROU_ATIVIDADE', 'ATIVIDADE', ?, NOW(), 'Responsabilidade liberada')",
      [req.session.user.id, id]
    );
    await conn.commit();
    res.json({ ok: true });
  } catch (_error) {
    await conn.rollback();
    res.status(500).json({ error: "NÃ£o foi possÃ­vel liberar a atividade." });
  } finally {
    conn.release();
  }
});

app.post("/api/atividades/:id/concluir", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const db = await getPool();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      "SELECT id_responsabilidade FROM RESPONSABILIDADE WHERE id_atividade = ? AND id_usuario = ? AND liberada_em IS NULL ORDER BY assumida_em DESC LIMIT 1 FOR UPDATE",
      [id, req.session.user.id]
    );
    if (!rows[0]) {
      await conn.rollback();
      return res.status(409).json({ error: "Assuma a atividade antes de concluÃ­-la." });
    }
    await conn.execute("UPDATE RESPONSABILIDADE SET concluida_em = NOW() WHERE id_responsabilidade = ?", [rows[0].id_responsabilidade]);
    await conn.execute("UPDATE ATIVIDADE SET status = 'CONCLUIDA', atualizado_em = NOW() WHERE id_atividade = ?", [id]);
    await conn.execute(
      "INSERT INTO HISTORICO (id_usuario, acao, entidade, id_registro, data_hora, detalhes) VALUES (?, 'CONCLUIU_ATIVIDADE', 'ATIVIDADE', ?, NOW(), 'Atividade concluÃ­da')",
      [req.session.user.id, id]
    );
    await conn.commit();
    res.json({ ok: true });
  } catch (_error) {
    await conn.rollback();
    res.status(500).json({ error: "NÃ£o foi possÃ­vel concluir a atividade." });
  } finally {
    conn.release();
  }
});

app.get("/api/pessoas", requireAuth, async (_req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.execute("SELECT id_pessoa, nome FROM PESSOA_ASSISTIDA ORDER BY nome");
    res.json({ pessoas: rows });
  } catch (_error) {
    res.status(500).json({ error: "NÃ£o foi possÃ­vel consultar as pessoas assistidas." });
  }
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

