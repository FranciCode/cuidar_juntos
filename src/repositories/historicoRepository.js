async function registrar(db, { idUsuario, acao, idRegistro, detalhes }) {
  await db.execute(
    "INSERT INTO HISTORICO (id_usuario, acao, entidade, id_registro, data_hora, detalhes) VALUES (?, ?, 'USUARIO', ?, NOW(), ?)",
    [idUsuario, acao, idRegistro, detalhes || null]
  );
}

module.exports = { registrar };
