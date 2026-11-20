const compromissoService = require("../../src/services/compromissoService");

const admin = { id: 1, perfil: "ADMIN" };

function fakeDb(opts = {}) {
  const calls = [];
  const o = { vinculo: true, conflito: false, existe: true, falhaHistorico: false, ...opts };
  const execute = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/INSERT INTO HISTORICO/.test(sql) && o.falhaHistorico) throw new Error("falha");
    if (/INSERT INTO COMPROMISSO/.test(sql)) return [{ insertId: 7 }];
    if (/FROM USUARIO_PESSOA up WHERE/.test(sql)) return [o.vinculo ? [{ id_pessoa: 5 }] : []];
    if (/FOR UPDATE/.test(sql)) return [o.existe ? [{ id_compromisso: 7, id_pessoa: 5 }] : []];
    if (/id_compromisso <> \?/.test(sql)) return [o.conflito ? [{ id_compromisso: 8 }] : []];
    if (/JOIN PESSOA_ASSISTIDA/.test(sql)) return [[{ id_compromisso: 7, id_pessoa: 5 }]];
    return [{}];
  };
  const conn = {
    execute,
    beginTransaction: async () => calls.push({ sql: "BEGIN" }),
    commit: async () => calls.push({ sql: "COMMIT" }),
    rollback: async () => calls.push({ sql: "ROLLBACK" }),
    release: () => {}
  };
  return { db: { getConnection: async () => conn, execute }, calls };
}

const historicos = (calls) => calls.filter((c) => /INSERT INTO HISTORICO/.test(c.sql));
const gravou = (calls) => calls.some((c) => /(INSERT INTO|UPDATE|DELETE FROM) COMPROMISSO/.test(c.sql));
const valido = { id_pessoa: 5, tipo: "CONSULTA", data_hora: "2026-06-10T09:30", descricao: "Cardiologista" };

test("criar: 201, grava e registra COMPROMISSO_CRIADO; data passada e descricao de 250 valem", async () => {
  let t = fakeDb();
  expect((await compromissoService.criar(t.db, admin, valido)).status).toBe(201);
  expect(historicos(t.calls)[0].params[1]).toBe("COMPROMISSO_CRIADO");
  t = fakeDb();
  expect((await compromissoService.criar(t.db, admin, { ...valido, data_hora: "2000-01-01 08:00", descricao: "a".repeat(250) })).status).toBe(201);
});

test("criar: validacao 400 sem gravar nem historico", async () => {
  const invalidos = [
    { tipo: undefined }, { tipo: "CIRURGIA" },
    { data_hora: undefined }, { data_hora: "2026-02-30T10:00" }, { data_hora: "abc" },
    { descricao: undefined }, { descricao: "   " }, { descricao: "a".repeat(251) },
    { observacao: "x".repeat(501) }, { id_pessoa: "x" }
  ];
  for (const parcial of invalidos) {
    const t = fakeDb();
    const r = await compromissoService.criar(t.db, admin, { ...valido, ...parcial });
    expect(r.status).toBe(400);
    expect(gravou(t.calls)).toBe(false);
    expect(historicos(t.calls)).toHaveLength(0);
  }
});

test("criar: observacao de 500 e aceita", async () => {
  const r = await compromissoService.criar(fakeDb().db, admin, { ...valido, observacao: "x".repeat(500) });
  expect(r.status).toBe(201);
});

test("criar: 403 sem vinculo, sem gravar", async () => {
  const t = fakeDb({ vinculo: false });
  expect((await compromissoService.criar(t.db, admin, valido)).status).toBe(403);
  expect(gravou(t.calls)).toBe(false);
  expect(historicos(t.calls)).toHaveLength(0);
});

test("criar: conflito sem confirmar 409; com confirmar 201", async () => {
  let t = fakeDb({ conflito: true });
  const r = await compromissoService.criar(t.db, admin, valido);
  expect(r.status).toBe(409);
  expect(r.body.conflito).toBe(true);
  expect(gravou(t.calls)).toBe(false);
  expect(historicos(t.calls)).toHaveLength(0);
  t = fakeDb({ conflito: true });
  expect((await compromissoService.criar(t.db, admin, { ...valido, confirmar: true })).status).toBe(201);
  expect(historicos(t.calls)[0].params[1]).toBe("COMPROMISSO_CRIADO");
  t = fakeDb({ conflito: true });
  expect((await compromissoService.criar(t.db, admin, { ...valido, confirmar: "true" })).status).toBe(409);
});

test("criar: conflito consulta a mesma pessoa e data_hora exatos", async () => {
  const t = fakeDb();
  await compromissoService.criar(t.db, admin, valido);
  const c = t.calls.find((x) => /id_compromisso <> \?/.test(x.sql));
  expect(c.params).toEqual([5, "2026-06-10 09:30:00", 0]);
});

test("criar: falha no historico faz rollback e propaga erro", async () => {
  const t = fakeDb({ falhaHistorico: true });
  await expect(compromissoService.criar(t.db, admin, valido)).rejects.toThrow();
  expect(t.calls.some((c) => c.sql === "ROLLBACK")).toBe(true);
  expect(t.calls.some((c) => c.sql === "COMMIT")).toBe(false);
});

test("editar: 200 com historico; conflito ignora o proprio", async () => {
  const t = fakeDb();
  expect((await compromissoService.editar(t.db, admin, 7, valido)).status).toBe(200);
  expect(historicos(t.calls)[0].params[1]).toBe("COMPROMISSO_ALTERADO");
  expect(t.calls.find((x) => /id_compromisso <> \?/.test(x.sql)).params[2]).toBe(7);
});

test("editar: 409 sem confirmar mantem dados; 200 com confirmar", async () => {
  let t = fakeDb({ conflito: true });
  const r = await compromissoService.editar(t.db, admin, 7, valido);
  expect(r.status).toBe(409);
  expect(r.body.conflito).toBe(true);
  expect(gravou(t.calls)).toBe(false);
  expect(historicos(t.calls)).toHaveLength(0);
  t = fakeDb({ conflito: true });
  expect((await compromissoService.editar(t.db, admin, 7, { ...valido, confirmar: true })).status).toBe(200);
});

test("editar: 404, 403 e 400 sem historico", async () => {
  let t = fakeDb({ existe: false });
  expect((await compromissoService.editar(t.db, admin, 7, valido)).status).toBe(404);
  t = fakeDb({ vinculo: false });
  expect((await compromissoService.editar(t.db, admin, 7, valido)).status).toBe(403);
  expect(gravou(t.calls)).toBe(false);
  expect(historicos(t.calls)).toHaveLength(0);
  t = fakeDb();
  expect((await compromissoService.editar(t.db, admin, 7, { ...valido, descricao: "" })).status).toBe(400);
  expect(gravou(t.calls)).toBe(false);
  expect(historicos(t.calls)).toHaveLength(0);
});

test("excluir: 200 com COMPROMISSO_EXCLUIDO; 404 e 403 sem historico", async () => {
  let t = fakeDb();
  expect((await compromissoService.excluir(t.db, admin, 7)).status).toBe(200);
  expect(t.calls.some((c) => /DELETE FROM COMPROMISSO/.test(c.sql))).toBe(true);
  expect(historicos(t.calls)[0].params[1]).toBe("COMPROMISSO_EXCLUIDO");
  t = fakeDb({ existe: false });
  expect((await compromissoService.excluir(t.db, admin, 7)).status).toBe(404);
  t = fakeDb({ vinculo: false });
  expect((await compromissoService.excluir(t.db, admin, 7)).status).toBe(403);
  expect(gravou(t.calls)).toBe(false);
  expect(historicos(t.calls)).toHaveLength(0);
});

test("excluir: falha no historico faz rollback", async () => {
  const t = fakeDb({ falhaHistorico: true });
  await expect(compromissoService.excluir(t.db, admin, 7)).rejects.toThrow();
  expect(t.calls.some((c) => c.sql === "ROLLBACK")).toBe(true);
});

test("listar: 200, filtro valido e 400 para id_pessoa invalido", async () => {
  const t = fakeDb();
  expect((await compromissoService.listar(t.db, admin, undefined)).status).toBe(200);
  expect((await compromissoService.listar(t.db, admin, "5")).status).toBe(200);
  for (const ruim of ["0", "-1", "abc", "1.5"]) {
    expect((await compromissoService.listar(t.db, admin, ruim)).status).toBe(400);
  }
});
