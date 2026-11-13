(function () {
  const $ = (id) => document.getElementById(id);
  let usuario = null;
  let medicamentos = [];
  let editando = null;
  let atual = null;

  async function api(url, opcoes) {
    const res = await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...opcoes
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  }

  function formatarData(valor) {
    if (!valor) return "-";
    const [data, hora] = String(valor).split("T");
    const [a, m, d] = data.split("-");
    return `${d}/${m}/${a}${hora ? " " + hora : ""}`;
  }

  function botao(texto, acao) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = texto;
    b.addEventListener("click", acao);
    return b;
  }

  function celula(tr, conteudo) {
    const td = document.createElement("td");
    if (conteudo instanceof Node) td.appendChild(conteudo);
    else td.textContent = conteudo;
    tr.appendChild(td);
    return td;
  }

  function ehAdmin() {
    return usuario && usuario.perfil === "ADMIN";
  }

  function render() {
    $("btn-novo").hidden = !ehAdmin();
    $("vazio").hidden = medicamentos.length > 0;
    $("tabela").hidden = medicamentos.length === 0;
    const corpo = $("corpo");
    corpo.textContent = "";
    medicamentos.forEach((m) => {
      const tr = document.createElement("tr");
      celula(tr, m.nome);
      celula(tr, m.instrucao_cadastrada || "");
      const acoes = document.createElement("div");
      acoes.appendChild(botao("Histórico", () => abrirPainel(m)));
      if (m.pode_registrar_administracao) acoes.appendChild(botao("Registrar administração", () => abrirPainel(m, true)));
      if (ehAdmin()) {
        acoes.appendChild(botao("Editar", () => abrirForm(m)));
        acoes.appendChild(botao("Excluir", () => excluir(m)));
      }
      celula(tr, acoes);
      corpo.appendChild(tr);
    });
  }

  function limparMensagens() {
    $("erro-geral").textContent = "";
    $("erro").textContent = "";
    $("erro-adm").textContent = "";
  }

  async function carregar() {
    const res = await api("/api/medicamentos");
    if (res.status === 200) {
      medicamentos = res.body.medicamentos;
      render();
    } else {
      $("erro-geral").textContent = res.body.error || "Não foi possível carregar os medicamentos.";
    }
  }

  async function excluir(m) {
    limparMensagens();
    if (!window.confirm("Excluir este medicamento?")) return;
    const res = await api(`/api/medicamentos/${m.id_medicamento}`, { method: "DELETE" });
    if (res.status === 200) {
      if (atual && atual.id_medicamento === m.id_medicamento) fecharPainel();
      await carregar();
    } else {
      $("erro-geral").textContent = res.body.error || "Não foi possível excluir.";
    }
  }

  async function abrirForm(m) {
    limparMensagens();
    editando = m || null;
    $("form-titulo").textContent = m ? "Editar medicamento" : "Novo medicamento";
    $("l-pessoa").hidden = !!m;
    $("f-nome").value = m ? m.nome : "";
    $("f-instrucao").value = m && m.instrucao_cadastrada ? m.instrucao_cadastrada : "";
    if (!m) {
      const lista = await api("/api/pessoas");
      const pessoas = lista.status === 200 ? lista.body.pessoas : [];
      const sel = $("f-pessoa");
      sel.textContent = "";
      pessoas.forEach((p) => {
        const o = document.createElement("option");
        o.value = p.id_pessoa;
        o.textContent = p.nome;
        sel.appendChild(o);
      });
    }
    $("form").hidden = false;
    $("f-nome").focus();
  }

  function fecharForm() {
    $("form").hidden = true;
    editando = null;
  }

  async function salvar(ev) {
    ev.preventDefault();
    limparMensagens();
    const dados = { nome: $("f-nome").value, instrucao_cadastrada: $("f-instrucao").value };
    let res;
    if (editando) {
      res = await api(`/api/medicamentos/${editando.id_medicamento}`, { method: "PUT", body: JSON.stringify(dados) });
    } else {
      dados.id_pessoa = Number($("f-pessoa").value);
      res = await api("/api/medicamentos", { method: "POST", body: JSON.stringify(dados) });
    }
    if (res.status === 200 || res.status === 201) {
      fecharForm();
      await carregar();
    } else {
      $("erro").textContent = res.body.error || "Não foi possível salvar.";
    }
  }

  async function carregarHistorico() {
    const res = await api(`/api/medicamentos/${atual.id_medicamento}/administracoes`);
    if (res.status !== 200) {
      $("erro-adm").textContent = res.body.error || "Não foi possível carregar o histórico.";
      return;
    }
    const lista = res.body.administracoes;
    $("vazio-hist").hidden = lista.length > 0;
    $("tabela-hist").hidden = lista.length === 0;
    const corpo = $("corpo-hist");
    corpo.textContent = "";
    lista.forEach((a) => {
      const tr = document.createElement("tr");
      celula(tr, formatarData(a.data_hora));
      celula(tr, a.observacao || "-");
      celula(tr, a.registrado_por || "-");
      corpo.appendChild(tr);
    });
  }

  async function abrirPainel(m, registrar) {
    limparMensagens();
    atual = m;
    $("painel-titulo").textContent = `Histórico - ${m.nome}`;
    $("form-adm").hidden = !m.pode_registrar_administracao;
    $("a-data").value = "";
    $("a-obs").value = "";
    $("painel").hidden = false;
    await carregarHistorico();
    if (registrar && m.pode_registrar_administracao) $("a-data").focus();
  }

  function fecharPainel() {
    $("painel").hidden = true;
    atual = null;
  }

  async function registrarAdministracao(ev) {
    ev.preventDefault();
    limparMensagens();
    const dados = { data_hora: $("a-data").value, observacao: $("a-obs").value };
    const res = await api(`/api/medicamentos/${atual.id_medicamento}/administracoes`, {
      method: "POST",
      body: JSON.stringify(dados)
    });
    if (res.status === 201) {
      $("a-data").value = "";
      $("a-obs").value = "";
      await carregarHistorico();
    } else {
      $("erro-adm").textContent = res.body.error || "Não foi possível registrar.";
    }
  }

  async function iniciar() {
    const me = await api("/api/me");
    if (me.status !== 200) {
      window.location.href = "/pages/index.html";
      return;
    }
    usuario = me.body.user;
    await carregar();
  }

  $("btn-novo").addEventListener("click", () => abrirForm(null));
  $("btn-cancelar-form").addEventListener("click", fecharForm);
  $("btn-fechar-painel").addEventListener("click", fecharPainel);
  $("form").addEventListener("submit", salvar);
  $("form-adm").addEventListener("submit", registrarAdministracao);
  iniciar();
})();
