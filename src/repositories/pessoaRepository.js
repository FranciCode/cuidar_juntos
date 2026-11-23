const FICHA_CAMPOS = ["cpf", "rg", "cartao_sus", "sexo", "estado_civil", "endereco", "emergencia_nome", "emergencia_parentesco", "emergencia_telefone", "tipo_sanguineo", "alergias", "condicoes_saude", "medicamentos_continuos", "restricoes"];

const COLUNAS = `p.id_pessoa, p.nome, p.data_nascimento, p.consentimento_registrado, p.data_consentimento, p.status,
  ${FICHA_CAMPOS.map((c) => "p." + c).join(", ")}, p.atualizado_em,
  (SELECT nome FROM USUARIO WHERE id_usuario = p.atualizado_por) AS atualizado_por_nome`;

async function existe(db, idPessoa) {
  const [rows] = await db.execute("SELECT id_pessoa FROM PESSOA_ASSISTIDA WHERE id_pessoa = ? LIMIT 1", [idPessoa]);
  return rows.length > 0;
}

async function temVinculo(db, idPessoa, idUsuario) {
  const [rows] = await db.execute(
    "SELECT up.id_pessoa FROM USUARIO_PESSOA up WHERE up.id_pessoa = ? AND up.id_usuario = ? LIMIT 1",
    [idPessoa, idUsuario]
  );
  return rows.length > 0;
}

async function listarAtivasDoUsuario(db, idUsuario) {
  const [rows] = await db.execute(
    `SELECT ${COLUNAS} FROM PESSOA_ASSISTIDA p
     JOIN USUARIO_PESSOA up ON up.id_pessoa = p.id_pessoa
     WHERE up.id_usuario = ? AND p.status = 'ATIVO' ORDER BY p.nome`,
    [idUsuario]
  );
  return rows;
}

async function listarDoUsuario(db, idUsuario) {
  const [rows] = await db.execute(
    `SELECT ${COLUNAS} FROM PESSOA_ASSISTIDA p
     JOIN USUARIO_PESSOA up ON up.id_pessoa = p.id_pessoa
     WHERE up.id_usuario = ? ORDER BY p.nome`,
    [idUsuario]
  );
  return rows;
}

async function buscarDoUsuario(db, idPessoa, idUsuario) {
  const [rows] = await db.execute(
    `SELECT ${COLUNAS} FROM PESSOA_ASSISTIDA p
     JOIN USUARIO_PESSOA up ON up.id_pessoa = p.id_pessoa
     WHERE p.id_pessoa = ? AND up.id_usuario = ? LIMIT 1`,
    [idPessoa, idUsuario]
  );
  return rows[0] || null;
}

async function inserir(db, nome, dataNascimento, ficha = {}, idUsuario = null) {
  const [result] = await db.execute(
    `INSERT INTO PESSOA_ASSISTIDA (nome, data_nascimento, consentimento_registrado, data_consentimento, status, ${FICHA_CAMPOS.join(", ")}, atualizado_em, atualizado_por)
     VALUES (?, ?, 1, NOW(), 'ATIVO', ${FICHA_CAMPOS.map(() => "?").join(", ")}, NOW(), ?)`,
    [nome, dataNascimento, ...FICHA_CAMPOS.map((c) => ficha[c] ?? null), idUsuario]
  );
  return result.insertId;
}

async function listarUsuariosAtivos(db) {
  const [rows] = await db.execute("SELECT id_usuario, perfil FROM USUARIO WHERE status = 'ATIVO' FOR UPDATE");
  return rows;
}

async function vincular(db, idUsuario, idPessoa, podeRegistrar) {
  await db.execute(
    "INSERT INTO USUARIO_PESSOA (id_usuario, id_pessoa, pode_registrar_administracao) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id_usuario = id_usuario",
    [idUsuario, idPessoa, podeRegistrar ? 1 : 0]
  );
}

async function atualizar(db, idPessoa, idUsuario, nome, dataNascimento, ficha = {}) {
  await db.execute(
    `UPDATE PESSOA_ASSISTIDA p
     JOIN USUARIO_PESSOA up ON up.id_pessoa = p.id_pessoa
     SET p.nome = ?, p.data_nascimento = ?, ${FICHA_CAMPOS.map((c) => `p.${c} = ?`).join(", ")},
       p.atualizado_em = NOW(), p.atualizado_por = ?
     WHERE p.id_pessoa = ? AND up.id_usuario = ?`,
    [nome, dataNascimento, ...FICHA_CAMPOS.map((c) => ficha[c] ?? null), idUsuario, idPessoa, idUsuario]
  );
}

async function atualizarStatus(db, idPessoa, idUsuario, status) {
  await db.execute(
    `UPDATE PESSOA_ASSISTIDA p
     JOIN USUARIO_PESSOA up ON up.id_pessoa = p.id_pessoa
     SET p.status = ?
     WHERE p.id_pessoa = ? AND up.id_usuario = ?`,
    [status, idPessoa, idUsuario]
  );
}

async function contarPendentes(db, idPessoa, idUsuario) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS total FROM ATIVIDADE a
     JOIN USUARIO_PESSOA up ON up.id_pessoa = a.id_pessoa
     WHERE a.id_pessoa = ? AND up.id_usuario = ? AND a.status = 'PENDENTE'`,
    [idPessoa, idUsuario]
  );
  return Number(rows[0].total);
}

module.exports = {
  existe, temVinculo, listarAtivasDoUsuario, listarDoUsuario, buscarDoUsuario, inserir,
  listarUsuariosAtivos, vincular, atualizar, atualizarStatus, contarPendentes
};
