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
  $("headerUser").textContent = user ? `${user.nome} · ${({ ADMIN: "Administrador familiar", PESSOA_ASSISTIDA: "Pessoa assistida" })[user.perfil] || "Colaborador"}` : "";
  document.querySelectorAll("#mainNav [data-roles]").forEach(a => a.classList.toggle("d-none", !user || !a.dataset.roles.split(",").includes(user.perfil)));
}
function formatDate(value) {
  if (!value) return "Sem data definida";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("pt-BR");
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
async function loadMedications() {
  const data = await api("/api/medicamentos");
  const lista = data.medicamentos || [];
  $("medList").innerHTML = lista.length ? lista.map(m => {
    const detalhes = [m.dose, m.frequencia, m.horarios].filter(Boolean).map(escapeHtml).join(" · ");
    return `<div class="history-row"><strong>${escapeHtml(m.nome)}</strong>${detalhes ? `<br><span>${detalhes}</span>` : ""}</div>`;
  }).join("") : "Nenhum medicamento cadastrado até o momento.";
}
async function refresh() {
  try {
    await Promise.all([loadActivities(), loadMedications()]);
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
    await refresh();
  } catch (error) {
    showMessage($("loginMessage"), error.message);
  }
});
$("toggleAuth").addEventListener("click", (event) => {
  event.preventDefault();
  const registering = $("registerForm").classList.toggle("d-none") === false;
  $("loginForm").classList.toggle("d-none", registering);
  $("toggleText").textContent = registering ? "Já tem conta?" : "Ainda não tem conta?";
  $("toggleAuth").textContent = registering ? "Entrar" : "Criar conta";
  hideMessage($("loginMessage"));
});
$("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  hideMessage($("loginMessage"));
  try {
    const data = await api("/api/login/cadastro", { method: "POST", body: JSON.stringify({ nome: $("regNome").value, email: $("regEmail").value, senha: $("regSenha").value, convite: $("regConvite").value.trim() }) });
    $("registerForm").reset();
    setSignedIn(data.user);
    await refresh();
  } catch (error) {
    showMessage($("loginMessage"), error.message);
  }
});
$("logoutButton").addEventListener("click", async () => {
  try { await api("/api/logout", { method: "POST", body: "{}" }); } finally { setSignedIn(null); }
});
$("refreshButton").addEventListener("click", refresh);
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
    await refresh();
  } catch (_error) {
    setSignedIn(null);
  }
})();
