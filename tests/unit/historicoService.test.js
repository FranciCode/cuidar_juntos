const historicoService = require("../../src/services/historicoService");

function fakeDb({ registros = [], total = 0 } = {}) {
  const calls = [];
  const execute = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/COUNT\(\*\)/.test(sql)) return [[{ total }]];
    return [registros];
  };
  return { db: { execute }, calls };
}

const colab = { id: 2, perfil: "COLABORADOR" };
const admin = { id: 1, perfil: "ADMIN" };

test("padrao: pagina 1, limite 20, sem registros", async () => {
  const t = fakeDb();
  const r = await historicoService.listar(t.db, colab, {});
  expect(r).toEqual({ status: 200, body: { registros: [], pagina: 1, limite: 20, total: 0 } });
  expect(t.calls[1].sql).toMatch(/LIMIT 20 OFFSET 0/);
});

test("devolve registros com responsavel, ordenados do mais recente", async () => {
  const reg = [{ acao: "ATIVIDADE_CRIADA", entidade: "ATIVIDADE", id_registro: 1, responsavel: "Ana", data_hora: "2026-11-10 10:00:00", detalhes: null }];
  const t = fakeDb({ registros: reg, total: 1 });
  const r = await historicoService.listar(t.db, colab, {});
  expect(r.body.registros).toEqual(reg);
  expect(r.body.total).toBe(1);
  expect(t.calls[1].sql).toMatch(/ORDER BY h.data_hora DESC/);
  expect(t.calls[1].sql).toMatch(/u.nome AS responsavel/);
});

test("pagina e limite calculam o deslocamento; limite 100 aceito", async () => {
  const t = fakeDb({ total: 250 });
  const r = await historicoService.listar(t.db, colab, { pagina: "3", limite: "100" });
  expect(r.body).toMatchObject({ pagina: 3, limite: 100, total: 250 });
  expect(t.calls[1].sql).toMatch(/LIMIT 100 OFFSET 200/);
});

test("400 para limite 101 e valores nao inteiros positivos, sem consultar", async () => {
  const ruins = [{ limite: "101" }, { limite: "0" }, { limite: "-1" }, { limite: "abc" }, { limite: "1.5" }, { pagina: "0" }, { pagina: "x" }, { pagina: "-2" }];
  for (const q of ruins) {
    const t = fakeDb();
    const r = await historicoService.listar(t.db, colab, q);
    expect(r.status).toBe(400);
    expect(r.body.error).toBeTruthy();
    expect(t.calls).toHaveLength(0);
  }
});

test("visibilidade: usuario e flag de admin vao na contagem e na pagina", async () => {
  let t = fakeDb();
  await historicoService.listar(t.db, colab, {});
  expect(t.calls[0].params).toEqual([2, 0]);
  expect(t.calls[1].params).toEqual([2, 0]);
  expect(t.calls[0].sql).toMatch(/USUARIO_PESSOA up ON up.id_usuario = \?/);
  t = fakeDb();
  await historicoService.listar(t.db, admin, {});
  expect(t.calls[0].params).toEqual([1, 1]);
  expect(t.calls[1].params).toEqual([1, 1]);
});

test("SQL resolve a pessoa por ATIVIDADE, COMPROMISSO, MEDICAMENTO e ADMINISTRACAO", async () => {
  const t = fakeDb();
  await historicoService.listar(t.db, colab, {});
  for (const e of ["ATIVIDADE", "COMPROMISSO", "MEDICAMENTO", "ADMINISTRACAO"]) {
    expect(t.calls[0].sql).toContain(`h.entidade = '${e}'`);
  }
});
