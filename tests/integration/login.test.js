const mockExecute = jest.fn();
jest.mock("mysql2/promise", () => ({ createPool: () => ({ execute: (...a) => mockExecute(...a) }) }));

const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../../src/server");

const hash = bcrypt.hashSync("SenhaCorreta1", 4);

function usuario(extra = {}) {
  return { id_usuario: 1, nome: "Ana", email: "ana@teste.com", senha_hash: hash, perfil: "ADMIN", status: "ATIVO", tentativas_falhas: 0, bloqueado_ate: null, ...extra };
}

beforeEach(() => mockExecute.mockReset());

test("login valido: 200 e zera falhas", async () => {
  mockExecute.mockResolvedValueOnce([[usuario({ tentativas_falhas: 2 })]]).mockResolvedValue([{}]);
  const res = await request(app).post("/api/login").send({ email: "ana@teste.com", senha: "SenhaCorreta1" });
  expect(res.status).toBe(200);
  expect(res.body.user.email).toBe("ana@teste.com");
  expect(mockExecute.mock.calls[1][0]).toMatch(/tentativas_falhas = 0/);
});

test("E1: senha errada e e-mail inexistente tem a mesma mensagem", async () => {
  mockExecute.mockResolvedValueOnce([[usuario()]]).mockResolvedValue([{}]);
  const errada = await request(app).post("/api/login").send({ email: "ana@teste.com", senha: "errada" });
  mockExecute.mockReset();
  mockExecute.mockResolvedValueOnce([[]]);
  const inexistente = await request(app).post("/api/login").send({ email: "x@teste.com", senha: "errada" });
  expect(errada.status).toBe(401);
  expect(inexistente.status).toBe(401);
  expect(errada.body.error).toBe(inexistente.body.error);
});

test("E2: conta inativa com senha correta recebe 403", async () => {
  mockExecute.mockResolvedValueOnce([[usuario({ status: "INATIVO" })]]);
  const res = await request(app).post("/api/login").send({ email: "ana@teste.com", senha: "SenhaCorreta1" });
  expect(res.status).toBe(403);
  expect(res.body.error).toMatch(/não autorizado/);
});

test("E2: conta inativa com senha errada recebe 401 generico e conta falha", async () => {
  mockExecute.mockResolvedValueOnce([[usuario({ status: "INATIVO" })]]).mockResolvedValue([{}]);
  const res = await request(app).post("/api/login").send({ email: "ana@teste.com", senha: "errada" });
  expect(res.status).toBe(401);
  expect(res.body.error).not.toMatch(/autorizado/);
  expect(mockExecute.mock.calls[1][0]).toMatch(/tentativas_falhas/);
});

test("E3: a 5a falha seguida bloqueia por 15 minutos", async () => {
  mockExecute.mockResolvedValueOnce([[usuario({ tentativas_falhas: 4 })]]).mockResolvedValue([{}]);
  const res = await request(app).post("/api/login").send({ email: "ana@teste.com", senha: "errada" });
  expect(res.status).toBe(401);
  const [, params] = mockExecute.mock.calls[1];
  expect(params[0]).toBe(0);
  const minutos = (params[1].getTime() - Date.now()) / 60000;
  expect(minutos).toBeGreaterThan(14);
  expect(minutos).toBeLessThanOrEqual(15);
});

test("E3: conta bloqueada recebe 429 mesmo com a senha correta", async () => {
  mockExecute.mockResolvedValueOnce([[usuario({ bloqueado_ate: new Date(Date.now() + 600000) })]]);
  const res = await request(app).post("/api/login").send({ email: "ana@teste.com", senha: "SenhaCorreta1" });
  expect(res.status).toBe(429);
});

test("sem bloqueio por IP: 7 tentativas seguidas nao geram 429", async () => {
  mockExecute.mockResolvedValue([[]]);
  let ultimo;
  for (let i = 0; i < 7; i += 1) ultimo = await request(app).post("/api/login").send({ email: "x@teste.com", senha: "errada" });
  expect(ultimo.status).toBe(401);
});

test("/api desconhecido devolve 404 JSON e /pages exige sessao", async () => {
  expect((await request(app).get("/api/nao-existe")).status).toBe(404);
  const r = await request(app).get("/pages/usuarios.html");
  expect(r.status).toBe(302);
  expect(r.headers.location).toBe("/");
});
