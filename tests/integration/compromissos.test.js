const express = require("express");
const request = require("supertest");
const compromissosRoutes = require("../../src/routes/compromissos");

let usuario;
let vinculo;
let existe;
let conflito;
let calls;

function execute(sql, params = []) {
  calls.push({ sql, params });
  if (/INSERT INTO COMPROMISSO/.test(sql)) return [{ insertId: 7 }];
  if (/FROM USUARIO_PESSOA up WHERE/.test(sql)) return [vinculo ? [{ id_pessoa: 5 }] : []];
  if (/FOR UPDATE/.test(sql)) return [existe ? [{ id_compromisso: 7, id_pessoa: 5 }] : []];
  if (/id_compromisso <> \?/.test(sql)) return [conflito ? [{ id_compromisso: 8 }] : []];
  if (/JOIN USUARIO_PESSOA up ON/.test(sql)) return [[{ id_compromisso: 7, id_pessoa: 5, tipo: "CONSULTA" }]];
  if (/JOIN PESSOA_ASSISTIDA/.test(sql)) return [[{ id_compromisso: 7, id_pessoa: 5, tipo: "CONSULTA" }]];
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
  app.use("/api/compromissos", compromissosRoutes(async () => pool));
  return app;
}

const historicos = () => calls.filter((c) => /INSERT INTO HISTORICO/.test(c.sql));
const corpo = { id_pessoa: 5, tipo: "EXAME", data_hora: "2026-06-10T09:30", descricao: "Hemograma" };

beforeEach(() => {
  usuario = { id: 1, perfil: "ADMIN" };
  vinculo = true;
  existe = true;
  conflito = false;
  calls = [];
});

test("sem sessao: 401 em todas as rotas", async () => {
  usuario = undefined;
  const app = criarApp();
  expect((await request(app).get("/api/compromissos")).status).toBe(401);
  expect((await request(app).post("/api/compromissos").send(corpo)).status).toBe(401);
  expect((await request(app).put("/api/compromissos/7").send(corpo)).status).toBe(401);
  expect((await request(app).delete("/api/compromissos/7")).status).toBe(401);
});

test("COLABORADOR lista (200) mas nao cria, edita nem exclui (403)", async () => {
  usuario = { id: 2, perfil: "COLABORADOR" };
  const app = criarApp();
  const r = await request(app).get("/api/compromissos");
  expect(r.status).toBe(200);
  expect(r.body.compromissos).toHaveLength(1);
  expect((await request(app).post("/api/compromissos").send(corpo)).status).toBe(403);
  expect((await request(app).put("/api/compromissos/7").send(corpo)).status).toBe(403);
  expect((await request(app).delete("/api/compromissos/7")).status).toBe(403);
  expect(historicos()).toHaveLength(0);
});

test("GET: id_pessoa invalido 400; valido 200", async () => {
  const app = criarApp();
  expect((await request(app).get("/api/compromissos?id_pessoa=abc")).status).toBe(400);
  expect((await request(app).get("/api/compromissos?id_pessoa=0")).status).toBe(400);
  expect((await request(app).get("/api/compromissos?id_pessoa=5")).status).toBe(200);
});

test("ADMIN cria: 201 e historico; invalido 400; sem vinculo 403", async () => {
  const app = criarApp();
  expect((await request(app).post("/api/compromissos").send(corpo)).status).toBe(201);
  expect(historicos()).toHaveLength(1);
  calls = [];
  expect((await request(app).post("/api/compromissos").send({ ...corpo, tipo: "X" })).status).toBe(400);
  vinculo = false;
  expect((await request(app).post("/api/compromissos").send(corpo)).status).toBe(403);
  expect(historicos()).toHaveLength(0);
});

test("conflito: 409 com conflito:true; reenviar com confirmar:true 201", async () => {
  conflito = true;
  const app = criarApp();
  const r = await request(app).post("/api/compromissos").send(corpo);
  expect(r.status).toBe(409);
  expect(r.body.conflito).toBe(true);
  expect(historicos()).toHaveLength(0);
  const ok = await request(app).post("/api/compromissos").send({ ...corpo, confirmar: true });
  expect(ok.status).toBe(201);
  expect(historicos()).toHaveLength(1);
});

test("PUT: 200, 409 em conflito, 404 inexistente, 403 sem vinculo", async () => {
  const app = criarApp();
  expect((await request(app).put("/api/compromissos/7").send(corpo)).status).toBe(200);
  conflito = true;
  const r = await request(app).put("/api/compromissos/7").send(corpo);
  expect(r.status).toBe(409);
  expect(r.body.conflito).toBe(true);
  expect((await request(app).put("/api/compromissos/7").send({ ...corpo, confirmar: true })).status).toBe(200);
  existe = false;
  expect((await request(app).put("/api/compromissos/99").send(corpo)).status).toBe(404);
  expect((await request(app).put("/api/compromissos/abc").send(corpo)).status).toBe(404);
  existe = true;
  vinculo = false;
  expect((await request(app).put("/api/compromissos/7").send(corpo)).status).toBe(403);
});

test("DELETE: 200 com historico, 404 e 403", async () => {
  const app = criarApp();
  expect((await request(app).delete("/api/compromissos/7")).status).toBe(200);
  expect(historicos()).toHaveLength(1);
  calls = [];
  existe = false;
  expect((await request(app).delete("/api/compromissos/7")).status).toBe(404);
  existe = true;
  vinculo = false;
  expect((await request(app).delete("/api/compromissos/7")).status).toBe(403);
  expect(historicos()).toHaveLength(0);
});
