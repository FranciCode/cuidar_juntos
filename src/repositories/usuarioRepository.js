async function buscarPorEmail(db, email) {
  const [rows] = await db.execute(
    "SELECT id_usuario, nome, email, senha_hash, perfil, status, tentativas_falhas, bloqueado_ate FROM USUARIO WHERE email = ? LIMIT 1",
    [email]
  );
  return rows[0] || null;
}

async function registrarFalha(db, idUsuario, tentativas, bloqueadoAte) {
  await db.execute(
    "UPDATE USUARIO SET tentativas_falhas = ?, bloqueado_ate = ? WHERE id_usuario = ?",
    [tentativas, bloqueadoAte, idUsuario]
  );
}

async function zerarFalhas(db, idUsuario) {
  await db.execute(
    "UPDATE USUARIO SET tentativas_falhas = 0, bloqueado_ate = NULL WHERE id_usuario = ?",
    [idUsuario]
  );
}

module.exports = { buscarPorEmail, registrarFalha, zerarFalhas };
