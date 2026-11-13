async function listarAtividades(db, idUsuario, { inicio, fim, status }) {
  let sql = `SELECT 'ATIVIDADE' AS origem, a.id_atividade AS id, a.titulo AS titulo, a.data_hora AS data_hora,
      a.status AS status, a.id_pessoa AS id_pessoa, p.nome AS pessoa
    FROM ATIVIDADE a
    JOIN USUARIO_PESSOA up ON up.id_pessoa = a.id_pessoa AND up.id_usuario = ?
    JOIN PESSOA_ASSISTIDA p ON p.id_pessoa = a.id_pessoa
    WHERE 1 = 1`;
  const params = [idUsuario];
  if (status) {
    sql += " AND a.status = ?";
    params.push(status);
  }
  if (inicio || fim) {
    sql += " AND a.data_hora IS NOT NULL";
    if (inicio) {
      sql += " AND a.data_hora >= ?";
      params.push(inicio);
    }
    if (fim) {
      sql += " AND a.data_hora <= ?";
      params.push(fim);
    }
  }
  const [rows] = await db.execute(sql, params);
  return rows;
}

async function listarCompromissos(db, idUsuario, { inicio, fim }) {
  let sql = `SELECT 'COMPROMISSO' AS origem, c.id_compromisso AS id, c.descricao AS titulo, c.data_hora AS data_hora,
      NULL AS status, c.id_pessoa AS id_pessoa, p.nome AS pessoa
    FROM COMPROMISSO c
    JOIN USUARIO_PESSOA up ON up.id_pessoa = c.id_pessoa AND up.id_usuario = ?
    JOIN PESSOA_ASSISTIDA p ON p.id_pessoa = c.id_pessoa
    WHERE 1 = 1`;
  const params = [idUsuario];
  if (inicio) {
    sql += " AND c.data_hora >= ?";
    params.push(inicio);
  }
  if (fim) {
    sql += " AND c.data_hora <= ?";
    params.push(fim);
  }
  const [rows] = await db.execute(sql, params);
  return rows;
}

module.exports = { listarAtividades, listarCompromissos };
