async function buscarPorEmail(db, email) {
  const [rows] = await db.execute(
    "SELECT id_usuario, nome, email, senha_hash, perfil, status, tentativas_falhas, bloqueado_ate FROM USUARIO WHERE email = ? LIMIT 1",
    [email]
  );
  return rows[0] || null;
}

async function registrarFalha(db, idUsuario, tentativas, bloqueadoAte) {
  await db.execute(
    "UPDATE USUARIO SET tentativas_falhas = ?, bloqueado_ate = ? WHERE id_usuario = ?",
    [tentativas, bloqueadoAte, idUsuario]
  );
}

async function zerarFalhas(db, idUsuario) {
  await db.execute(
    "UPDATE USUARIO SET tentativas_falhas = 0, bloqueado_ate = NULL WHERE id_usuario = ?",
    [idUsuario]
  );
}

const BASE = `SELECT u.id_usuario, u.nome, u.email, u.perfil, u.status,
  COALESCE(MAX(up.pode_registrar_administracao), 0) AS pode_registrar_administracao
  FROM USUARIO u LEFT JOIN USUARIO_PESSOA up ON up.id_usuario = u.id_usuario`;

function normalizar(row) {
  return row ? { ...row, pode_registrar_administracao: !!row.pode_registrar_administracao } : null;
}

async function listar(db) {
  const [rows] = await db.execute(`${BASE} GROUP BY u.id_usuario ORDER BY u.nome`, []);
  return rows.map(normalizar);
}

async function buscarPorId(db, id) {
  const [rows] = await db.execute(`${BASE} WHERE u.id_usuario = ? GROUP BY u.id_usuario`, [id]);
  return normalizar(rows[0]);
}

async function buscarPorIdParaAtualizar(db, id) {
  const [rows] = await db.execute("SELECT id_usuario, perfil, status FROM USUARIO WHERE id_usuario = ? FOR UPDATE", [id]);
  return rows[0] || null;
}

async function emailExiste(db, email) {
  const [rows] = await db.execute("SELECT id_usuario FROM USUARIO WHERE email = ? LIMIT 1", [email]);
  return !!rows[0];
}

async function contarAdminsAtivosParaAtualizar(db) {
  const [rows] = await db.execute("SELECT id_usuario FROM USUARIO WHERE perfil = 'ADMIN' AND status = 'ATIVO' FOR UPDATE", []);
  return rows.length;
}

async function pessoaUnica(db) {
  const [rows] = await db.execute("SELECT id_pessoa FROM PESSOA_ASSISTIDA ORDER BY id_pessoa LIMIT 1", []);
  return rows[0] ? rows[0].id_pessoa : null;
}

async function inserir(db, { nome, email, senhaHash, perfil }) {
  const [r] = await db.execute(
    "INSERT INTO USUARIO (nome, email, senha_hash, perfil, status) VALUES (?, ?, ?, ?, 'ATIVO')",
    [nome, email, senhaHash, perfil]
  );
  return r.insertId;
}

async function vincularPessoa(db, idUsuario, idPessoa, pode) {
  await db.execute(
    "INSERT INTO USUARIO_PESSOA (id_usuario, id_pessoa, pode_registrar_administracao) VALUES (?, ?, ?)",
    [idUsuario, idPessoa, pode ? 1 : 0]
  );
}

async function atualizar(db, id, { nome, perfil }) {
  await db.execute("UPDATE USUARIO SET nome = ?, perfil = ? WHERE id_usuario = ?", [nome, perfil, id]);
}

async function atualizarPermissao(db, id, pode) {
  await db.execute("UPDATE USUARIO_PESSOA SET pode_registrar_administracao = ? WHERE id_usuario = ?", [pode ? 1 : 0, id]);
}

async function atualizarStatus(db, id, status) {
  await db.execute("UPDATE USUARIO SET status = ? WHERE id_usuario = ?", [status, id]);
}

module.exports = { buscarPorEmail, registrarFalha, zerarFalhas, listar, buscarPorId, buscarPorIdParaAtualizar, emailExiste, contarAdminsAtivosParaAtualizar, pessoaUnica, inserir, vincularPessoa, atualizar, atualizarPermissao, atualizarStatus };
