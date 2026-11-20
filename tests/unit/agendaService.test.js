const agendaService = require("../../src/services/agendaService");

const usuario = { id: 1, perfil: "COLABORADOR" };

function fakeDb({ atividades = [], compromissos = [] } = {}) {
  const calls = [];
  const execute = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/FROM ATIVIDADE/.test(sql)) return [atividades];
    if (/FROM COMPROMISSO/.test(sql)) return [compromissos];
    return [[]];
  };
  return { db: { execute }, calls };
}

const ativ = (id, data_hora, status = "PENDENTE") => ({ origem: "ATIVIDADE", id, titulo: `A${id}`, data_hora, status, id_pessoa: 5, pessoa: "Maria" });
const comp = (id, data_hora) => ({ origem: "COMPROMISSO", id, titulo: `C${id}`, data_hora, status: "PENDENTE", id_pessoa: 5, pessoa: "Maria" });

test("une, ordena por data_hora e deixa atividade sem data no fim", async () => {
  const t = fakeDb({
    atividades: [ativ(1, null), ativ(2, new Date("2026-11-10T10:00:00")), ativ(3, "2026-11-12 08:00:00")],
    compromissos: [comp(4, "2026-11-11 09:00:00")]
  });
  const r = await agendaService.listar(t.db, usuario, {});
  expect(r.status).toBe(200);
  expect(r.body.itens.map((i) => i.id)).toEqual([2, 4, 3, 1]);
});

test("item tem os campos do plano e status null no compromisso", async () => {
  const t = fakeDb({ atividades: [ativ(1, "2026-11-10 10:00:00")], compromissos: [comp(2, "2026-11-11 10:00:00")] });
  const r = await agendaService.listar(t.db, usuario, {});
  expect(Object.keys(r.body.itens[0]).sort()).toEqual(["data_hora", "id", "id_pessoa", "origem", "pessoa", "status", "titulo"]);
  expect(r.body.itens[0].status).toBe("PENDENTE");
  expect(r.body.itens[1].status).toBeNull();
});

test("sem resultados: itens vazio", async () => {
  const r = await agendaService.listar(fakeDb().db, usuario, {});
  expect(r.body).toEqual({ itens: [] });
});

test("de e ate viram inicio do dia e fim do dia, inclusivos", async () => {
  const t = fakeDb();
  await agendaService.listar(t.db, usuario, { de: "2026-11-01", ate: "2026-11-10" });
  for (const c of t.calls) {
    expect(c.params).toContain("2026-11-01 00:00:00");
    expect(c.params).toContain("2026-11-10 23:59:59");
    expect(c.params[0]).toBe(1);
  }
  expect(t.calls).toHaveLength(2);
});

test("com de/ate o SQL de atividades omite as sem data", async () => {
  const t = fakeDb();
  await agendaService.listar(t.db, usuario, { de: "2026-11-01" });
  expect(t.calls[0].sql).toMatch(/data_hora IS NOT NULL/);
  const s = fakeDb();
  await agendaService.listar(s.db, usuario, {});
  expect(s.calls[0].sql).not.toMatch(/data_hora IS NOT NULL/);
});

test("status filtra so atividades e nao consulta compromissos", async () => {
  const t = fakeDb({ atividades: [ativ(1, "2026-11-10 10:00:00", "CONCLUIDA")] });
  const r = await agendaService.listar(t.db, usuario, { status: "CONCLUIDA" });
  expect(t.calls).toHaveLength(1);
  expect(t.calls[0].params).toContain("CONCLUIDA");
  expect(r.body.itens).toHaveLength(1);
});

test("400 para datas invalidas, de > ate e status invalido, sem consultar", async () => {
  const ruins = [
    { de: "10/11/2026" }, { ate: "2026-02-30" }, { de: "abc" }, { de: "2026-11-10", ate: "2026-11-01" },
    { status: "FEITA" }, { status: "pendente" }
  ];
  for (const q of ruins) {
    const t = fakeDb();
    const r = await agendaService.listar(t.db, usuario, q);
    expect(r.status).toBe(400);
    expect(r.body.error).toBeTruthy();
    expect(t.calls).toHaveLength(0);
  }
});

test("de igual a ate e aceito; CANCELADA e status valido", async () => {
  expect((await agendaService.listar(fakeDb().db, usuario, { de: "2026-11-10", ate: "2026-11-10" })).status).toBe(200);
  expect((await agendaService.listar(fakeDb().db, usuario, { status: "CANCELADA" })).status).toBe(200);
});
