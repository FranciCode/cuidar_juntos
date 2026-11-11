(function () {
  const $ = (id) => document.getElementById(id);
  let usuario = null;
  let pessoa = null;
  let modo = null;

  async function api(url, opcoes) {
    const res = await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...opcoes
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  }

  function formatarData(iso) {
    if (!iso) return "-";
    const [a, m, d] = String(iso).slice(0, 10).split("-");
    return `${d}/${m}/${a}`;
  }

  function render() {
    const admin = usuario && usuario.perfil === "ADMIN";
    $("vazio").hidden = !!pessoa;
    $("pessoa").hidden = !pessoa;
    if (pessoa) {
      $("p-nome").textContent = pessoa.nome;
      $("p-nascimento").textContent = formatarData(pessoa.data_nascimento);
      $("p-status").textContent = pessoa.status;
    }
    $("acoes-admin").hidden = !admin;
    $("btn-nova").hidden = !admin || !!pessoa;
    $("btn-editar").hidden = !admin || !pessoa;
    $("btn-desativar").hidden = !admin || !pessoa || pessoa.status !== "ATIVO";
    $("btn-reativar").hidden = !admin || !pessoa || pessoa.status !== "INATIVO";
  }

  function abrirForm(novo) {
    modo = novo ? "novo" : "editar";
    $("form-titulo").textContent = novo ? "Nova pessoa" : "Editar pessoa";
    $("f-nome").value = novo ? "" : pessoa.nome;
    $("f-nascimento").value = novo ? "" : String(pessoa.data_nascimento || "").slice(0, 10);
    $("f-consentimento").checked = false;
    $("l-consentimento").hidden = !novo;
    $("erro").textContent = "";
    $("form").hidden = false;
    $("f-nome").focus();
  }

  function fecharForm() {
    $("form").hidden = true;
    modo = null;
  }

  async function salvar(ev) {
    ev.preventDefault();
    $("erro").textContent = "";
    const dados = { nome: $("f-nome").value, data_nascimento: $("f-nascimento").value };
    let res;
    if (modo === "novo") {
      dados.consentimento = $("f-consentimento").checked;
      res = await api("/api/pessoas", { method: "POST", body: JSON.stringify(dados) });
    } else {
      res = await api(`/api/pessoas/${pessoa.id_pessoa}`, { method: "PUT", body: JSON.stringify(dados) });
    }
    if (res.status === 200 || res.status === 201) {
      pessoa = res.body.pessoa;
      fecharForm();
      render();
    } else {
      $("erro").textContent = res.body.error || "Não foi possível salvar.";
    }
  }

  async function alterarStatus(status, confirmar) {
    $("erro-geral").textContent = "";
    const corpo = { status };
    if (confirmar) corpo.confirmar = true;
    const res = await api(`/api/pessoas/${pessoa.id_pessoa}/status`, { method: "PATCH", body: JSON.stringify(corpo) });
    if (res.status === 200) {
      pessoa = res.body.pessoa;
      render();
    } else if (res.status === 409) {
      if (window.confirm(`Esta pessoa tem ${res.body.pendentes} atividade(s) pendente(s). Desativar mesmo assim?`)) {
        await alterarStatus(status, true);
      }
    } else {
      $("erro-geral").textContent = res.body.error || "Não foi possível alterar o status.";
    }
  }

  async function iniciar() {
    const me = await api("/api/me");
    if (me.status !== 200) {
      window.location.href = "/pages/index.html";
      return;
    }
    usuario = me.body.user;
    const lista = await api("/api/pessoas");
    if (lista.status === 200) pessoa = lista.body.pessoas[0] || null;
    else $("erro-geral").textContent = lista.body.error || "Não foi possível carregar a pessoa.";
    render();
  }

  $("btn-nova").addEventListener("click", () => abrirForm(true));
  $("btn-editar").addEventListener("click", () => abrirForm(false));
  $("btn-cancelar").addEventListener("click", fecharForm);
  $("btn-desativar").addEventListener("click", () => alterarStatus("INATIVO", false));
  $("btn-reativar").addEventListener("click", () => alterarStatus("ATIVO", false));
  $("form").addEventListener("submit", salvar);
  iniciar();
})();
