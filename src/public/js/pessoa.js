(function () {
  const $ = (id) => document.getElementById(id);
  let usuario = null;
  let pessoa = null;
  let modo = null;

  async function api(url, opcoes) {
    const res = await fetch((window.BASE_URL || "") + url, {
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

  const CAMPOS = ["cpf", "rg", "cartao_sus", "sexo", "estado_civil", "endereco", "emergencia_nome", "emergencia_parentesco", "emergencia_telefone", "tipo_sanguineo", "alergias", "condicoes_saude", "medicamentos_continuos", "restricoes"];

  function calcularIdade(iso) {
    const nasc = parseInt(String(iso || "").slice(0, 4), 10);
    if (!nasc) return "-";
    return (new Date().getFullYear() - nasc) + " anos";
  }

  function formatarDataHora(valor) {
    if (!valor) return "-";
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("pt-BR");
  }

  function mostrarErro(id, msg) {
    $(id).textContent = msg || "";
    $(id).hidden = !msg;
  }

  function render() {
    const admin = usuario && usuario.perfil === "ADMIN";
    $("vazio").hidden = !!pessoa;
    $("pessoa").hidden = !pessoa;
    if (pessoa) {
      $("p-nome").textContent = pessoa.nome;
      $("p-nascimento").textContent = formatarData(pessoa.data_nascimento);
      $("p-status").textContent = pessoa.status;
      $("p-idade").textContent = calcularIdade(pessoa.data_nascimento);
      CAMPOS.forEach((c) => { $("p-" + c).textContent = pessoa[c] || "-"; });
      $("p-atualizado_em").textContent = formatarDataHora(pessoa.atualizado_em);
      $("p-atualizado_por").textContent = pessoa.atualizado_por_nome || "-";
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
    CAMPOS.forEach((c) => { $("f-" + c).value = novo ? "" : (pessoa[c] || ""); });
    $("f-consentimento").checked = false;
    $("l-consentimento").hidden = !novo;
    mostrarErro("erro", "");
    $("form").hidden = false;
    $("f-nome").focus();
  }

  function fecharForm() {
    $("form").hidden = true;
    modo = null;
  }

  async function salvar(ev) {
    ev.preventDefault();
    mostrarErro("erro", "");
    const dados = { nome: $("f-nome").value, data_nascimento: $("f-nascimento").value };
    CAMPOS.forEach((c) => { dados[c] = $("f-" + c).value; });
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
      mostrarErro("erro", res.body.error || "Não foi possível salvar.");
    }
  }

  async function alterarStatus(status, confirmar) {
    mostrarErro("erro-geral", "");
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
      mostrarErro("erro-geral", res.body.error || "Não foi possível alterar o status.");
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
    else mostrarErro("erro-geral", lista.body.error || "Não foi possível carregar a pessoa.");
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
