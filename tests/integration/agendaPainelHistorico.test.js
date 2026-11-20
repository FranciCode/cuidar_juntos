const express = require("express");
const request = require("supertest");
const agendaRoutes = require("../../src/routes/agenda");
const painelRoutes = require("../../src/routes/painel");
const historicoRoutes = require("../../src/routes/historico");

let usuario;
let calls;
let falha;

function execute(sql, params = []) {
  calls.push({ sql, params });
  if (falha) throw new Error("falha");
  if (/FROM ATIVIDADE/.test(sql) && /GROUP BY/.test(sql)) return [[{ status: "PENDENTE", total: 2 }]];
  if (/FROM ATIVIDADE/.test(sql)) return [[{ origem: "ATIVIDADE", id: 1, titulo: "Banho", data_hora: "2026-11-10 10:00:00", status: "PENDENTE", id_pessoa: 5, pessoa: "Maria" }]];
  if (/FROM COMPROMISSO c/.test(sql) && /LIMIT/.test(sql)) return [[{ id: 3, titulo: "Consulta", data_hora: "2099-01-01 09:00:00" }]];
  if (/FROM COMPROMISSO/.test(sql)) return [[{ origem: "COMPROMISSO", id: 3, titulo: "Consulta", data_hora: "2026-11-09 09:00:00", status: null, id_pessoa: 5, pessoa: "Maria" }]];
  if (/COUNT\(\*\)/.test(sql)) return [[{ total: 1 }]];
  if (/FROM HISTORICO/.test(sql)) return [[{ acao: "ATIVIDADE_CRIADA", entidade: "ATIVIDADE", id_registro: 1, responsavel: "Ana", data_hora: "2026-11-10 10:00:00", detalhes: null }]];
  return [[]];
}

const pool = { execute: async (...a) => execute(...a) };

function criarApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = { user: usuario }; next(); });
  const getPool = async () => pool;
  app.use("/api/agenda", agendaRoutes(getPool));
  app.use("/api/painel", painelRoutes(getPool));
  app.use("/api/historico", historicoRoutes(getPool));
  return app;
}

beforeEach(() => {
  usuario = { id: 2, perfil: "COLABORADOR" };
  calls = [];
  falha = false;
});

test("sem sessao: 401 nas tres rotas", async () => {
  usuario = undefined;
  const app = criarApp();
  for (const rota of ["/api/agenda", "/api/painel", "/api/historico"]) {
    expect((await request(app).get(rota)).status).toBe(401);
  }
  expect(calls).toHaveLength(0);
});

test("agenda: 200 com itens ordenados e filtros repassados ao SQL", async () => {
  const app = criarApp();
  const r = await request(app).get("/api/agenda");
  expect(r.status).toBe(200);
  expect(r.body.itens.map((i) => i.origem)).toEqual(["COMPROMISSO", "ATIVIDADE"]);
  expect(r.body.itens[0].status).toBeNull();
  calls = [];
  const f = await request(app).get("/api/agenda?de=2026-11-01&ate=2026-11-10");
  expect(f.status).toBe(200);
  expect(calls.every((c) => c.params[0] === 2)).toBe(true);
  expect(calls[0].params).toContain("2026-11-10 23:59:59");
});

test("agenda: 400 para query invalida", async () => {
  const app = criarApp();
  expect((await request(app).get("/api/agenda?de=xx")).status).toBe(400);
  expect((await request(app).get("/api/agenda?de=2026-11-10&ate=2026-11-01")).status).toBe(400);
  const r = await request(app).get("/api/agenda?status=FEITA");
  expect(r.status).toBe(400);
  expect(r.body.error).toBeTruthy();
  expect((await request(app).get("/api/agenda?status=PENDENTE")).body.itens.every((i) => i.origem === "ATIVIDADE")).toBe(true);
});

test("painel: contagens e proximos compromissos", async () => {
  const r = await request(criarApp()).get("/api/painel");
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ pendentes: 2, assumidas: 0, concluidas: 0 });
  expect(r.body.proximos_compromissos).toHaveLength(1);
});

test("historico: 200 com paginacao; 400 para limite 101 e pagina invalida", async () => {
  const app = criarApp();
  const r = await request(app).get("/api/historico");
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ pagina: 1, limite: 20, total: 1 });
  expect(r.body.registros[0].responsavel).toBe("Ana");
  expect((await request(app).get("/api/historico?limite=100&pagina=2")).status).toBe(200);
  expect((await request(app).get("/api/historico?limite=101")).status).toBe(400);
  expect((await request(app).get("/api/historico?pagina=0")).status).toBe(400);
});

test("historico: ADMIN e COLABORADOR passam flag de visibilidade diferente", async () => {
  const app = criarApp();
  await request(app).get("/api/historico");
  expect(calls[0].params).toEqual([2, 0]);
  calls = [];
  usuario = { id: 1, perfil: "ADMIN" };
  await request(app).get("/api/historico");
  expect(calls[0].params).toEqual([1, 1]);
});

test("falha no banco: 500 com error", async () => {
  falha = true;
  const app = criarApp();
  for (const rota of ["/api/agenda", "/api/painel", "/api/historico"]) {
    const r = await request(app).get(rota);
    expect(r.status).toBe(500);
    expect(r.body.error).toBeTruthy();
  }
});
