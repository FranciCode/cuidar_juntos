async function contarAtividadesPorStatus(db, idUsuario) {
  const [rows] = await db.execute(
    `SELECT a.status AS status, COUNT(*) AS total
     FROM ATIVIDADE a
     JOIN USUARIO_PESSOA up ON up.id_pessoa = a.id_pessoa AND up.id_usuario = ?
     WHERE a.status IN ('PENDENTE', 'ASSUMIDA', 'CONCLUIDA')
     GROUP BY a.status`,
    [idUsuario]
  );
  return rows;
}

async function proximosCompromissos(db, idUsuario, limite) {
  const [rows] = await db.execute(
    `SELECT c.id_compromisso AS id, c.tipo AS tipo, c.descricao AS titulo, c.data_hora AS data_hora,
       c.id_pessoa AS id_pessoa, p.nome AS pessoa
     FROM COMPROMISSO c
     JOIN USUARIO_PESSOA up ON up.id_pessoa = c.id_pessoa AND up.id_usuario = ?
     JOIN PESSOA_ASSISTIDA p ON p.id_pessoa = c.id_pessoa
     WHERE c.data_hora >= NOW()
     ORDER BY c.data_hora ASC
     LIMIT ${Number(limite)}`,
    [idUsuario]
  );
  return rows;
}

module.exports = { contarAtividadesPorStatus, proximosCompromissos };
