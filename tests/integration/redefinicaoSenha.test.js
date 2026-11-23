jest.mock("mysql2/promise", () => ({ createPool: () => ({}) }));

const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../../src/server");
const { hashToken } = require("../../src/services/authService");

const TOKEN = "token-de-redefinicao";
const hash = bcrypt.hashSync("SenhaAntiga1", 4);
let state;
let calls;

function resetState(extra = {}) {
  state = { redef: null, alvo: { id_usuario: 5, perfil: "COLABORADOR", status: "ATIVO" }, login: null, ...extra };
  calls = [];
}

function redefValida(extra = {}) {
  return { id_redefinicao: 9, id_usuario: 5, expira_em: new Date(Date.now() + 3600000), usado_em: null, ...extra };
}

async function executar(sql, params = []) {
  calls.push({ sql, params });
  if (/FROM REDEFINICAO_SENHA/.test(sql)) return [state.redef ? [state.redef] : []];
  if (/UPDATE REDEFINICAO_SENHA/.test(sql)) return [{ affectedRows: 1 }];
  if (/INSERT INTO REDEFINICAO_SENHA/.test(sql)) return [{ insertId: 1 }];
  if (/senha_hash FROM USUARIO WHERE email/.test(sql) || /SELECT id_usuario, nome, email, senha_hash/.test(sql)) {
    return [state.login ? [state.login] : []];
  }
  if (/SELECT id_usuario, perfil, status FROM USUARIO/.test(sql)) return [state.alvo ? [state.alvo] : []];
  if (/FROM USUARIO u LEFT JOIN/.test(sql)) return [state.alvo ? [{ id_usuario: state.alvo.id_usuario, status: state.alvo.status, pode_registrar_administracao: 0 }] : []];
  return [{ affectedRows: 1 }];
}

function novaConexao() {
  return {
    execute: executar,
    query: async () => [[{}]],
    beginTransaction: async () => calls.push({ sql: "BEGIN", params: [] }),
    commit: async () => calls.push({ sql: "COMMIT", params: [] }),
    rollback: async () => calls.push({ sql: "ROLLBACK", params: [] }),
    release: () => {}
  };
}

beforeAll(() => { app.locals.pool = { getConnection: async () => novaConexao(), execute: executar, query: jest.fn() }; });
beforeEach(() => resetState());

const sqls = () => calls.map((c) => c.sql);
const redefinir = (body) => request(app).post("/api/login/redefinir-senha").send(body);

async function logarComo(perfil) {
  resetState({ login: { id_usuario: 1, nome: "Admin", email: "admin@teste.com", senha_hash: hash, perfil, status: "ATIVO", tentativas_falhas: 0, bloqueado_ate: null } });
  const agent = request.agent(app);
  const res = await agent.post("/api/login").send({ email: "admin@teste.com", senha: "SenhaAntiga1" });
  expect(res.status).toBe(200);
  calls = [];
  return agent;
}

test("token inexistente, expirado ou usado devolve a mesma resposta 400", async () => {
  const corpo = { token: TOKEN, senha: "NovaSenha123" };
  const inexistente = await redefinir(corpo);
  resetState({ redef: redefValida({ expira_em: new Date(Date.now() - 1000) }) });
  const expirado = await redefinir(corpo);
  resetState({ redef: redefValida({ usado_em: new Date() }) });
  const usado = await redefinir(corpo);
  for (const r of [inexistente, expirado, usado]) expect(r.status).toBe(400);
  expect(expirado.body.error).toBe(inexistente.body.error);
  expect(usado.body.error).toBe(inexistente.body.error);
  expect(sqls().some((q) => /UPDATE USUARIO SET senha_hash/.test(q))).toBe(false);
});

test("senha curta ou token ausente e recusado", async () => {
  expect((await redefinir({ token: TOKEN, senha: "curta" })).status).toBe(400);
  expect((await redefinir({ senha: "NovaSenha123" })).status).toBe(400);
});

test("token valido grava a nova senha com hash, consome o token e zera o bloqueio", async () => {
  resetState({ redef: redefValida() });
  const res = await redefinir({ token: TOKEN, senha: "NovaSenha123" });
  expect(res.status).toBe(200);
  const busca = calls.find((c) => /FROM REDEFINICAO_SENHA/.test(c.sql));
  expect(busca.params[0]).toBe(hashToken(TOKEN));
  const update = calls.find((c) => /UPDATE USUARIO SET senha_hash/.test(c.sql));
  expect(update.params[0]).not.toBe("NovaSenha123");
  expect(bcrypt.compareSync("NovaSenha123", update.params[0])).toBe(true);
  expect(update.sql).toMatch(/tentativas_falhas = 0/);
  expect(sqls().some((q) => /UPDATE REDEFINICAO_SENHA SET usado_em/.test(q))).toBe(true);
  expect(sqls()).toContain("COMMIT");
});

test("usuario inativo nao consegue redefinir a senha", async () => {
  resetState({ redef: redefValida(), alvo: { id_usuario: 5, perfil: "COLABORADOR", status: "INATIVO" } });
  const res = await redefinir({ token: TOKEN, senha: "NovaSenha123" });
  expect(res.status).toBe(400);
  expect(sqls().some((q) => /UPDATE USUARIO SET senha_hash/.test(q))).toBe(false);
});

test("ADMIN gera o link de redefinicao e somente o hash do token e gravado", async () => {
  const agent = await logarComo("ADMIN");
  state.alvo = { id_usuario: 5, perfil: "COLABORADOR", status: "ATIVO" };
  const res = await agent.post("/api/usuarios/5/redefinicao");
  expect(res.status).toBe(201);
  expect(res.body.token).toMatch(/^[a-f0-9]{64}$/);
  const insert = calls.find((c) => /INSERT INTO REDEFINICAO_SENHA/.test(c.sql));
  expect(insert.params[0]).toBe(hashToken(res.body.token));
  expect(insert.params[0]).not.toBe(res.body.token);
  expect(insert.params[1]).toBe(5);
});

test("gerar link para usuario inexistente ou inativo e recusado", async () => {
  const agent = await logarComo("ADMIN");
  state.alvo = null;
  expect((await agent.post("/api/usuarios/5/redefinicao")).status).toBe(404);
  state.alvo = { id_usuario: 5, perfil: "COLABORADOR", status: "INATIVO" };
  expect((await agent.post("/api/usuarios/5/redefinicao")).status).toBe(409);
  expect((await agent.post("/api/usuarios/abc/redefinicao")).status).toBe(404);
});

test("quem nao e ADMIN nao gera link de redefinicao", async () => {
  const agent = await logarComo("COLABORADOR");
  expect((await agent.post("/api/usuarios/5/redefinicao")).status).toBe(403);
  expect((await request(app).post("/api/usuarios/5/redefinicao")).status).toBe(401);
});
