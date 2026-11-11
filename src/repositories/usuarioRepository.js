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

const CAMPOS = "id_usuario, nome, email, perfil, status, criado_em";

async function listar(db) {
  const [rows] = await db.execute(`SELECT ${CAMPOS} FROM USUARIO ORDER BY nome`);
  return rows;
}

async function buscarPorId(db, id, paraAtualizar = false) {
  const [rows] = await db.execute(
    `SELECT ${CAMPOS} FROM USUARIO WHERE id_usuario = ? LIMIT 1${paraAtualizar ? " FOR UPDATE" : ""}`,
    [id]
  );
  return rows[0] || null;
}

async function contarAdminsAtivos(db) {
  const [rows] = await db.execute(
    "SELECT id_usuario FROM USUARIO WHERE perfil = 'ADMIN' AND status = 'ATIVO' FOR UPDATE"
  );
  return rows.length;
}

async function inserir(db, nome, email, senhaHash, perfil) {
  const [result] = await db.execute(
    "INSERT INTO USUARIO (nome, email, senha_hash, perfil, status) VALUES (?, ?, ?, ?, 'ATIVO')",
    [nome, email, senhaHash, perfil]
  );
  return result.insertId;
}

async function vincularPessoaExistente(db, idUsuario, podeRegistrar) {
  await db.execute(
    "INSERT INTO USUARIO_PESSOA (id_usuario, id_pessoa, pode_registrar_administracao) SELECT ?, id_pessoa, ? FROM PESSOA_ASSISTIDA ORDER BY id_pessoa LIMIT 1",
    [idUsuario, podeRegistrar ? 1 : 0]
  );
}

async function atualizar(db, id, nome, perfil) {
  await db.execute("UPDATE USUARIO SET nome = ?, perfil = ? WHERE id_usuario = ?", [nome, perfil, id]);
}

async function atualizarPermissao(db, id, podeRegistrar) {
  await db.execute(
    "UPDATE USUARIO_PESSOA SET pode_registrar_administracao = ? WHERE id_usuario = ?",
    [podeRegistrar ? 1 : 0, id]
  );
}

async function atualizarStatus(db, id, status) {
  await db.execute("UPDATE USUARIO SET status = ? WHERE id_usuario = ?", [status, id]);
}

module.exports = {
  buscarPorEmail, registrarFalha, zerarFalhas, listar, buscarPorId, contarAdminsAtivos, inserir,
  vincularPessoaExistente, atualizar, atualizarPermissao, atualizarStatus
};
