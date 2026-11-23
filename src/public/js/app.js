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
  const response = await fetch((window.BASE_URL || "") + url, {
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
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR") + " - " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function statusLabel(status) {
  return ({ PENDENTE: "Pendente", ASSUMIDA: "Assumida", CANCELADA: "Cancelada", CONCLUIDA: "Concluída" })[status] || status;
}
async function loadActivities() {
  const data = await api("/api/atividades");
  activities = data.atividades.filter(a => a.status === "PENDENTE");
  $("pendingCount").textContent = activities.length;
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
      <div><div class="activity-title">${escapeHtml(a.titulo)}${a.pessoa ? " - Para " + escapeHtml(a.pessoa) : ""}</div>
      <div class="activity-meta">${escapeHtml(formatDate(a.data_hora))}</div>
      ${a.descricao ? `<div class="small mt-1">${escapeHtml(a.descricao)}</div>` : ""}
      <div class="small text-secondary mt-1">Responsável: ${a.responsavel ? escapeHtml(a.responsavel) : '<span class="text-danger fw-bold">N\u00e3o definido</span>'}</div></div>
      <div class="d-flex flex-wrap align-items-center gap-2">${a.status === "PENDENTE" ? `<span class="badge bg-danger fs-6">${statusLabel(a.status)}</span>` : `<span class="status">${statusLabel(a.status)}</span>`}${actions}</div>
    </article>`;
  }).join("") : '<p class="text-secondary mb-0">Nenhuma atividade pendente.</p>';
}
async function loadMedications() {
  const data = await api("/api/medicamentos");
  const lista = data.medicamentos || [];
  const agora = new Date();
  const hoje = agora.toDateString();
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  let pendentes = [];
  let totalAtrasos = 0;
  const assumidos = new Set();
  try {
    const oc = await api("/api/ocorrencias?tipo=MEDICAMENTO");
    (oc.ocorrencias || []).forEach(o => assumidos.add(o.id_ref + "|" + o.chave));
  } catch (_e) { /* sem ocorrencias */ }
  const dh = agora.getFullYear() + "-" + String(agora.getMonth() + 1).padStart(2, "0") + "-" + String(agora.getDate()).padStart(2, "0");
  const fmt = min => String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");
  try {
    const marcados = await Promise.all(lista.map(async m => {
      const r = await api(`/api/medicamentos/${m.id_medicamento}/administracoes`);
      const feitasMin = (r.administracoes || []).map(x => new Date(x.data_hora)).filter(d => d.toDateString() === hoje).map(d => d.getHours() * 60 + d.getMinutes());
      const feitas = feitasMin.length;
      const horas = (String(m.horarios || "").match(/\b([01]?\d|2[0-3])(?:[:h][0-5]\d|h)\b/g) || []).map(h => { const p = h.split(/[:h]/); return Number(p[0]) * 60 + Number(p[1]); });
      horas.sort((a, b) => a - b);
      if (!horas.length) return feitas < 1 ? { m, proxima: null, atrasadas: [] } : null;
      const restantes = horas.slice();
      feitasMin.forEach(f => {
        let melhor = 0;
        restantes.forEach((h, i) => { if (Math.abs(h - f) < Math.abs(restantes[melhor] - f)) melhor = i; });
        restantes.splice(melhor, 1);
      });
      if (!restantes.length) return null;
      const pend = restantes.filter(h => !assumidos.has(m.id_medicamento + "|" + dh + " " + fmt(h)));
      if (restantes.some(h => h <= minutosAgora)) totalAtrasos += 1;
      if (!pend.length) return null;
      const futuras = pend.filter(h => h > minutosAgora);
      return { m, proxima: futuras.length ? futuras[0] : null, atrasadas: pend.filter(h => h <= minutosAgora) };
    }));
    pendentes = marcados.filter(Boolean);
  } catch (_e) { pendentes = []; }
  $("medPendingCount").textContent = pendentes.length;
  const nAtr = totalAtrasos;
  const alertaAtr = nAtr ? '<div class="alert alert-danger fw-bold" role="alert">ALERTA: ' + nAtr + ' medicamento(s) com horário vencido e administração não registrada!</div>' : "";
  $("medList").innerHTML = alertaAtr + (pendentes.length ? pendentes.map(({ m, proxima, atrasadas }) => {
    const extra = [];
    if (atrasadas.length) extra.push("atrasada: " + atrasadas.map(fmt).join(", "));
    if (proxima !== null) extra.push("próxima dose -> " + fmt(proxima));
    else if (!atrasadas.length && m.horarios) extra.push(escapeHtml(m.horarios));
    const detalhes = [m.dose, m.frequencia].filter(Boolean).map(escapeHtml).concat(extra).join(" - ");
    const atrasado = atrasadas.length > 0;
    return `<div class="history-row d-flex flex-wrap justify-content-between align-items-center gap-3"${atrasado ? ' style="color:#dc3545"' : ""}><div><strong>${escapeHtml(m.nome)}</strong>${m.pessoa ? " - Para " + escapeHtml(m.pessoa) : ""}${detalhes ? `<br><span>${detalhes}</span>` : ""}</div><div class="text-center"><span class="badge ${atrasado ? "bg-danger" : "bg-secondary"} fs-6">Pendente</span></div><div class="text-end text-body" style="min-width:180px"><div class="small text-secondary">Responsável</div><strong class="${m.responsaveis ? "" : "text-danger fw-bold"}">${escapeHtml(m.responsaveis || "Não definido")}</strong></div></div>`;
  }).join("") : "Nenhum medicamento pendente no momento.");
}
async function carregarPendentesCompromissos() {
  try {
    const r = await api("/api/compromissos");
    const pend = (r.compromissos || []).filter(c => c.vencido);
    $("apptPendingCount").textContent = pend.length;
    $("apptList").innerHTML = pend.length ? pend.map(c => `<div class="history-row d-flex flex-wrap justify-content-between align-items-center gap-3"><div><strong>${escapeHtml(c.descricao)}</strong>${c.pessoa ? " - Para " + escapeHtml(c.pessoa) : ""}<br><span>${c.tipo === "EXAME" ? "Exame" : "Consulta"} - ${escapeHtml(formatDate(c.data_hora))}</span></div><div class="text-center"><span class="badge bg-danger fs-6">${escapeHtml(statusLabel(c.status || "PENDENTE"))}</span></div><div class="text-end" style="min-width:180px"><div class="small text-secondary">Responsável</div><strong class="${c.responsavel ? '' : 'text-danger'}">${escapeHtml(c.responsavel || "N\u00e3o definido")}</strong></div></div>`).join("") : "Nenhuma consulta ou exame pendente.";
  } catch (_e) {
    $("apptPendingCount").textContent = "0";
    $("apptList").textContent = "Nenhuma consulta ou exame pendente.";
  }
}
async function refresh() {
  try {
    await Promise.all([loadActivities(), loadMedications(), carregarPendentesCompromissos()]);
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
let podeCadastrar = false;
const conviteUrl = new URLSearchParams(window.location.search).get("convite");
(async function configurarCadastro() {
  try {
    const estado = await api("/api/login/estado");
    podeCadastrar = !!estado.primeiro_acesso || !!conviteUrl;
  } catch (_e) {
    podeCadastrar = !!conviteUrl;
  }
  if (!podeCadastrar || resetToken) return;
  $("authToggleRow").classList.remove("d-none");
  if (conviteUrl) {
    $("regConvite").value = conviteUrl;
    $("toggleAuth").click();
    window.history.replaceState(null, "", window.location.pathname);
  }
})();
const resetToken = new URLSearchParams(window.location.search).get("redefinir");
if (resetToken) {
  $("loginForm").classList.add("d-none");
  $("registerForm").classList.add("d-none");
  $("authToggleRow").classList.add("d-none");
  $("forgotHint").classList.add("d-none");
  $("resetForm").classList.remove("d-none");
  window.history.replaceState(null, "", window.location.pathname);
}
$("resetForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  hideMessage($("loginMessage"));
  if ($("resetSenha").value !== $("resetSenha2").value) return showMessage($("loginMessage"), "As senhas não conferem.");
  try {
    await api("/api/login/redefinir-senha", { method: "POST", body: JSON.stringify({ token: resetToken, senha: $("resetSenha").value }) });
    $("resetForm").reset();
    $("resetForm").classList.add("d-none");
    $("loginForm").classList.remove("d-none");
    $("authToggleRow").classList.remove("d-none");
    $("forgotHint").classList.remove("d-none");
    showMessage($("loginMessage"), "Senha redefinida. Entre com a nova senha.", "success");
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
