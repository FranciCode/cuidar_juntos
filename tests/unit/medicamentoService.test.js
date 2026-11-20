const medicamentoService = require("../../src/services/medicamentoService");

const admin = { id: 1, perfil: "ADMIN" };
const colab = { id: 2, perfil: "COLABORADOR" };

function fakeDb(opts = {}) {
  const calls = [];
  const o = { vinculo: { pode_registrar_administracao: 1 }, existe: true, adm: 0, statusUsuario: "ATIVO", falhaHistorico: false, ...opts };
  const execute = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/INSERT INTO HISTORICO/.test(sql) && o.falhaHistorico) throw new Error("falha");
    if (/INSERT INTO MEDICAMENTO/.test(sql)) return [{ insertId: 7 }];
    if (/INSERT INTO ADMINISTRACAO/.test(sql)) return [{ insertId: 9 }];
    if (/FROM USUARIO_PESSOA up WHERE/.test(sql)) return [o.vinculo ? [o.vinculo] : []];
    if (/FROM MEDICAMENTO m WHERE .*FOR UPDATE/.test(sql)) return [o.existe ? [{ id_medicamento: 7, id_pessoa: 5 }] : []];
    if (/FROM MEDICAMENTO m WHERE/.test(sql)) return [[{ id_medicamento: 7, id_pessoa: 5, nome: "X" }]];
    if (/COUNT\(\*\)/.test(sql)) return [[{ total: o.adm }]];
    if (/FROM ADMINISTRACAO a/.test(sql)) return [[{ id_administracao: 9 }]];
    if (/WHERE u.id_usuario = \?/.test(sql)) return [[{ id_usuario: 2, status: o.statusUsuario, perfil: "COLABORADOR" }]];
    return [[]];
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
const valido = { id_pessoa: 5, nome: "Dipirona", instrucao_cadastrada: "1 comprimido de 8 em 8 horas" };

test("validarMedicamento: limites de nome e instrucao", () => {
  expect(medicamentoService.validarMedicamento({ nome: "a".repeat(151), instrucao_cadastrada: "x" }).erro).toBeDefined();
  expect(medicamentoService.validarMedicamento({ nome: "a".repeat(150), instrucao_cadastrada: "x" }).erro).toBeUndefined();
  expect(medicamentoService.validarMedicamento({ nome: "a", instrucao_cadastrada: "x".repeat(500) }).erro).toBeUndefined();
  expect(medicamentoService.validarMedicamento({ nome: "a", instrucao_cadastrada: "x".repeat(501) }).erro).toBeDefined();
  expect(medicamentoService.validarMedicamento({ nome: "  ", instrucao_cadastrada: "x" }).erro).toBeDefined();
  expect(medicamentoService.validarMedicamento({ nome: "a", instrucao_cadastrada: "  " }).erro).toBeDefined();
});

test("validarMedicamento guarda dose, frequencia e horarios como informado", () => {
  const r = medicamentoService.validarMedicamento({ nome: "a", instrucao_cadastrada: "x", dose: "5 ml", frequencia: "2x", horarios: "08:00, 20:00" });
  expect(r.extras).toEqual({ dose: "5 ml", frequencia: "2x", horarios: "08:00, 20:00" });
});

test("validarAdministracao: agora, passado, futuro, ausente, invalida, observacao longa", () => {
  const agora = new Date(2026, 5, 10, 12, 0, 0);
  expect(medicamentoService.validarAdministracao({ data_hora: "2026-06-10T12:00" }, agora).erro).toBeUndefined();
  expect(medicamentoService.validarAdministracao({ data_hora: "2025-06-10T12:00" }, agora).erro).toBeUndefined();
  expect(medicamentoService.validarAdministracao({ data_hora: "2026-06-10T12:01" }, agora).erro).toBeDefined();
  expect(medicamentoService.validarAdministracao({}, agora).erro).toBeDefined();
  expect(medicamentoService.validarAdministracao({ data_hora: "2026-02-30T10:00" }, agora).erro).toBeDefined();
  expect(medicamentoService.validarAdministracao({ data_hora: "abc" }, agora).erro).toBeDefined();
  expect(medicamentoService.validarAdministracao({ data_hora: "2026-06-10T10:00", observacao: "x".repeat(501) }, agora).erro).toBeDefined();
});

test("criar: 201 com historico MEDICAMENTO_CRIADO", async () => {
  const t = fakeDb();
  const r = await medicamentoService.criar(t.db, admin, valido);
  expect(r.status).toBe(201);
  expect(historicos(t.calls)[0].params[1]).toBe("MEDICAMENTO_CRIADO");
});

test("criar: 400 sem gravar nem historico; 403 sem vinculo", async () => {
  let t = fakeDb();
  expect((await medicamentoService.criar(t.db, admin, { ...valido, nome: " " })).status).toBe(400);
  expect(t.calls).toHaveLength(0);
  t = fakeDb({ vinculo: null });
  expect((await medicamentoService.criar(t.db, admin, valido)).status).toBe(403);
  expect(historicos(t.calls)).toHaveLength(0);
});

test("editar: 200 com historico, 404 inexistente, 403 sem vinculo", async () => {
  let t = fakeDb();
  expect((await medicamentoService.editar(t.db, admin, 7, valido)).status).toBe(200);
  expect(historicos(t.calls)[0].params[1]).toBe("MEDICAMENTO_ALTERADO");
  t = fakeDb({ existe: false });
  expect((await medicamentoService.editar(t.db, admin, 7, valido)).status).toBe(404);
  t = fakeDb({ vinculo: null });
  expect((await medicamentoService.editar(t.db, admin, 7, valido)).status).toBe(403);
  expect(historicos(t.calls)).toHaveLength(0);
});

test("excluir: 409 com administracoes; 200 sem", async () => {
  let t = fakeDb({ adm: 2 });
  expect((await medicamentoService.excluir(t.db, admin, 7)).status).toBe(409);
  expect(t.calls.some((c) => /DELETE FROM MEDICAMENTO/.test(c.sql))).toBe(false);
  t = fakeDb();
  expect((await medicamentoService.excluir(t.db, admin, 7)).status).toBe(200);
  expect(historicos(t.calls)[0].params[1]).toBe("MEDICAMENTO_EXCLUIDO");
});

test("registrarAdministracao: ADMIN 201 com id do autor e historico", async () => {
  const t = fakeDb({ vinculo: { pode_registrar_administracao: 0 } });
  const r = await medicamentoService.registrarAdministracao(t.db, admin, 7, { data_hora: "2020-01-01T08:00" }, new Date());
  expect(r.status).toBe(201);
  expect(t.calls.find((c) => /INSERT INTO ADMINISTRACAO/.test(c.sql)).params[1]).toBe(1);
  expect(historicos(t.calls)[0].params[1]).toBe("ADMINISTRACAO_REGISTRADA");
});

test("registrarAdministracao: colaborador com permissao 201; sem permissao e inativo 403", async () => {
  const dados = { data_hora: "2020-01-01T08:00" };
  expect((await medicamentoService.registrarAdministracao(fakeDb().db, colab, 7, dados)).status).toBe(201);
  let t = fakeDb({ vinculo: { pode_registrar_administracao: 0 } });
  expect((await medicamentoService.registrarAdministracao(t.db, colab, 7, dados)).status).toBe(403);
  expect(t.calls.some((c) => /INSERT INTO ADMINISTRACAO/.test(c.sql))).toBe(false);
  t = fakeDb({ statusUsuario: "INATIVO" });
  expect((await medicamentoService.registrarAdministracao(t.db, colab, 7, dados)).status).toBe(403);
  t = fakeDb({ vinculo: null });
  expect((await medicamentoService.registrarAdministracao(t.db, colab, 7, dados)).status).toBe(403);
  expect(historicos(t.calls)).toHaveLength(0);
});

test("registrarAdministracao: data futura 400 sem gravar", async () => {
  const t = fakeDb();
  const r = await medicamentoService.registrarAdministracao(t.db, admin, 7, { data_hora: "2999-01-01T08:00" });
  expect(r.status).toBe(400);
  expect(t.calls.some((c) => /INSERT INTO (ADMINISTRACAO|HISTORICO)/.test(c.sql))).toBe(false);
});

test("registrarAdministracao: falha no historico faz rollback e propaga erro", async () => {
  const t = fakeDb({ falhaHistorico: true });
  await expect(medicamentoService.registrarAdministracao(t.db, admin, 7, { data_hora: "2020-01-01T08:00" })).rejects.toThrow();
  expect(t.calls.some((c) => c.sql === "ROLLBACK")).toBe(true);
  expect(t.calls.some((c) => c.sql === "COMMIT")).toBe(false);
});

test("listarAdministracoes: 200 para vinculado; 403 sem vinculo", async () => {
  expect((await medicamentoService.listarAdministracoes(fakeDb().db, colab, 7)).status).toBe(200);
  expect((await medicamentoService.listarAdministracoes(fakeDb({ vinculo: null }).db, colab, 7)).status).toBe(403);
});
