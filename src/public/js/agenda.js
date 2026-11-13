const el = (id) => document.getElementById(id);

const ROTULOS = { PENDENTE: "Pendente", ASSUMIDA: "Assumida", CONCLUIDA: "Concluída", CANCELADA: "Cancelada" };

function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function dataHora(valor) {
  if (!valor) return "Sem data definida";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? String(valor) : d.toLocaleString("pt-BR");
}

async function carregar(filtros = {}) {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor) params.set(chave, valor);
  });
  const consulta = params.toString();
  try {
    const resposta = await fetch(`/api/agenda${consulta ? `?${consulta}` : ""}`, { credentials: "same-origin" });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.error || "Ocorreu um erro.");
    el("erro").textContent = "";
    const itens = dados.itens || [];
    el("vazio").hidden = itens.length > 0;
    el("itens").innerHTML = itens.map((i) =>
      `<tr><td>${i.origem === "ATIVIDADE" ? "Atividade" : "Compromisso"}</td><td>${esc(i.titulo)}</td><td>${esc(dataHora(i.data_hora))}</td><td>${esc(i.status ? (ROTULOS[i.status] || i.status) : "-")}</td><td>${esc(i.pessoa)}</td></tr>`
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
