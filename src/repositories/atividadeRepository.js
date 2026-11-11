const COLUNAS = `a.id_atividade, a.id_pessoa, a.titulo, a.descricao,
  DATE_FORMAT(a.data_hora, '%Y-%m-%dT%H:%i') AS data_hora, a.status, a.criado_por,
  r.id_usuario AS id_responsavel, u.nome AS responsavel`;

const JOINS = `FROM ATIVIDADE a
  LEFT JOIN RESPONSABILIDADE r ON r.id_atividade = a.id_atividade AND r.liberada_em IS NULL
  LEFT JOIN USUARIO u ON u.id_usuario = r.id_usuario`;

async function listar(db, idUsuario, status) {
  const params = [idUsuario];
  let filtro = "";
  if (status) {
    filtro = " AND a.status = ?";
    params.push(status);
  }
  const [rows] = await db.execute(
    `SELECT ${COLUNAS} ${JOINS}
     JOIN USUARIO_PESSOA up ON up.id_pessoa = a.id_pessoa
     WHERE up.id_usuario = ?${filtro} ORDER BY a.data_hora IS NULL, a.data_hora, a.id_atividade`,
    params
  );
  return rows;
}

async function buscarBloqueada(db, id) {
  const [rows] = await db.execute(
    "SELECT id_atividade, id_pessoa, status FROM ATIVIDADE WHERE id_atividade = ? LIMIT 1 FOR UPDATE",
    [id]
  );
  return rows[0] || null;
}

async function buscarDetalhe(db, id) {
  const [rows] = await db.execute(`SELECT ${COLUNAS} ${JOINS} WHERE a.id_atividade = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

async function responsavelAtivo(db, id) {
  const [rows] = await db.execute(
    "SELECT id_responsabilidade, id_usuario FROM RESPONSABILIDADE WHERE id_atividade = ? AND liberada_em IS NULL AND concluida_em IS NULL LIMIT 1",
    [id]
  );
  return rows[0] || null;
}

async function inserir(db, idPessoa, titulo, descricao, dataHora, criadoPor) {
  const [result] = await db.execute(
    "INSERT INTO ATIVIDADE (id_pessoa, titulo, descricao, data_hora, status, criado_por) VALUES (?, ?, ?, ?, 'PENDENTE', ?)",
    [idPessoa, titulo, descricao, dataHora, criadoPor]
  );
  return result.insertId;
}

async function atualizarDados(db, id, titulo, descricao, dataHora) {
  await db.execute("UPDATE ATIVIDADE SET titulo = ?, descricao = ?, data_hora = ? WHERE id_atividade = ?", [
    titulo, descricao, dataHora, id
  ]);
}

async function mudarStatus(db, id, de, para) {
  const [result] = await db.execute("UPDATE ATIVIDADE SET status = ? WHERE id_atividade = ? AND status = ?", [
    para, id, de
  ]);
  return result.affectedRows;
}

async function inserirResponsabilidade(db, idAtividade, idUsuario) {
  await db.execute("INSERT INTO RESPONSABILIDADE (id_atividade, id_usuario, assumida_em) VALUES (?, ?, NOW())", [
    idAtividade, idUsuario
  ]);
}

async function liberarResponsabilidade(db, idAtividade) {
  await db.execute(
    "UPDATE RESPONSABILIDADE SET liberada_em = NOW() WHERE id_atividade = ? AND liberada_em IS NULL AND concluida_em IS NULL",
    [idAtividade]
  );
}

async function concluirResponsabilidade(db, idAtividade) {
  await db.execute(
    "UPDATE RESPONSABILIDADE SET concluida_em = NOW() WHERE id_atividade = ? AND liberada_em IS NULL AND concluida_em IS NULL",
    [idAtividade]
  );
}

module.exports = {
  listar, buscarBloqueada, buscarDetalhe, responsavelAtivo, inserir, atualizarDados, mudarStatus,
  inserirResponsabilidade, liberarResponsabilidade, concluirResponsabilidade
};
