const el = (id) => document.getElementById(id);
const LIMITE = 20;
let paginaAtual = 1;
let totalPaginas = 1;

function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function dataHora(valor) {
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? String(valor) : d.toLocaleString("pt-BR");
}

function atualizarBotoes() {
  el("btn-anterior").disabled = paginaAtual <= 1;
  el("btn-proxima").disabled = paginaAtual >= totalPaginas;
  el("pagina-info").textContent = `Página ${paginaAtual} de ${totalPaginas}`;
}

async function carregar(pagina) {
  try {
    const resposta = await fetch(`/api/historico?pagina=${pagina}&limite=${LIMITE}`, { credentials: "same-origin" });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.error || "Ocorreu um erro.");
    el("erro").textContent = "";
    paginaAtual = dados.pagina;
    totalPaginas = Math.max(1, Math.ceil(dados.total / dados.limite));
    const registros = dados.registros || [];
    el("vazio").hidden = registros.length > 0;
    el("registros").innerHTML = registros.map((r) =>
      `<tr><td>${esc(String(r.acao).replaceAll("_", " ").toLowerCase())}</td><td>${esc(r.responsavel)}</td><td>${esc(dataHora(r.data_hora))}</td><td>${esc(r.detalhes || "")}</td></tr>`
    ).join("");
  } catch (erro) {
    el("erro").textContent = erro.message;
  }
  atualizarBotoes();
}

el("btn-anterior").addEventListener("click", () => {
  if (paginaAtual > 1) carregar(paginaAtual - 1);
});

el("btn-proxima").addEventListener("click", () => {
  if (paginaAtual < totalPaginas) carregar(paginaAtual + 1);
});

carregar(1);
