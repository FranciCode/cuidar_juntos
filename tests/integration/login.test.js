const mockExecute = jest.fn();

jest.mock("mysql2/promise", () => ({
  createPool: () => ({ execute: (...args) => mockExecute(...args), query: jest.fn() })
}));

const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../../src/server");

const hash = bcrypt.hashSync("SenhaCorreta1", 4);

function usuario(extra = {}) {
  return {
    id_usuario: 1, nome: "Ana", email: "ana@teste.com", senha_hash: hash,
    perfil: "ADMIN", status: "ATIVO", tentativas_falhas: 0, bloqueado_ate: null, ...extra
  };
}

beforeEach(() => mockExecute.mockReset());

test("login valido inicia a sessao e zera falhas", async () => {
  mockExecute.mockResolvedValueOnce([[usuario({ tentativas_falhas: 2 })]]).mockResolvedValue([{}]);
  const res = await request(app).post("/api/login").send({ email: "ana@teste.com", senha: "SenhaCorreta1" });
  expect(res.status).toBe(200);
  expect(res.body.user.perfil).toBe("ADMIN");
  expect(mockExecute.mock.calls[1][0]).toMatch(/tentativas_falhas = 0/);
});

test("E1: senha errada e e-mail inexistente retornam a mesma mensagem generica", async () => {
  mockExecute.mockResolvedValueOnce([[usuario()]]).mockResolvedValue([{}]);
  const errada = await request(app).post("/api/login").send({ email: "ana@teste.com", senha: "x" });
  mockExecute.mockReset();
  mockExecute.mockResolvedValueOnce([[]]);
  const inexistente = await request(app).post("/api/login").send({ email: "nao@teste.com", senha: "x" });
  expect(errada.status).toBe(401);
  expect(inexistente.status).toBe(401);
  expect(errada.body.error).toBe(inexistente.body.error);
});

test("E2: conta inativa nao tem acesso", async () => {
  mockExecute.mockResolvedValueOnce([[usuario({ status: "INATIVO" })]]).mockResolvedValue([{}]);
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

test("E3: conta bloqueada recusa ate a senha correta", async () => {
  const futuro = new Date(Date.now() + 10 * 60000);
  mockExecute.mockResolvedValueOnce([[usuario({ bloqueado_ate: futuro })]]);
  const res = await request(app).post("/api/login").send({ email: "ana@teste.com", senha: "SenhaCorreta1" });
  expect(res.status).toBe(429);
});
