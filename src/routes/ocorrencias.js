const express = require("express");
const { requireAuth } = require("../middlewares/auth");

const TABELAS = {
  ATIVIDADE: { tabela: "ATIVIDADE", pk: "id_atividade" },
  MEDICAMENTO: { tabela: "MEDICAMENTO", pk: "id_medicamento" }
};

module.exports = (getPool) => {
  const router = express.Router();
  router.use(requireAuth);

  router.get("/", async (req, res) => {
    try {
      const t = TABELAS[String(req.query.tipo || "").toUpperCase()];
      if (!t) return res.status(400).json({ error: "Tipo inválido." });
      const db = await getPool();
      const [rows] = await db.execute(
        `SELECT o.id_ref, o.chave, o.id_usuario, u.nome AS responsavel
         FROM OCORRENCIA_RESPONSAVEL o
         JOIN ${t.tabela} x ON x.${t.pk} = o.id_ref
         JOIN USUARIO_PESSOA up ON up.id_pessoa = x.id_pessoa AND up.id_usuario = ?
         JOIN USUARIO u ON u.id_usuario = o.id_usuario
         WHERE o.tipo = ?`,
        [req.session.user.id, String(req.query.tipo).toUpperCase()]
      );
      res.json({ ocorrencias: rows });
    } catch (error) {
      console.error("[ocorrencias] erro interno:", { code: error && error.code, msg: error && error.message });
      res.status(500).json({ error: "Não foi possível concluir a operação." });
    }
  });

  router.post("/assumir", async (req, res) => {
    try {
      const corpo = req.body || {};
      const tipo = String(corpo.tipo || "").toUpperCase();
      const t = TABELAS[tipo];
      const id = Number(corpo.id);
      const chave = String(corpo.chave || "");
      if (!t || !Number.isInteger(id) || id <= 0 || !/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(chave)) {
        return res.status(400).json({ error: "Dados inválidos." });
      }
      const db = await getPool();
      const usuario = req.session.user;
      const [vinc] = await db.execute(
        `SELECT up.pode_registrar_administracao FROM ${t.tabela} x
         JOIN USUARIO_PESSOA up ON up.id_pessoa = x.id_pessoa AND up.id_usuario = ?
         WHERE x.${t.pk} = ? LIMIT 1`,
        [usuario.id, id]
      );
      if (!vinc.length) return res.status(403).json({ error: "Acesso negado." });
      if (tipo === "MEDICAMENTO" && usuario.perfil !== "ADMIN" && !vinc[0].pode_registrar_administracao) {
        return res.status(403).json({ error: "Sem permissão para assumir este medicamento." });
      }
      const [r] = await db.execute(
        "INSERT IGNORE INTO OCORRENCIA_RESPONSAVEL (tipo, id_ref, chave, id_usuario) VALUES (?, ?, ?, ?)",
        [tipo, id, chave, usuario.id]
      );
      if (!r.affectedRows) return res.status(409).json({ error: "Esta ocorrência já tem um responsável." });
      res.json({ ok: true });
    } catch (error) {
      console.error("[ocorrencias] erro interno:", { code: error && error.code, msg: error && error.message });
      res.status(500).json({ error: "Não foi possível concluir a operação." });
    }
  });

  return router;
};
