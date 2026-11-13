const COLUNAS = "m.id_medicamento, m.id_pessoa, m.nome, m.instrucao_cadastrada";

async function listar(db, idUsuario, idPessoa) {
  const params = [idUsuario];
  let filtro = "";
  if (idPessoa) {
    filtro = " AND m.id_pessoa = ?";
    params.push(idPessoa);
  }
  const [rows] = await db.execute(
    `SELECT ${COLUNAS}, up.pode_registrar_administracao
     FROM MEDICAMENTO m
     JOIN USUARIO_PESSOA up ON up.id_pessoa = m.id_pessoa
     WHERE up.id_usuario = ?${filtro} ORDER BY m.nome, m.id_medicamento`,
    params
  );
  return rows;
}

async function buscar(db, id) {
  const [rows] = await db.execute(
    `SELECT ${COLUNAS} FROM MEDICAMENTO m WHERE m.id_medicamento = ? LIMIT 1 FOR UPDATE`,
    [id]
  );
  return rows[0] || null;
}

async function buscarDetalhe(db, id) {
  const [rows] = await db.execute(`SELECT ${COLUNAS} FROM MEDICAMENTO m WHERE m.id_medicamento = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

async function inserir(db, idPessoa, nome, instrucao) {
  const [res] = await db.execute(
    "INSERT INTO MEDICAMENTO (id_pessoa, nome, instrucao_cadastrada) VALUES (?, ?, ?)",
    [idPessoa, nome, instrucao]
  );
  return res.insertId;
}

async function atualizar(db, id, nome, instrucao) {
  await db.execute("UPDATE MEDICAMENTO SET nome = ?, instrucao_cadastrada = ? WHERE id_medicamento = ?", [nome, instrucao, id]);
}

async function excluir(db, id) {
  await db.execute("DELETE FROM MEDICAMENTO WHERE id_medicamento = ?", [id]);
}

async function contarAdministracoes(db, id) {
  const [rows] = await db.execute("SELECT COUNT(*) AS total FROM ADMINISTRACAO WHERE id_medicamento = ?", [id]);
  return Number(rows[0] && rows[0].total) || 0;
}

async function buscarVinculo(db, idPessoa, idUsuario) {
  const [rows] = await db.execute(
    "SELECT up.pode_registrar_administracao FROM USUARIO_PESSOA up WHERE up.id_pessoa = ? AND up.id_usuario = ? LIMIT 1",
    [idPessoa, idUsuario]
  );
  return rows[0] || null;
}

async function inserirAdministracao(db, idMedicamento, idUsuario, dataHora, observacao) {
  const [res] = await db.execute(
    "INSERT INTO ADMINISTRACAO (id_medicamento, id_usuario, data_hora, observacao) VALUES (?, ?, ?, ?)",
    [idMedicamento, idUsuario, dataHora, observacao]
  );
  return res.insertId;
}

const COLUNAS_ADM = `a.id_administracao, a.id_medicamento, a.id_usuario, u.nome AS registrado_por,
  DATE_FORMAT(a.data_hora, '%Y-%m-%dT%H:%i') AS data_hora, a.observacao`;

async function buscarAdministracao(db, id) {
  const [rows] = await db.execute(
    `SELECT ${COLUNAS_ADM} FROM ADMINISTRACAO a JOIN USUARIO u ON u.id_usuario = a.id_usuario WHERE a.id_administracao = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function listarAdministracoes(db, idMedicamento) {
  const [rows] = await db.execute(
    `SELECT ${COLUNAS_ADM} FROM ADMINISTRACAO a JOIN USUARIO u ON u.id_usuario = a.id_usuario
     WHERE a.id_medicamento = ? ORDER BY a.data_hora DESC, a.id_administracao DESC`,
    [idMedicamento]
  );
  return rows;
}

module.exports = {
  listar, buscar, buscarDetalhe, inserir, atualizar, excluir, contarAdministracoes,
  buscarVinculo, inserirAdministracao, buscarAdministracao, listarAdministracoes
};
