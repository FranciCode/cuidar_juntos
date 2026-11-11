const $ = (id) => document.getElementById(id);
let currentUser = null;
let activities = [];

function showMessage(element, message, type = "danger") {
  element.textContent = message;
  element.className = `alert alert-${type} mt-3`;
}
function hideMessage(element) {
  element.textContent = "";
  element.className = "alert d-none";
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Ocorreu um erro.");
  return data;
}
function setSignedIn(user) {
  currentUser = user;
  $("loginPanel").classList.toggle("d-none", !!user);
  $("appPanel").classList.toggle("d-none", !user);
  $("headerUser").textContent = user ? `${user.nome} · ${user.perfil === "ADMIN" ? "Administrador familiar" : "Colaborador"}` : "";
  $("createCard").classList.toggle("d-none", !user || user.perfil !== "ADMIN");
}
function formatDate(value) {
  if (!value) return "Sem data definida";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("pt-BR");
}
async function loadPeople() {
  const data = await api("/api/pessoas");
  $("person").innerHTML = data.pessoas.map(p => `<option value="${p.id_pessoa}">${escapeHtml(p.nome)}</option>`).join("");
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function statusLabel(status) {
  return ({ PENDENTE: "Pendente", ASSUMIDA: "Assumida", CANCELADA: "Cancelada", CONCLUIDA: "Concluída" })[status] || status;
}
async function loadActivities() {
  const data = await api("/api/atividades");
  activities = data.atividades;
  $("pendingCount").textContent = activities.filter(a => a.status === "PENDENTE").length;
  $("assignedCount").textContent = activities.filter(a => a.status === "ASSUMIDA").length;
  $("doneCount").textContent = activities.filter(a => a.status === "CONCLUIDA").length;
  $("activityList").innerHTML = activities.length ? activities.map(a => {
    const canAssume = a.status === "PENDENTE";
    const isMine = Number(a.id_responsavel) === Number(currentUser.id) || currentUser.perfil === "ADMIN";
    const canRelease = a.status === "ASSUMIDA" && isMine;
    const canComplete = a.status === "ASSUMIDA" && isMine;
    const actions = [
      canAssume ? `<button class="btn btn-sm btn-primary" data-action="assumir" data-id="${a.id_atividade}">Assumir</button>` : "",
      canRelease ? `<button class="btn btn-sm btn-outline-secondary" data-action="liberar" data-id="${a.id_atividade}">Liberar</button>` : "",
      canComplete ? `<button class="btn btn-sm btn-success" data-action="concluir" data-id="${a.id_atividade}">Concluir</button>` : ""
    ].filter(Boolean).join(" ");
    return `<article class="activity-item">
      <div><div class="activity-title">${escapeHtml(a.titulo)}</div>
      <div class="activity-meta">${escapeHtml(formatDate(a.data_hora))}</div>
      ${a.descricao ? `<div class="small mt-1">${escapeHtml(a.descricao)}</div>` : ""}
      <div class="small text-secondary mt-1">Responsável: ${escapeHtml(a.responsavel || "Ainda não assumida")}</div></div>
      <div class="d-flex flex-wrap align-items-center gap-2"><span class="status">${statusLabel(a.status)}</span>${actions}</div>
    </article>`;
  }).join("") : '<p class="text-secondary mb-0">Nenhuma atividade cadastrada.</p>';
}
async function loadHistory() {
  const data = await api("/api/historico");
  $("historyList").innerHTML = data.historico.length ? data.historico.map(h =>
    `<div class="history-row"><strong>${escapeHtml(h.usuario_nome)}</strong> · ${escapeHtml(h.acao.replaceAll("_", " ").toLowerCase())}<br><span>${escapeHtml(formatDate(h.data_hora))}</span></div>`
  ).join("") : "Nenhuma ação registrada até o momento.";
}
async function refresh() {
  try {
    await Promise.all([loadActivities(), loadHistory()]);
    hideMessage($("appMessage"));
  } catch (error) {
    showMessage($("appMessage"), error.message);
  }
}
$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  hideMessage($("loginMessage"));
  try {
    const data = await api("/api/login", { method: "POST", body: JSON.stringify({ email: $("email").value, senha: $("senha").value }) });
    setSignedIn(data.user);
    if (data.user.perfil === "ADMIN") await loadPeople();
    await refresh();
  } catch (error) {
    showMessage($("loginMessage"), error.message);
  }
});
$("logoutButton").addEventListener("click", async () => {
  try { await api("/api/logout", { method: "POST", body: "{}" }); } finally { setSignedIn(null); }
});
$("refreshButton").addEventListener("click", refresh);
$("activityForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const rawDate = $("dueDate").value;
    await api("/api/atividades", { method: "POST", body: JSON.stringify({
      id_pessoa: Number($("person").value),
      titulo: $("title").value,
      descricao: $("description").value,
      data_hora: rawDate ? rawDate.replace("T", " ") + ":00" : null
    }) });
    $("activityForm").reset();
    showMessage($("appMessage"), "Atividade cadastrada.", "success");
    await refresh();
  } catch (error) { showMessage($("appMessage"), error.message); }
});
$("activityList").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  try {
    await api(`/api/atividades/${button.dataset.id}/${button.dataset.action}`, { method: "PATCH", body: "{}" });
    showMessage($("appMessage"), "Atividade atualizada.", "success");
    await refresh();
  } catch (error) { showMessage($("appMessage"), error.message); }
});
(async function init() {
  try {
    const data = await api("/api/me");
    setSignedIn(data.user);
    if (data.user.perfil === "ADMIN") await loadPeople();
    await refresh();
  } catch (_error) {
    setSignedIn(null);
  }
})();
