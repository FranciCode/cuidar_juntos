async function contarAtividadesPorStatus(db, idUsuario) {
  const sql = `SELECT a.status AS status, COUNT(*) AS total
    FROM ATIVIDADE a
    JOIN USUARIO_PESSOA up ON up.id_pessoa = a.id_pessoa AND up.id_usuario = ?
    WHERE a.status IN ('PENDENTE', 'ASSUMIDA', 'CONCLUIDA')
    GROUP BY a.status`;
  const [rows] = await db.execute(sql, [idUsuario]);
  return rows;
}

async function listarProximosCompromissos(db, idUsuario) {
  const sql = `SELECT c.id_compromisso AS id, c.descricao AS titulo, c.data_hora AS data_hora,
      c.tipo AS tipo, c.id_pessoa AS id_pessoa, p.nome AS pessoa
    FROM COMPROMISSO c
    JOIN USUARIO_PESSOA up ON up.id_pessoa = c.id_pessoa AND up.id_usuario = ?
    JOIN PESSOA_ASSISTIDA p ON p.id_pessoa = c.id_pessoa
    WHERE c.data_hora >= NOW()
    ORDER BY c.data_hora ASC
    LIMIT 5`;
  const [rows] = await db.execute(sql, [idUsuario]);
  return rows;
}

module.exports = { contarAtividadesPorStatus, listarProximosCompromissos };
