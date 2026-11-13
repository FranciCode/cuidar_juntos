const el = (id) => document.getElementById(id);

function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function dataHora(valor) {
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? String(valor) : d.toLocaleString("pt-BR");
}

async function carregar() {
  try {
    const resposta = await fetch("/api/painel", { credentials: "same-origin" });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.error || "Ocorreu um erro.");
    el("erro").textContent = "";
    el("c-pendentes").textContent = dados.pendentes;
    el("c-assumidas").textContent = dados.assumidas;
    el("c-concluidas").textContent = dados.concluidas;
    const lista = dados.proximos_compromissos || [];
    el("vazio").hidden = lista.length > 0;
    el("lista").innerHTML = lista.map((c) =>
      `<li>${esc(dataHora(c.data_hora))} - ${esc(c.titulo)} (${esc(c.pessoa)})</li>`
    ).join("");
  } catch (erro) {
    el("erro").textContent = erro.message;
  }
}

carregar();
