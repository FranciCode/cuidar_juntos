const $ = (id) => document.getElementById(id);
let usuarios = [];
let editandoId = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
function mostrar(el, msg, type = "danger") {
  el.textContent = msg;
  el.className = `alert alert-${type} mt-3`;
}
function esconder(el) {
  el.textContent = "";
  el.className = "alert d-none";
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Ocorreu um erro.");
  return data;
}
function render() {
  if (!usuarios.length) {
    $("usuariosBody").innerHTML = '<tr><td colspan="5" class="text-center text-secondary">Nenhum usuário cadastrado</td></tr>';
    return;
  }
  $("usuariosBody").innerHTML = usuarios.map(u => `
    <tr>
      <td>${escapeHtml(u.nome)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td>${escapeHtml(u.perfil)}</td>
      <td>${escapeHtml(u.status)}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary" data-acao="editar" data-id="${u.id_usuario}">Editar</button>
        ${u.status === "ATIVO"
          ? `<button class="btn btn-sm btn-outline-danger" data-acao="desativar" data-id="${u.id_usuario}">Desativar</button>`
          : `<button class="btn btn-sm btn-outline-success" data-acao="reativar" data-id="${u.id_usuario}">Reativar</button>`}
      </td>
    </tr>`).join("");
}
async function carregar() {
  const data = await api("/api/usuarios");
  usuarios = data.usuarios;
  render();
}
function abrirForm(usuario) {
  editandoId = usuario ? usuario.id_usuario : null;
  $("formTitulo").textContent = usuario ? "Editar usuário" : "Novo usuário";
  $("nome").value = usuario ? usuario.nome : "";
  $("email").value = usuario ? usuario.email : "";
  $("email").disabled = !!usuario;
  $("senha").value = "";
  $("senha").required = !usuario;
  $("senhaGrupo").classList.toggle("d-none", !!usuario);
  $("perfil").value = usuario ? usuario.perfil : "COLABORADOR";
  $("permissao").checked = usuario ? !!usuario.pode_registrar_administracao : false;
  $("permissaoGrupo").classList.toggle("d-none", !usuario);
  esconder($("formMensagem"));
  $("formCard").classList.remove("d-none");
}
function fecharForm() {
  $("formCard").classList.add("d-none");
  editandoId = null;
}

$("novoUsuario").addEventListener("click", () => abrirForm(null));
$("cancelar").addEventListener("click", fecharForm);

$("usuarioForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  esconder($("formMensagem"));
  try {
    if (editandoId) {
      const data = await api(`/api/usuarios/${editandoId}`, {
        method: "PUT",
        body: JSON.stringify({ nome: $("nome").value, perfil: $("perfil").value, pode_registrar_administracao: $("permissao").checked })
      });
      usuarios = usuarios.map(u => u.id_usuario === editandoId ? data.usuario : u);
    } else {
      const data = await api("/api/usuarios", {
        method: "POST",
        body: JSON.stringify({ nome: $("nome").value, email: $("email").value, senha: $("senha").value, perfil: $("perfil").value })
      });
      usuarios.push(data.usuario);
    }
    render();
    fecharForm();
  } catch (error) {
    mostrar($("formMensagem"), error.message);
  }
});

$("usuariosBody").addEventListener("click", async (event) => {
  const botao = event.target.closest("button[data-acao]");
  if (!botao) return;
  const id = Number(botao.dataset.id);
  const usuario = usuarios.find(u => u.id_usuario === id);
  esconder($("tabelaMensagem"));
  if (botao.dataset.acao === "editar") return abrirForm(usuario);
  const status = botao.dataset.acao === "desativar" ? "INATIVO" : "ATIVO";
  if (status === "INATIVO" && !window.confirm(`Desativar o usuário ${usuario.nome}?`)) return;
  try {
    const data = await api(`/api/usuarios/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    usuarios = usuarios.map(u => u.id_usuario === id ? data.usuario : u);
    render();
  } catch (error) {
    mostrar($("tabelaMensagem"), error.message);
  }
});

(async () => {
  try {
    const me = await api("/api/me");
    if (me.user.perfil !== "ADMIN") return void (window.location.href = "/");
    await carregar();
  } catch (_error) {
    window.location.href = "/";
  }
})();
