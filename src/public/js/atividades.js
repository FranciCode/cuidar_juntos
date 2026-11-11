(function () {
  const $ = (id) => document.getElementById(id);
  let usuario = null;
  let atividades = [];
  let pessoas = [];
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

  function render() {
    const admin = usuario && usuario.perfil === "ADMIN";
    $("btn-nova").hidden = !admin;
    $("vazio").hidden = atividades.length > 0;
    $("tabela").hidden = atividades.length === 0;
    const corpo = $("corpo");
    corpo.textContent = "";
    atividades.forEach((a) => {
      const tr = document.createElement("tr");
      celula(tr, a.titulo);
      celula(tr, formatarData(a.data_hora));
      celula(tr, a.status);
      celula(tr, a.responsavel || "-");
      const acoes = document.createElement("div");
      const aberta = a.status === "PENDENTE" || a.status === "ASSUMIDA";
      if (a.status === "PENDENTE") acoes.appendChild(botao("Assumir", () => acaoPatch(a, "assumir")));
      if (a.status === "ASSUMIDA" && (admin || a.id_responsavel === usuario.id)) {
        acoes.appendChild(botao("Liberar", () => acaoPatch(a, "liberar")));
        acoes.appendChild(botao("Concluir", () => acaoPatch(a, "concluir")));
      }
      if (admin && aberta) {
        acoes.appendChild(botao("Editar", () => abrirForm(a)));
        acoes.appendChild(botao("Cancelar", () => acaoPatch(a, "cancelar")));
      }
      celula(tr, acoes);
      corpo.appendChild(tr);
    });
  }

  function limparMensagens() {
    $("erro-geral").textContent = "";
    $("aviso").textContent = "";
    $("erro").textContent = "";
  }

  async function carregar() {
    const res = await api("/api/atividades");
    if (res.status === 200) {
      atividades = res.body.atividades;
      render();
    } else {
      $("erro-geral").textContent = res.body.error || "Não foi possível carregar as atividades.";
    }
  }

  async function acaoPatch(a, acao) {
    limparMensagens();
    if (acao === "cancelar" && !window.confirm("Cancelar esta atividade?")) return;
    const res = await api(`/api/atividades/${a.id_atividade}/${acao}`, { method: "PATCH" });
    if (res.status === 200) {
      if (res.body.aviso) $("aviso").textContent = res.body.aviso;
      await carregar();
    } else {
      $("erro-geral").textContent = res.body.error || "Não foi possível concluir a ação.";
      if (res.status === 409 && acao === "assumir") await carregar();
    }
  }

  async function abrirForm(a) {
    limparMensagens();
    editando = a || null;
    $("form-titulo").textContent = a ? "Editar atividade" : "Nova atividade";
    $("l-pessoa").hidden = !!a;
    $("f-titulo").value = a ? a.titulo : "";
    $("f-descricao").value = a && a.descricao ? a.descricao : "";
    $("f-data").value = a && a.data_hora ? a.data_hora : "";
    if (!a) {
      const lista = await api("/api/pessoas");
      pessoas = lista.status === 200 ? lista.body.pessoas : [];
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
    $("f-titulo").focus();
  }

  function fecharForm() {
    $("form").hidden = true;
    editando = null;
  }

  async function salvar(ev) {
    ev.preventDefault();
    limparMensagens();
    const dados = {
      titulo: $("f-titulo").value,
      descricao: $("f-descricao").value,
      data_hora: $("f-data").value || null
    };
    let res;
    if (editando) {
      res = await api(`/api/atividades/${editando.id_atividade}`, { method: "PUT", body: JSON.stringify(dados) });
    } else {
      dados.id_pessoa = Number($("f-pessoa").value);
      res = await api("/api/atividades", { method: "POST", body: JSON.stringify(dados) });
    }
    if (res.status === 200 || res.status === 201) {
      if (res.body.aviso) $("aviso").textContent = res.body.aviso;
      fecharForm();
      await carregar();
    } else {
      $("erro").textContent = res.body.error || "Não foi possível salvar.";
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

  $("btn-nova").addEventListener("click", () => abrirForm(null));
  $("btn-cancelar-form").addEventListener("click", fecharForm);
  $("form").addEventListener("submit", salvar);
  iniciar();
})();
