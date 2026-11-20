async function buscarPorHashParaAtualizar(db, tokenHash) {
  const [rows] = await db.execute(
    "SELECT id_convite, email, perfil, id_pessoa, expira_em, usado_em FROM CONVITE WHERE token_hash = ? LIMIT 1 FOR UPDATE",
    [tokenHash]
  );
  return rows[0] || null;
}

async function consumir(db, idConvite, idUsuario, agora = new Date()) {
  const [r] = await db.execute(
    "UPDATE CONVITE SET usado_em = ?, usado_por = ? WHERE id_convite = ? AND usado_em IS NULL AND expira_em > ?",
    [agora, idUsuario, idConvite, agora]
  );
  return r.affectedRows === 1;
}

async function inserir(db, { tokenHash, email, perfil, idPessoa, expiraEm, criadoPor }) {
  const [r] = await db.execute(
    "INSERT INTO CONVITE (token_hash, email, perfil, id_pessoa, expira_em, criado_por) VALUES (?, ?, ?, ?, ?, ?)",
    [tokenHash, email, perfil, idPessoa || null, expiraEm, criadoPor || null]
  );
  return r.insertId;
}

module.exports = { buscarPorHashParaAtualizar, consumir, inserir };
