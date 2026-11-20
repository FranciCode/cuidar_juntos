const express = require("express");
const request = require("supertest");
const pessoasRoutes = require("../../src/routes/pessoas");

let usuario;
let vinculado;
let existe;
let pendentes;
let calls;

function execute(sql, params = []) {
  calls.push({ sql, params });
  if (/SELECT id_pessoa FROM PESSOA_ASSISTIDA WHERE/.test(sql)) return [existe ? [{ id_pessoa: 5 }] : []];
  if (/SELECT up.id_pessoa FROM USUARIO_PESSOA/.test(sql)) return [vinculado ? [{ id_pessoa: 5 }] : []];
  if (/COUNT\(\*\)/.test(sql)) return [[{ total: pendentes }]];
  if (/FROM PESSOA_ASSISTIDA p/.test(sql)) return [[{ id_pessoa: 5, nome: "Maria", status: "ATIVO" }]];
  return [{}];
}

const conn = {
  execute: async (...a) => execute(...a),
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release: () => {}
};
const pool = { execute: async (...a) => execute(...a), getConnection: async () => conn };

function criarApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = { user: usuario }; next(); });
  app.use("/api/pessoas", pessoasRoutes(async () => pool));
  return app;
}

beforeEach(() => {
  usuario = { id: 1, perfil: "ADMIN" };
  vinculado = true;
  existe = true;
  pendentes = 0;
  calls = [];
});

const historicos = () => calls.filter((c) => /INSERT INTO HISTORICO/.test(c.sql));

test("sem sessao: 401", async () => {
  usuario = undefined;
  expect((await request(criarApp()).get("/api/pessoas")).status).toBe(401);
});

test("COLABORADOR consulta (200) mas nao escreve (403)", async () => {
  usuario = { id: 2, perfil: "COLABORADOR" };
  const app = criarApp();
  expect((await request(app).get("/api/pessoas")).status).toBe(200);
  expect((await request(app).post("/api/pessoas").send({})).status).toBe(403);
  expect((await request(app).put("/api/pessoas/5").send({})).status).toBe(403);
  expect((await request(app).patch("/api/pessoas/5/status").send({ status: "INATIVO" })).status).toBe(403);
  expect(historicos()).toHaveLength(0);
});

test("ADMIN sem vinculo: 403 em PUT e PATCH, sem historico", async () => {
  vinculado = false;
  const app = criarApp();
  expect((await request(app).put("/api/pessoas/5").send({ nome: "A", data_nascimento: "2000-01-01" })).status).toBe(403);
  expect((await request(app).patch("/api/pessoas/5/status").send({ status: "ATIVO" })).status).toBe(403);
  expect(historicos()).toHaveLength(0);
});

test("id inexistente: 404", async () => {
  existe = false;
  const res = await request(criarApp()).put("/api/pessoas/99").send({ nome: "A", data_nascimento: "2000-01-01" });
  expect(res.status).toBe(404);
});

test("PUT valido: 200 e historico", async () => {
  const res = await request(criarApp()).put("/api/pessoas/5").send({ nome: "Maria", data_nascimento: "1950-01-01", consentimento: false });
  expect(res.status).toBe(200);
  expect(historicos()).toHaveLength(1);
  expect(calls.some((c) => /consentimento/.test(c.sql) && /^UPDATE/.test(c.sql))).toBe(false);
});

test("desativar: 409 com pendentes e depois 200 com confirmar", async () => {
  pendentes = 3;
  const app = criarApp();
  const r1 = await request(app).patch("/api/pessoas/5/status").send({ status: "INATIVO" });
  expect(r1.status).toBe(409);
  expect(r1.body.pendentes).toBe(3);
  expect(historicos()).toHaveLength(0);
  const r2 = await request(app).patch("/api/pessoas/5/status").send({ status: "INATIVO", confirmar: true });
  expect(r2.status).toBe(200);
  expect(historicos()).toHaveLength(1);
});

test("POST sem consentimento: 400", async () => {
  const res = await request(criarApp()).post("/api/pessoas").send({ nome: "Ana", data_nascimento: "2000-01-01" });
  expect(res.status).toBe(400);
});
