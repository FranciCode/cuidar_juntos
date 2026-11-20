jest.mock("mysql2/promise", () => ({ createPool: () => ({}) }));

const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../../src/server");
const { hashToken } = require("../../src/services/authService");

const hash = bcrypt.hashSync("SenhaCorreta1", 4);
const TOKEN = "token-de-teste";
let state;
let calls;
let lockChain;

function resetState(extra = {}) {
  state = { admin: false, emailExiste: false, existente: null, convite: null, lockOk: 1, falhaInsert: false, ...extra };
  calls = [];
  lockChain = Promise.resolve();
}

function conviteValido(extra = {}) {
  return { id_convite: 7, email: "novo@teste.com", perfil: "COLABORADOR", id_pessoa: 3, expira_em: new Date(Date.now() + 3600000), usado_em: null, ...extra };
}

async function executar(sql, params = []) {
  calls.push({ sql, params });
  if (/FROM CONVITE/.test(sql)) return [state.convite ? [state.convite] : []];
  if (/UPDATE CONVITE/.test(sql)) return [{ affectedRows: 1 }];
  if (/INSERT INTO USUARIO_PESSOA/.test(sql)) return [{}];
  if (/INSERT INTO USUARIO /.test(sql)) {
    if (state.falhaInsert) throw new Error("falha");
    if (params[3] === "ADMIN") state.admin = true;
    return [{ insertId: 10 }];
  }
  if (/senha_hash/.test(sql)) return [state.existente ? [state.existente] : []];
  if (/perfil = 'ADMIN'/.test(sql)) return [state.admin ? [{ id_usuario: 1 }] : []];
  if (/SELECT id_usuario FROM USUARIO WHERE email/.test(sql)) return [state.emailExiste ? [{ id_usuario: 2 }] : []];
  if (/FROM PESSOA_ASSISTIDA/.test(sql)) return [[{ id_pessoa: 1 }]];
  return [{}];
}

function novaConexao() {
  let liberarLock = null;
  return {
    execute: executar,
    query: async (sql) => {
      calls.push({ sql, params: [] });
      if (/GET_LOCK/.test(sql)) {
        if (state.lockOk !== 1) return [[{ ok: 0 }]];
        const anterior = lockChain;
        lockChain = new Promise((resolve) => { liberarLock = resolve; });
        await anterior;
        return [[{ ok: 1 }]];
      }
      if (/RELEASE_LOCK/.test(sql) && liberarLock) liberarLock();
      return [[{}]];
    },
    beginTransaction: async () => calls.push({ sql: "BEGIN", params: [] }),
    commit: async () => calls.push({ sql: "COMMIT", params: [] }),
    rollback: async () => calls.push({ sql: "ROLLBACK", params: [] }),
    release: () => calls.push({ sql: "RELEASE_CONN", params: [] })
  };
}

beforeAll(() => { app.locals.pool = { getConnection: async () => novaConexao(), execute: executar, query: jest.fn() }; });
beforeEach(() => resetState());

const post = (body) => request(app).post("/api/login/cadastro").send(body);
const base = { nome: "Novo", email: "novo@teste.com", senha: "SenhaCorreta1" };
const sqls = () => calls.map((c) => c.sql);

test("primeiro cadastro publico vira ADMIN mesmo com perfil enviado pelo cliente", async () => {
  const res = await post({ ...base, perfil: "COLABORADOR" });
  expect(res.status).toBe(201);
  expect(res.body.user.perfil).toBe("ADMIN");
  const insert = calls.find((c) => /INSERT INTO USUARIO /.test(c.sql));
  expect(insert.params[3]).toBe("ADMIN");
  expect(sqls().some((s) => /GET_LOCK/.test(s))).toBe(true);
});

test("a trava e liberada na mesma conexao, depois do commit", async () => {
  await post(base);
  const s = sqls();
  expect(s.indexOf("COMMIT")).toBeLessThan(s.findIndex((q) => /RELEASE_LOCK/.test(q)));
  expect(s.findIndex((q) => /RELEASE_LOCK/.test(q))).toBeLessThan(s.indexOf("RELEASE_CONN"));
});

test("a trava e liberada em caso de erro", async () => {
  resetState({ falhaInsert: true });
  const res = await post(base);
  expect(res.status).toBe(500);
  expect(sqls()).toContain("ROLLBACK");
  expect(sqls().some((q) => /RELEASE_LOCK/.test(q))).toBe(true);
  expect(sqls()).toContain("RELEASE_CONN");
});

test("sem convite apos existir administrador retorna 403 e nao cria usuario", async () => {
  resetState({ admin: true });
  const res = await post({ ...base, perfil: "ADMIN" });
  expect(res.status).toBe(403);
  expect(sqls().some((q) => /INSERT INTO USUARIO /.test(q))).toBe(false);
});

test("cadastros simultaneos criam apenas um administrador", async () => {
  const [a, b] = await Promise.all([post(base), post({ ...base, email: "outro@teste.com" })]);
  expect([a.status, b.status].sort()).toEqual([201, 403]);
  expect(calls.filter((c) => /INSERT INTO USUARIO /.test(c.sql))).toHaveLength(1);
});

test("falha ao obter a trava retorna 503 sem cadastrar", async () => {
  resetState({ lockOk: 0 });
  const res = await post(base);
  expect(res.status).toBe(503);
  expect(sqls().some((q) => /INSERT INTO USUARIO /.test(q))).toBe(false);
  expect(sqls().some((q) => /RELEASE_LOCK/.test(q))).toBe(false);
});

test("convite inexistente, expirado ou usado devolve a mesma resposta 400", async () => {
  const corpo = { ...base, convite: TOKEN };
  const inexistente = await post(corpo);
  resetState({ convite: conviteValido({ expira_em: new Date(Date.now() - 1000) }) });
  const expirado = await post(corpo);
  resetState({ convite: conviteValido({ usado_em: new Date() }) });
  const usado = await post(corpo);
  for (const r of [inexistente, expirado, usado]) expect(r.status).toBe(400);
  expect(expirado.body.error).toBe(inexistente.body.error);
  expect(usado.body.error).toBe(inexistente.body.error);
  expect(sqls().some((q) => /INSERT INTO USUARIO /.test(q))).toBe(false);
});

test("convite com e-mail diferente do informado e recusado", async () => {
  resetState({ convite: conviteValido() });
  const res = await post({ ...base, email: "outro@teste.com", convite: TOKEN });
  expect(res.status).toBe(400);
});

test("convite valido usa o perfil do convite e ignora o perfil do cliente", async () => {
  resetState({ convite: conviteValido() });
  const res = await post({ ...base, perfil: "ADMIN", convite: TOKEN });
  expect(res.status).toBe(201);
  expect(res.body.user.perfil).toBe("COLABORADOR");
  const busca = calls.find((c) => /FROM CONVITE/.test(c.sql));
  expect(busca.params[0]).toBe(hashToken(TOKEN));
  expect(busca.params[0]).not.toBe(TOKEN);
  const insert = calls.find((c) => /INSERT INTO USUARIO /.test(c.sql));
  expect(insert.params[3]).toBe("COLABORADOR");
  const vinculo = calls.find((c) => /INSERT INTO USUARIO_PESSOA/.test(c.sql));
  expect(vinculo.params).toEqual([10, 3, 0]);
  expect(sqls().some((q) => /GET_LOCK/.test(q))).toBe(false);
});

test("conta existente e associada a outra pessoa sem duplicar o usuario", async () => {
  resetState({
    convite: conviteValido({ id_pessoa: 5 }),
    existente: { id_usuario: 2, nome: "Novo", email: "novo@teste.com", senha_hash: hash, perfil: "COLABORADOR", status: "ATIVO", tentativas_falhas: 0, bloqueado_ate: null }
  });
  const res = await post({ ...base, convite: TOKEN });
  expect(res.status).toBe(200);
  expect(sqls().some((q) => /INSERT INTO USUARIO /.test(q))).toBe(false);
  const vinculo = calls.find((c) => /INSERT INTO USUARIO_PESSOA/.test(c.sql));
  expect(vinculo.params).toEqual([2, 5, 0]);
  expect(vinculo.sql).toMatch(/ON DUPLICATE KEY/);
});

test("conta existente com senha errada nao e associada", async () => {
  resetState({
    convite: conviteValido(),
    existente: { id_usuario: 2, nome: "Novo", email: "novo@teste.com", senha_hash: hash, perfil: "COLABORADOR", status: "ATIVO", tentativas_falhas: 0, bloqueado_ate: null }
  });
  const res = await post({ ...base, senha: "SenhaErrada99", convite: TOKEN });
  expect(res.status).toBe(400);
  expect(sqls().some((q) => /INSERT INTO USUARIO_PESSOA/.test(q))).toBe(false);
  expect(sqls().some((q) => /UPDATE CONVITE/.test(q))).toBe(false);
});

test("validacoes basicas do cadastro", async () => {
  expect((await post({ ...base, senha: "curta" })).status).toBe(400);
  expect((await post({ ...base, email: "invalido" })).status).toBe(400);
});

test("paginas protegidas redirecionam sem sessao e /api desconhecido retorna 404", async () => {
  const pagina = await request(app).get("/pages/usuarios.html");
  expect(pagina.status).toBe(302);
  expect(pagina.headers.location).toBe("/");
  const api = await request(app).get("/api/inexistente");
  expect(api.status).toBe(404);
  expect(api.body.error).toBeDefined();
});
