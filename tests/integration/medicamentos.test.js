const express = require("express");
const request = require("supertest");
const medicamentosRoutes = require("../../src/routes/medicamentos");

let usuario;
let vinculo;
let existe;
let adm;
let calls;

function execute(sql, params = []) {
  calls.push({ sql, params });
  if (/WHERE u.id_usuario = \?/.test(sql)) return [[{ id_usuario: usuario && usuario.id, status: "ATIVO" }]];
  if (/INSERT INTO MEDICAMENTO/.test(sql)) return [{ insertId: 7 }];
  if (/INSERT INTO ADMINISTRACAO/.test(sql)) return [{ insertId: 9 }];
  if (/FROM USUARIO_PESSOA up WHERE/.test(sql)) return [vinculo ? [{ pode_registrar_administracao: 1 }] : []];
  if (/JOIN USUARIO_PESSOA up ON/.test(sql)) return [[{ id_medicamento: 7, id_pessoa: 5, nome: "X", pode_registrar_administracao: 0 }]];
  if (/FROM MEDICAMENTO m WHERE .*FOR UPDATE/.test(sql)) return [existe ? [{ id_medicamento: 7, id_pessoa: 5 }] : []];
  if (/FROM MEDICAMENTO m WHERE/.test(sql)) return [[{ id_medicamento: 7, id_pessoa: 5, nome: "X" }]];
  if (/COUNT\(\*\)/.test(sql)) return [[{ total: adm }]];
  if (/FROM ADMINISTRACAO a/.test(sql)) return [[{ id_administracao: 9, registrado_por: "Ana" }]];
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
  app.use("/api/medicamentos", medicamentosRoutes(async () => pool));
  return app;
}

const historicos = () => calls.filter((c) => /INSERT INTO HISTORICO/.test(c.sql));
const corpo = { id_pessoa: 5, nome: "Dipirona", instrucao_cadastrada: "Conforme receita" };

beforeEach(() => {
  usuario = { id: 1, perfil: "ADMIN" };
  vinculo = true;
  existe = true;
  adm = 0;
  calls = [];
});

test("sem sessao: 401", async () => {
  usuario = undefined;
  expect((await request(criarApp()).get("/api/medicamentos")).status).toBe(401);
});

test("COLABORADOR lista (200) mas nao cria, edita nem exclui (403)", async () => {
  usuario = { id: 2, perfil: "COLABORADOR" };
  const app = criarApp();
  expect((await request(app).get("/api/medicamentos")).status).toBe(200);
  expect((await request(app).post("/api/medicamentos").send(corpo)).status).toBe(403);
  expect((await request(app).put("/api/medicamentos/7").send(corpo)).status).toBe(403);
  expect((await request(app).delete("/api/medicamentos/7")).status).toBe(403);
  expect(historicos()).toHaveLength(0);
});

test("ADMIN cria: 201 e historico; invalido 400; sem vinculo 403", async () => {
  const app = criarApp();
  expect((await request(app).post("/api/medicamentos").send(corpo)).status).toBe(201);
  expect(historicos()).toHaveLength(1);
  calls = [];
  expect((await request(app).post("/api/medicamentos").send({ ...corpo, nome: "" })).status).toBe(400);
  vinculo = false;
  expect((await request(app).post("/api/medicamentos").send(corpo)).status).toBe(403);
  expect(historicos()).toHaveLength(0);
});

test("PUT e DELETE: 200, 404 e 409", async () => {
  const app = criarApp();
  expect((await request(app).put("/api/medicamentos/7").send(corpo)).status).toBe(200);
  expect((await request(app).delete("/api/medicamentos/7")).status).toBe(200);
  adm = 1;
  expect((await request(app).delete("/api/medicamentos/7")).status).toBe(409);
  existe = false;
  expect((await request(app).put("/api/medicamentos/99").send(corpo)).status).toBe(404);
});

test("administracao: 201, futura 400, sem vinculo 403, historico 200", async () => {
  const app = criarApp();
  const url = "/api/medicamentos/7/administracoes";
  let r = await request(app).post(url).send({ data_hora: "2020-01-01T08:00", observacao: "ok" });
  expect(r.status).toBe(201);
  expect(r.body.administracao.registrado_por).toBe("Ana");
  expect((await request(app).post(url).send({ data_hora: "2999-01-01T08:00" })).status).toBe(400);
  expect((await request(app).get(url)).status).toBe(200);
  vinculo = false;
  calls = [];
  expect((await request(app).post(url).send({ data_hora: "2020-01-01T08:00" })).status).toBe(403);
  expect((await request(app).get(url)).status).toBe(403);
  expect(historicos()).toHaveLength(0);
});

test("nao existem rotas de edicao ou exclusao de administracao", async () => {
  const app = criarApp();
  expect((await request(app).put("/api/medicamentos/7/administracoes/9").send({})).status).toBe(404);
  expect((await request(app).delete("/api/medicamentos/7/administracoes/9")).status).toBe(404);
});
