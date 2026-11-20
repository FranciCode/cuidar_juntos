const pessoaService = require("../../src/services/pessoaService");

const admin = { id: 1, perfil: "ADMIN" };

function fakeDb(handler) {
  const calls = [];
  const conn = {
    execute: async (sql, params = []) => { calls.push({ sql, params }); return handler(sql, params); },
    beginTransaction: async () => calls.push({ sql: "BEGIN" }),
    commit: async () => calls.push({ sql: "COMMIT" }),
    rollback: async () => calls.push({ sql: "ROLLBACK" }),
    release: () => {}
  };
  return { db: { getConnection: async () => conn, execute: conn.execute }, calls };
}

const pessoa = (extra = {}) => ({ id_pessoa: 5, nome: "Maria", data_nascimento: "1950-01-01", status: "ATIVO", ...extra });

function hoje(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

test("validarDados: nome vazio, data futura e data de hoje", () => {
  expect(pessoaService.validarDados({ nome: "  ", data_nascimento: hoje() }).erro).toBeDefined();
  expect(pessoaService.validarDados({ nome: "Ana", data_nascimento: hoje(1) }).erro).toBeDefined();
  expect(pessoaService.validarDados({ nome: "Ana", data_nascimento: hoje() }).erro).toBeUndefined();
});

test("criar sem consentimento: 400 e nada gravado", async () => {
  const { db, calls } = fakeDb(async () => [[]]);
  const r = await pessoaService.criar(db, admin, { nome: "Ana", data_nascimento: hoje(), consentimento: "true" });
  expect(r.status).toBe(400);
  expect(calls).toHaveLength(0);
});

test("criar: 201, vincula só os usuarios ativos e registra historico com a entidade", async () => {
  const { db, calls } = fakeDb(async (sql) => {
    if (/INSERT INTO PESSOA_ASSISTIDA/.test(sql)) return [{ insertId: 5 }];
    if (/FROM USUARIO WHERE status/.test(sql)) return [[{ id_usuario: 1, perfil: "ADMIN" }, { id_usuario: 2, perfil: "COLABORADOR" }, { id_usuario: 3, perfil: "COLABORADOR" }]];
    if (/FROM PESSOA_ASSISTIDA p/.test(sql)) return [[pessoa()]];
    return [{}];
  });
  const r = await pessoaService.criar(db, admin, { nome: "Maria", data_nascimento: hoje(), consentimento: true });
  expect(r.status).toBe(201);
  const vinculos = calls.filter((c) => /INSERT INTO USUARIO_PESSOA/.test(c.sql));
  expect(vinculos.map((c) => c.params[2])).toEqual([1, 0, 0]);
  const hist = calls.find((c) => /INSERT INTO HISTORICO/.test(c.sql));
  expect(hist.params).toEqual([1, "PESSOA_CRIADA", "PESSOA_ASSISTIDA", 5, null]);
  expect(calls.some((c) => c.sql === "COMMIT")).toBe(true);
});

test("criar: falha no vinculo desfaz tudo", async () => {
  const { db, calls } = fakeDb(async (sql) => {
    if (/INSERT INTO PESSOA_ASSISTIDA/.test(sql)) return [{ insertId: 5 }];
    if (/FROM USUARIO WHERE status/.test(sql)) return [[{ id_usuario: 1, perfil: "ADMIN" }]];
    if (/INSERT INTO USUARIO_PESSOA/.test(sql)) throw new Error("falha");
    return [{}];
  });
  await expect(pessoaService.criar(db, admin, { nome: "Maria", data_nascimento: hoje(), consentimento: true })).rejects.toThrow();
  expect(calls.some((c) => c.sql === "ROLLBACK")).toBe(true);
  expect(calls.some((c) => /INSERT INTO HISTORICO/.test(c.sql))).toBe(false);
});

test("alterarStatus: 409 com pendentes e sem historico; com confirmar grava INATIVO", async () => {
  const handler = async (sql) => {
    if (/COUNT\(\*\)/.test(sql)) return [[{ total: 3 }]];
    if (/FROM PESSOA_ASSISTIDA p/.test(sql)) return [[pessoa()]];
    return [{}];
  };
  let t = fakeDb(handler);
  let r = await pessoaService.alterarStatus(t.db, admin, 5, { status: "INATIVO" });
  expect(r.status).toBe(409);
  expect(r.body.pendentes).toBe(3);
  expect(t.calls.some((c) => /INSERT INTO HISTORICO/.test(c.sql))).toBe(false);

  t = fakeDb(handler);
  r = await pessoaService.alterarStatus(t.db, admin, 5, { status: "INATIVO", confirmar: true });
  expect(r.status).toBe(200);
  expect(t.calls.some((c) => /UPDATE PESSOA_ASSISTIDA/.test(c.sql))).toBe(true);
  expect(t.calls.find((c) => /INSERT INTO HISTORICO/.test(c.sql)).params[1]).toBe("PESSOA_DESATIVADA");
});

test("alterarStatus: status invalido 400 e reativar 200", async () => {
  const t = fakeDb(async (sql) => (/FROM PESSOA_ASSISTIDA p/.test(sql) ? [[pessoa({ status: "INATIVO" })]] : [{}]));
  expect((await pessoaService.alterarStatus(t.db, admin, 5, { status: "X" })).status).toBe(400);
  expect((await pessoaService.alterarStatus(t.db, admin, 5, { status: "ATIVO" })).status).toBe(200);
  expect(t.calls.find((c) => /INSERT INTO HISTORICO/.test(c.sql)).params[1]).toBe("PESSOA_REATIVADA");
});
