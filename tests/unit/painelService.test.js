const painelService = require("../../src/services/painelService");

function fakeDb({ contagens = [], proximos = [] } = {}) {
  const calls = [];
  const execute = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/GROUP BY/.test(sql)) return [contagens];
    if (/FROM COMPROMISSO/.test(sql)) return [proximos];
    return [[]];
  };
  return { db: { execute }, calls };
}

test("conta pendentes, assumidas e concluidas por status", async () => {
  const t = fakeDb({ contagens: [{ status: "PENDENTE", total: 3 }, { status: "ASSUMIDA", total: "2" }, { status: "CONCLUIDA", total: 7 }] });
  const r = await painelService.obter(t.db, { id: 1 });
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ pendentes: 3, assumidas: 2, concluidas: 7, proximos_compromissos: [] });
});

test("sem vinculo ou sem dados: zeros e lista vazia", async () => {
  const r = await painelService.obter(fakeDb().db, { id: 1 });
  expect(r.body).toEqual({ pendentes: 0, assumidas: 0, concluidas: 0, proximos_compromissos: [] });
});

test("SQL restringe ao usuario, exclui CANCELADA e pede 5 proximos a partir de agora", async () => {
  const t = fakeDb();
  await painelService.obter(t.db, { id: 9 });
  const cont = t.calls.find((c) => /GROUP BY/.test(c.sql));
  expect(cont.params).toEqual([9]);
  expect(cont.sql).toMatch(/JOIN USUARIO_PESSOA/);
  expect(cont.sql).not.toMatch(/CANCELADA/);
  const prox = t.calls.find((c) => /FROM COMPROMISSO/.test(c.sql));
  expect(prox.params).toEqual([9]);
  expect(prox.sql).toMatch(/data_hora >= NOW\(\)/);
  expect(prox.sql).toMatch(/ORDER BY c.data_hora ASC/);
  expect(prox.sql).toMatch(/LIMIT 5/);
});

test("proximos_compromissos nunca passa de 5", async () => {
  const proximos = Array.from({ length: 7 }, (_, i) => ({ id: i + 1, titulo: `C${i}` }));
  const r = await painelService.obter(fakeDb({ proximos }).db, { id: 1 });
  expect(r.body.proximos_compromissos).toHaveLength(5);
  expect(r.body.proximos_compromissos[0].id).toBe(1);
});
