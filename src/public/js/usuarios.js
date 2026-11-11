(function () {
  const $ = (id) => document.getElementById(id);
  let usuarios = [];
  let editando = null;

  async function api(url, opcoes) {
    const res = await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...opcoes
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  }

  function celula(tr, texto) {
    const td = document.createElement("td");
    td.textContent = texto;
    tr.appendChild(td);
    return td;
  }

  function botao(td, texto, acao) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = texto;
    b.addEventListener("click", acao);
    td.appendChild(b);
  }

  function render() {
    const corpo = $("corpo");
    corpo.textContent = "";
    $("vazio").hidden = usuarios.length > 0;
    $("tabela").hidden = usuarios.length === 0;
    usuarios.forEach((u) => {
      const tr = document.createElement("tr");
      celula(tr, u.nome);
      celula(tr, u.email);
      celula(tr, u.perfil);
      celula(tr, u.status);
      const acoes = celula(tr, "");
      botao(acoes, "Editar", () => abrirForm(u));
      if (u.status === "ATIVO") botao(acoes, "Desativar", () => desativar(u));
      else botao(acoes, "Reativar", () => alterarStatus(u, "ATIVO"));
      corpo.appendChild(tr);
    });
  }

  async function carregar() {
    const res = await api("/api/usuarios");
    if (res.status === 200) {
      usuarios = res.body.usuarios;
      render();
    } else {
      $("erro-tabela").textContent = res.body.error || "Não foi possível carregar os usuários.";
    }
  }

  function abrirForm(u) {
    editando = u || null;
    $("form-titulo").textContent = u ? "Editar usuário" : "Novo usuário";
    $("f-nome").value = u ? u.nome : "";
    $("f-email").value = u ? u.email : "";
    $("f-senha").value = "";
    $("f-perfil").value = u ? u.perfil : "COLABORADOR";
    $("f-pode").checked = false;
    $("l-email").hidden = !!u;
    $("l-senha").hidden = !!u;
    $("erro").textContent = "";
    $("form").hidden = false;
  }

  function fecharForm() {
    $("form").hidden = true;
    editando = null;
  }

  async function salvar(ev) {
    ev.preventDefault();
    $("erro").textContent = "";
    let res;
    if (editando) {
      res = await api(`/api/usuarios/${editando.id_usuario}`, {
        method: "PUT",
        body: JSON.stringify({
          nome: $("f-nome").value,
          perfil: $("f-perfil").value,
          pode_registrar_administracao: $("f-pode").checked
        })
      });
    } else {
      res = await api("/api/usuarios", {
        method: "POST",
        body: JSON.stringify({
          nome: $("f-nome").value,
          email: $("f-email").value,
          senha: $("f-senha").value,
          perfil: $("f-perfil").value
        })
      });
    }
    if (res.status === 200 || res.status === 201) {
      fecharForm();
      await carregar();
    } else {
      $("erro").textContent = res.body.error || "Não foi possível salvar.";
    }
  }

  async function alterarStatus(u, status) {
    $("erro-tabela").textContent = "";
    const res = await api(`/api/usuarios/${u.id_usuario}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    if (res.status === 200) await carregar();
    else $("erro-tabela").textContent = res.body.error || "Não foi possível alterar o status.";
  }

  function desativar(u) {
    if (window.confirm(`Desativar o usuário ${u.nome}?`)) alterarStatus(u, "INATIVO");
  }

  async function iniciar() {
    const me = await api("/api/me");
    if (me.status !== 200 || me.body.user.perfil !== "ADMIN") {
      window.location.href = "/pages/index.html";
      return;
    }
    await carregar();
  }

  $("btn-novo").addEventListener("click", () => abrirForm(null));
  $("btn-cancelar").addEventListener("click", fecharForm);
  $("form").addEventListener("submit", salvar);
  iniciar();
})();
