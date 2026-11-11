async function registrar(db, idUsuario, acao, entidade, idRegistro, detalhes = null) {
  await db.execute(
    "INSERT INTO HISTORICO (id_usuario, acao, entidade, id_registro, detalhes) VALUES (?, ?, ?, ?, ?)",
    [idUsuario, acao, entidade, idRegistro, detalhes]
  );
}

module.exports = { registrar };
