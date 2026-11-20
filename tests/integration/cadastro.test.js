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
  state = { admin: false, emailExiste: false, existente: null, convite: null, lockOk: 1, falhaInsert: false, consumirOk: true, ...extra };
  calls = [];
  lockChain = Promise.resolve();
}

function conviteValido(extra = {}) {
  return { id_convite: 7, email: "novo@teste.com", perfil: "COLABORADOR", id_pessoa: 3, expira_em: new Date(Date.now() + 3600000), usado_em: null, ...extra };
}

async function executar(sql, params = []) {
  calls.push({ sql, params });
  if (/FROM CONVITE/.test(sql)) return [state.convite ? [state.convite] : []];
  if (/UPDATE CONVITE/.test(sql)) return [{ affectedRows: state.consumirOk ? 1 : 0 }];
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

beforeEach(() => {
  resetState();
  app.locals.pool = { getConnection: async () => novaConexao() };
});

const cadastro = (body) => request(app).post("/api/login/cadastro").send(body);
const base = { nome: "Novo", email: "novo@teste.com", senha: "SenhaCorreta1" };
const inserts = () => calls.filter((c) => /INSERT INTO USUARIO /.test(c.sql));

test("primeiro cadastro publico vira ADMIN, mesmo que o cliente envie outro perfil", async () => {
  const res = await cadastro({ ...base, perfil: "COLABORADOR" });
  expect(res.status).toBe(201);
  expect(res.body.user.perfil).toBe("ADMIN");
  expect(inserts()[0].params[3]).toBe("ADMIN");
});

test("lock na mesma conexao: GET_LOCK, transacao, RELEASE_LOCK e release", async () => {
  await cadastro(base);
  const ordem = calls.map((c) => c.sql).filter((s) => /GET_LOCK|BEGIN|COMMIT|RELEASE_LOCK|RELEASE_CONN/.test(s)).map((s) => s.replace(/\(.*$/, ""));
  expect(ordem).toEqual(["SELECT GET_LOCK", "BEGIN", "COMMIT", "SELECT RELEASE_LOCK", "RELEASE_CONN"]);
});

test("RELEASE_LOCK ocorre mesmo com erro", async () => {
  resetState({ falhaInsert: true });
  const res = await cadastro(base);
  expect(res.status).toBe(500);
  expect(calls.some((c) => c.sql === "ROLLBACK")).toBe(true);
  expect(calls.some((c) => /RELEASE_LOCK/.test(c.sql))).toBe(true);
  expect(calls.some((c) => c.sql === "RELEASE_CONN")).toBe(true);
});

test("falha ao obter a trava: 503 e nada cadastrado", async () => {
  resetState({ lockOk: 0 });
  const res = await cadastro(base);
  expect(res.status).toBe(503);
  expect(inserts()).toHaveLength(0);
});

test("cadastro sem convite depois do primeiro admin: 403", async () => {
  resetState({ admin: true });
  const res = await cadastro({ ...base, perfil: "ADMIN" });
  expect(res.status).toBe(403);
  expect(inserts()).toHaveLength(0);
});

test("concorrencia simulada: so um primeiro admin, o outro recebe 403", async () => {
  const [a, b] = await Promise.all([
    cadastro({ ...base, email: "a@teste.com" }),
    cadastro({ ...base, email: "b@teste.com" })
  ]);
  expect([a.status, b.status].sort()).toEqual([201, 403]);
  expect(inserts()).toHaveLength(1);
});

test("convite invalido, expirado e usado devolvem a mesma resposta 400", async () => {
  const corpo = { ...base, convite: TOKEN };
  resetState();
  const invalido = await cadastro(corpo);
  resetState({ convite: conviteValido({ expira_em: new Date(Date.now() - 1000) }) });
  const expirado = await cadastro(corpo);
  resetState({ convite: conviteValido({ usado_em: new Date() }) });
  const usado = await cadastro(corpo);
  for (const r of [invalido, expirado, usado]) expect(r.status).toBe(400);
  expect(expirado.body).toEqual(invalido.body);
  expect(usado.body).toEqual(invalido.body);
});

test("convite valido: perfil e e-mail vem do convite e o token e consultado por hash", async () => {
  resetState({ admin: true, convite: conviteValido({ perfil: "COLABORADOR" }) });
  const res = await cadastro({ ...base, convite: TOKEN, perfil: "ADMIN" });
  expect(res.status).toBe(201);
  expect(res.body.user.perfil).toBe("COLABORADOR");
  expect(inserts()[0].params[3]).toBe("COLABORADOR");
  expect(calls.find((c) => /FROM CONVITE/.test(c.sql)).params[0]).toBe(hashToken(TOKEN));
  expect(calls.find((c) => /INSERT INTO USUARIO_PESSOA/.test(c.sql)).params).toEqual([10, 3, 0]);
});

test("e-mail diferente do convite: 400 e nada criado", async () => {
  resetState({ admin: true, convite: conviteValido() });
  const res = await cadastro({ ...base, email: "outro@teste.com", convite: TOKEN });
  expect(res.status).toBe(400);
  expect(inserts()).toHaveLength(0);
});

test("convite consumido por outra requisicao: 400", async () => {
  resetState({ admin: true, convite: conviteValido(), consumirOk: false });
  const res = await cadastro({ ...base, convite: TOKEN });
  expect(res.status).toBe(400);
  expect(calls.some((c) => c.sql === "ROLLBACK")).toBe(true);
});

test("conta existente: associa a outra pessoa sem duplicar e sem mudar o perfil", async () => {
  const existente = { id_usuario: 2, nome: "Bia", email: "novo@teste.com", senha_hash: hash, perfil: "ADMIN", status: "ATIVO", tentativas_falhas: 0, bloqueado_ate: null };
  resetState({ admin: true, existente, convite: conviteValido({ perfil: "COLABORADOR", id_pessoa: 4 }) });
  const res = await cadastro({ ...base, convite: TOKEN });
  expect(res.status).toBe(200);
  expect(res.body.user.perfil).toBe("ADMIN");
  expect(inserts()).toHaveLength(0);
  expect(calls.find((c) => /INSERT INTO USUARIO_PESSOA/.test(c.sql)).params).toEqual([2, 4, 0]);
});

test("conta existente com senha errada: 400 generico e convite nao consumido", async () => {
  const existente = { id_usuario: 2, nome: "Bia", email: "novo@teste.com", senha_hash: hash, perfil: "COLABORADOR", status: "ATIVO", tentativas_falhas: 0, bloqueado_ate: null };
  resetState({ admin: true, existente, convite: conviteValido() });
  const res = await cadastro({ ...base, senha: "SenhaErrada99", convite: TOKEN });
  expect(res.status).toBe(400);
  expect(calls.some((c) => /UPDATE CONVITE/.test(c.sql))).toBe(false);
  expect(calls.some((c) => /INSERT INTO USUARIO_PESSOA/.test(c.sql))).toBe(false);
});

test("conta existente inativa: resposta generica", async () => {
  const existente = { id_usuario: 2, nome: "Bia", email: "novo@teste.com", senha_hash: hash, perfil: "COLABORADOR", status: "INATIVO", tentativas_falhas: 0, bloqueado_ate: null };
  resetState({ admin: true, existente, convite: conviteValido() });
  const res = await cadastro({ ...base, convite: TOKEN });
  expect(res.status).toBe(400);
});
