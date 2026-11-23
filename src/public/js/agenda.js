const el = (id) => document.getElementById(id);

const ROTULOS = { PENDENTE: "Pendente", ASSUMIDA: "Assumida", CONCLUIDA: "Concluída", CANCELADA: "Cancelada" };

function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function dataHora(valor) {
  if (!valor) return "Sem data definida";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  return d.toLocaleDateString("pt-BR") + " - " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

async function carregar(filtros = {}) {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor) params.set(chave, valor);
  });
  const consulta = params.toString();
  try {
    const resposta = await fetch((window.BASE_URL || "") + `/api/agenda${consulta ? `?${consulta}` : ""}`, { credentials: "same-origin" });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.error || "Ocorreu um erro.");
    el("erro").textContent = "";
    const tempo = (i) => { const t = i.data_hora ? new Date(i.data_hora).getTime() : NaN; return Number.isNaN(t) ? Infinity : t; };
    const itens = (dados.itens || []).slice().sort((a, b) => tempo(a) - tempo(b));
    el("vazio").hidden = itens.length > 0;
    el("itens").innerHTML = itens.map((i) =>
      `<tr${i.status === "PENDENTE" ? ' class="table-warning fw-bold" style="border-left:4px solid #dc3545"' : ""}><td>${i.origem === "ATIVIDADE" ? "Atividade" : "Compromisso"}</td><td>${esc(i.titulo)}</td><td>${esc(dataHora(i.data_hora))}</td><td>${i.status === "PENDENTE" ? '<span class="badge bg-danger">Pendente</span>' : esc(i.status ? (ROTULOS[i.status] || i.status) : "-")}</td><td>${esc(i.pessoa)}</td></tr>`
    ).join("");
  } catch (erro) {
    el("erro").textContent = erro.message;
  }
}

el("filtros").addEventListener("submit", (evento) => {
  evento.preventDefault();
  carregar({ de: el("f-de").value, ate: el("f-ate").value, status: el("f-status").value });
});

el("btn-limpar").addEventListener("click", () => {
  el("filtros").reset();
  carregar();
});

carregar();
