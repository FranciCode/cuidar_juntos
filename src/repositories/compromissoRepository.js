const CAMPOS = `c.id_compromisso, c.id_pessoa, p.nome AS pessoa, c.tipo, c.descricao,
  DATE_FORMAT(c.data_hora, '%Y-%m-%dT%H:%i:%s') AS data_hora, c.observacao`;

async function listar(db, idUsuario, idPessoa) {
  const params = [idUsuario];
  let filtro = "";
  if (idPessoa) {
    filtro = " AND c.id_pessoa = ?";
    params.push(idPessoa);
  }
  const [rows] = await db.execute(
    `SELECT ${CAMPOS}
     FROM COMPROMISSO c
     JOIN PESSOA_ASSISTIDA p ON p.id_pessoa = c.id_pessoa
     JOIN USUARIO_PESSOA up ON up.id_pessoa = c.id_pessoa AND up.id_usuario = ?
     WHERE 1 = 1${filtro}
     ORDER BY c.data_hora ASC, c.id_compromisso ASC`,
    params
  );
  return rows;
}

async function buscarDetalhe(db, id) {
  const [rows] = await db.execute(
    `SELECT ${CAMPOS}
     FROM COMPROMISSO c
     JOIN PESSOA_ASSISTIDA p ON p.id_pessoa = c.id_pessoa
     WHERE c.id_compromisso = ?`,
    [id]
  );
  return rows[0] || null;
}

async function buscarBloqueado(db, id) {
  const [rows] = await db.execute(
    "SELECT id_compromisso, id_pessoa FROM COMPROMISSO WHERE id_compromisso = ? FOR UPDATE",
    [id]
  );
  return rows[0] || null;
}

async function existeConflito(db, idPessoa, dataHora, ignorarId) {
  const [rows] = await db.execute(
    "SELECT id_compromisso FROM COMPROMISSO WHERE id_pessoa = ? AND data_hora = ? AND id_compromisso <> ? LIMIT 1",
    [idPessoa, dataHora, ignorarId || 0]
  );
  return rows.length > 0;
}

async function inserir(db, idPessoa, tipo, descricao, dataHora, observacao) {
  const [result] = await db.execute(
    "INSERT INTO COMPROMISSO (id_pessoa, tipo, descricao, data_hora, observacao) VALUES (?, ?, ?, ?, ?)",
    [idPessoa, tipo, descricao, dataHora, observacao]
  );
  return result.insertId;
}

async function atualizar(db, id, tipo, descricao, dataHora, observacao) {
  await db.execute(
    "UPDATE COMPROMISSO SET tipo = ?, descricao = ?, data_hora = ?, observacao = ? WHERE id_compromisso = ?",
    [tipo, descricao, dataHora, observacao, id]
  );
}

async function excluir(db, id) {
  await db.execute("DELETE FROM COMPROMISSO WHERE id_compromisso = ?", [id]);
}

module.exports = { listar, buscarDetalhe, buscarBloqueado, existeConflito, inserir, atualizar, excluir };
