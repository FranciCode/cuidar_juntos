async function registrar(db, { idUsuario, acao, idRegistro, detalhes }) {
  await db.execute(
    "INSERT INTO HISTORICO (id_usuario, acao, entidade, id_registro, data_hora, detalhes) VALUES (?, ?, 'USUARIO', ?, NOW(), ?)",
    [idUsuario, acao, idRegistro, detalhes || null]
  );
}

async function registrarEntidade(db, idUsuario, acao, entidade, idRegistro, detalhes) {
  await db.execute(
    "INSERT INTO HISTORICO (id_usuario, acao, entidade, id_registro, data_hora, detalhes) VALUES (?, ?, ?, ?, NOW(), ?)",
    [idUsuario, acao, entidade, idRegistro, detalhes || null]
  );
}

const BASE_VISIVEL = `
  FROM HISTORICO h
  JOIN USUARIO u ON u.id_usuario = h.id_usuario
  LEFT JOIN ATIVIDADE a ON h.entidade = 'ATIVIDADE' AND a.id_atividade = h.id_registro
  LEFT JOIN COMPROMISSO c ON h.entidade = 'COMPROMISSO' AND c.id_compromisso = h.id_registro
  LEFT JOIN MEDICAMENTO m ON h.entidade = 'MEDICAMENTO' AND m.id_medicamento = h.id_registro
  LEFT JOIN ADMINISTRACAO ad ON h.entidade = 'ADMINISTRACAO' AND ad.id_administracao = h.id_registro
  LEFT JOIN MEDICAMENTO m2 ON m2.id_medicamento = ad.id_medicamento
  LEFT JOIN USUARIO_PESSOA up ON up.id_usuario = ?
    AND up.id_pessoa = COALESCE(a.id_pessoa, c.id_pessoa, m.id_pessoa, m2.id_pessoa)
  WHERE (up.id_pessoa IS NOT NULL OR (COALESCE(a.id_pessoa, c.id_pessoa, m.id_pessoa, m2.id_pessoa) IS NULL AND ? = 1))`;

async function listarVisiveis(db, { idUsuario, admin, limite, deslocamento }) {
  const ehAdmin = admin ? 1 : 0;
  const [totais] = await db.execute(`SELECT COUNT(*) AS total ${BASE_VISIVEL}`, [idUsuario, ehAdmin]);
  const [registros] = await db.execute(
    `SELECT h.acao AS acao, h.entidade AS entidade, h.id_registro AS id_registro,
       u.nome AS responsavel, h.data_hora AS data_hora, h.detalhes AS detalhes
     ${BASE_VISIVEL}
     ORDER BY h.data_hora DESC, h.id_historico DESC
     LIMIT ${Number(limite)} OFFSET ${Number(deslocamento)}`,
    [idUsuario, ehAdmin]
  );
  return { registros, total: Number(totais[0] ? totais[0].total : 0) };
}

module.exports = { registrar, registrarEntidade, listarVisiveis };
