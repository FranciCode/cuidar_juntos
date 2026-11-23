async function inserir(db, { tokenHash, idUsuario, expiraEm, criadoPor }) {
  const [r] = await db.execute(
    "INSERT INTO REDEFINICAO_SENHA (token_hash, id_usuario, expira_em, criado_por) VALUES (?, ?, ?, ?)",
    [tokenHash, idUsuario, expiraEm, criadoPor || null]
  );
  return r.insertId;
}

async function buscarPorHashParaAtualizar(db, tokenHash) {
  const [rows] = await db.execute(
    "SELECT id_redefinicao, id_usuario, expira_em, usado_em FROM REDEFINICAO_SENHA WHERE token_hash = ? LIMIT 1 FOR UPDATE",
    [tokenHash]
  );
  return rows[0] || null;
}

async function consumir(db, idRedefinicao, agora = new Date()) {
  const [r] = await db.execute(
    "UPDATE REDEFINICAO_SENHA SET usado_em = ? WHERE id_redefinicao = ? AND usado_em IS NULL AND expira_em > ?",
    [agora, idRedefinicao, agora]
  );
  return r.affectedRows === 1;
}

async function invalidarPendentes(db, idUsuario, agora = new Date()) {
  await db.execute(
    "UPDATE REDEFINICAO_SENHA SET usado_em = ? WHERE id_usuario = ? AND usado_em IS NULL",
    [agora, idUsuario]
  );
}

module.exports = { inserir, buscarPorHashParaAtualizar, consumir, invalidarPendentes };
