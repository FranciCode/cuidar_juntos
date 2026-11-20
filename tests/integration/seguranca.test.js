const mockExecute = jest.fn();

jest.mock("mysql2/promise", () => ({
  createPool: () => ({ execute: (...args) => mockExecute(...args), query: jest.fn() })
}));

const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../../src/server");

const hash = bcrypt.hashSync("SenhaCorreta1", 4);
const PAYLOADS = ["' OR '1'='1", "'; DROP TABLE USUARIO;--"];

const ROTAS = [
  ["get", "/api/usuarios", "admin"], ["post", "/api/usuarios", "admin"],
  ["put", "/api/usuarios/1", "admin"], ["patch", "/api/usuarios/1/status", "admin"],
  ["post", "/api/atividades", "admin"], ["put", "/api/atividades/1", "admin"],
  ["patch", "/api/atividades/1/cancelar", "admin"],
  ["get", "/api/atividades", "auth"], ["patch", "/api/atividades/1/assumir", "auth"],
  ["patch", "/api/atividades/1/liberar", "auth"], ["patch", "/api/atividades/1/concluir", "auth"],
  ["get", "/api/pessoas", "auth"], ["get", "/api/compromissos", "auth"],
  ["get", "/api/medicamentos", "auth"], ["get", "/api/agenda", "auth"],
  ["get", "/api/painel", "auth"], ["get", "/api/historico", "auth"], ["get", "/api/me", "auth"]
];

function user(perfil, extra = {}) {
  return {
    id_usuario: 7, nome: "Teste", email: "t@teste.com", senha_hash: hash, perfil,
    status: "ATIVO", tentativas_falhas: 0, bloqueado_ate: null, ...extra
  };
}

async function logar(perfil) {
  const agent = request.agent(app);
  mockExecute.mockReset();
  mockExecute.mockResolvedValueOnce([[user(perfil)]]).mockResolvedValue([[]]);
  const res = await agent.post("/api/login").send({ email: "t@teste.com", senha: "SenhaCorreta1" });
  expect(res.status).toBe(200);
  mockExecute.mockReset();
  mockExecute.mockResolvedValue([[]]);
  return { agent, res };
}

beforeEach(() => mockExecute.mockReset());

describe("anonimo", () => {
  test.each(ROTAS)("%s %s -> 401 sem tocar no banco", async (metodo, rota) => {
    const res = await request(app)[metodo](rota).send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toBeTruthy();
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

describe("colaborador em rotas exclusivas do ADMIN", () => {
  test.each(ROTAS.filter((r) => r[2] === "admin"))("%s %s -> 403 sem tocar no banco", async (metodo, rota) => {
    const { agent } = await logar("COLABORADOR");
    const res = await agent[metodo](rota).send({});
    expect(res.status).toBe(403);
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

describe("sessao, logout e cabecalhos", () => {
  test("cookie de sessao HttpOnly e SameSite=Lax; sem Secure fora de producao", async () => {
    const { res } = await logar("ADMIN");
    const cookie = res.headers["set-cookie"].join(";");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/Secure/i);
  });

  test("login nao vaza senha nem hash na resposta", async () => {
    const { res } = await logar("ADMIN");
    const txt = JSON.stringify(res.body);
    expect(txt).not.toMatch(/senha_hash|SenhaCorreta1/);
  });

  test("logout encerra a sessao: /api/me volta a 401", async () => {
    const { agent } = await logar("ADMIN");
    expect((await agent.get("/api/me")).status).toBe(200);
    expect((await agent.post("/api/logout")).status).toBe(200);
    expect((await agent.get("/api/me")).status).toBe(401);
  });

  test("helmet aplica cabecalhos de seguranca", async () => {
    const res = await request(app).get("/api/me");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toBeTruthy();
  });

  test("paginas internas redirecionam sem sessao; index e publico", async () => {
    const r = await request(app).get("/pages/painel.html");
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe("/");
    expect((await request(app).get("/pages/index.html")).status).toBe(200);
  });

  test("/api desconhecido devolve 404 JSON", async () => {
    const res = await request(app).get("/api/nao-existe");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});

describe("SQL injection", () => {
  test.each(PAYLOADS)("login com payload %s -> 401/400, nunca 200/500", async (p) => {
    mockExecute.mockResolvedValue([[]]);
    const res = await request(app).post("/api/login").send({ email: p, senha: p });
    expect([400, 401]).toContain(res.status);
    for (const [sql] of mockExecute.mock.calls) expect(sql).not.toContain(p);
  });

  test.each(PAYLOADS)("filtros de query com payload %s nunca geram 500 nem vao ao texto SQL", async (p) => {
    const { agent } = await logar("ADMIN");
    const q = encodeURIComponent(p);
    const urls = [
      `/api/agenda?status=${q}`, `/api/agenda?de=${q}`, `/api/agenda?ate=${q}`,
      `/api/historico?pagina=${q}`, `/api/historico?limite=${q}`,
      `/api/atividades?status=${q}`, `/api/atividades?id_pessoa=${q}`,
      `/api/compromissos?id_pessoa=${q}`, `/api/medicamentos?id_pessoa=${q}`
    ];
    for (const u of urls) {
      const res = await agent.get(u);
      expect(res.status).not.toBe(500);
      expect(res.status).not.toBe(401);
    }
    for (const [sql] of mockExecute.mock.calls) expect(String(sql)).not.toContain(p);
  });

  test.each(PAYLOADS)("corpos de escrita com payload %s nunca geram 500 nem vao ao texto SQL", async (p) => {
    const { agent } = await logar("ADMIN");
    const corpo = { titulo: p, descricao: p, nome: p, instrucao: p, dose: p, frequencia: p, observacao: p, tipo: p, id_pessoa: p };
    for (const rota of ["/api/atividades", "/api/compromissos", "/api/medicamentos", "/api/pessoas"]) {
      const res = await agent.post(rota).send(corpo);
      expect(res.status).not.toBe(500);
    }
    for (const [sql] of mockExecute.mock.calls) expect(String(sql)).not.toContain(p);
  });
});
