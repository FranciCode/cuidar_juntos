(function () {
  const $ = (id) => document.getElementById(id);
  let usuario = null;
  let compromissos = [];
  let editando = null;
  let pendente = null;
  let agoraServidor = null;
  let recebidoEm = 0;

  function agoraEstimado() {
    if (!agoraServidor) return null;
    const t = Date.parse(agoraServidor + ":00Z") + (Date.now() - recebidoEm);
    return new Date(t).toISOString().slice(0, 16);
  }

  function vencido(c) {
    const agora = agoraEstimado();
    if ((c.status || "PENDENTE") !== "PENDENTE") return false;
    return agora ? String(c.data_hora).slice(0, 10) <= agora.slice(0, 10) : !!c.vencido;
  }

  async function api(url, opcoes) {
    const res = await fetch((window.BASE_URL || "") + url, {
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
    return `${d}/${m}/${a}${hora ? " " + hora.slice(0, 5) : ""}`;
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
  }

  function render() {
    const admin = usuario && usuario.perfil === "ADMIN";
    $("btn-novo").hidden = !admin;
    $("vazio").hidden = compromissos.length > 0;
    $("tabela").hidden = compromissos.length === 0;
    const corpo = $("corpo");
    corpo.textContent = "";
    const alertas = [];
    compromissos.forEach((c) => {
      const tr = document.createElement("tr");
      celula(tr, c.tipo === "EXAME" ? "Exame" : "Consulta");
      celula(tr, formatarData(c.data_hora));
      celula(tr, c.descricao);
      celula(tr, c.pessoa || "-");
      const stat = c.status || "PENDENTE";
      if (stat === "PENDENTE" && !vencido(c)) {
        celula(tr, "Agendado");
      } else if (stat === "PENDENTE") {
        const sp = document.createElement("span");
        sp.className = "badge bg-danger";
        sp.textContent = "Pendente";
        alertas.push((c.tipo === "EXAME" ? "Exame" : "Consulta") + " - " + c.descricao + " (" + formatarData(c.data_hora) + ")");
        celula(tr, sp);
        tr.className = "table-warning fw-bold";
        tr.style.borderLeft = "4px solid #dc3545";
      } else {
        celula(tr, stat);
      }
      if (c.responsavel) celula(tr, c.responsavel);
      else {
        const nao = document.createElement("strong");
        nao.textContent = "Não definido";
        nao.style.color = "#dc3545";
        celula(tr, nao);
      }
      const acoes = document.createElement("div");
      const pend = (c.status || "PENDENTE") === "PENDENTE";
      const ehResp = usuario && c.id_responsavel === usuario.id;
      if (pend && !c.id_responsavel) acoes.appendChild(botao("Assumir", () => executarAcao(c, "assumir")));
      if (pend && c.id_responsavel && (ehResp || admin)) acoes.appendChild(botao("Liberar", () => executarAcao(c, "liberar")));
      if (pend && (ehResp || admin)) acoes.appendChild(botao("Concluir", () => executarAcao(c, "concluir")));
      if (pend && admin) acoes.appendChild(botao("Cancelar", () => executarAcao(c, "cancelar")));
      if (admin) {
        acoes.appendChild(botao("Editar", () => abrirForm(c)));
        acoes.appendChild(botao("Excluir", () => excluir(c)));
      }
      celula(tr, acoes);
      corpo.appendChild(tr);
    });
    let el = document.getElementById("alerta-pendentes");
    if (!el) {
      el = document.createElement("div");
      el.id = "alerta-pendentes";
      el.setAttribute("role", "alert");
      el.style.cssText = "background:#f8d7da;color:#b02a37;border:2px solid #dc3545;padding:10px 14px;margin:10px 0;font-weight:bold";
      $("tabela").parentNode.insertBefore(el, $("tabela"));
    }
    el.hidden = alertas.length === 0;
    el.textContent = alertas.length ? "ALERTA: pendente - " + alertas.join("; ") : "";
  }

  function limparMensagens() {
    $("erro-geral").textContent = "";
    $("erro").textContent = "";
  }

  function esconderConflito() {
    pendente = null;
    $("conflito").hidden = true;
    $("acoes-form").hidden = false;
  }

  async function carregar() {
    const res = await api("/api/compromissos");
    if (res.status === 200) {
      compromissos = res.body.compromissos;
      agoraServidor = res.body.agora || null;
      recebidoEm = Date.now();
      render();
    } else {
      $("erro-geral").textContent = res.body.error || "Não foi possível carregar os compromissos.";
    }
  }

  async function executarAcao(c, nome) {
    limparMensagens();
    const res = await api(`/api/compromissos/${c.id_compromisso}/acao/${nome}`, { method: "POST" });
    if (res.status === 200) await carregar();
    else $("erro-geral").textContent = res.body.error || "Não foi possível concluir a ação.";
  }

  async function excluir(c) {
    limparMensagens();
    if (!window.confirm("Excluir este compromisso?")) return;
    const res = await api(`/api/compromissos/${c.id_compromisso}`, { method: "DELETE" });
    if (res.status === 200) await carregar();
    else $("erro-geral").textContent = res.body.error || "Não foi possível excluir.";
  }

  async function abrirForm(c) {
    limparMensagens();
    esconderConflito();
    editando = c || null;
    $("form-titulo").textContent = c ? "Editar compromisso" : "Novo compromisso";
    $("l-pessoa").hidden = !!c;
    $("f-tipo").value = c ? c.tipo : "CONSULTA";
    $("f-data").value = c && c.data_hora ? c.data_hora.slice(0, 16) : "";
    $("f-descricao").value = c ? c.descricao : "";
    $("f-observacao").value = c && c.observacao ? c.observacao : "";
    if (!c) {
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
    $("f-descricao").focus();
  }

  function fecharForm() {
    esconderConflito();
    $("form").hidden = true;
    editando = null;
  }

  async function enviar(dados) {
    if (editando) {
      return api(`/api/compromissos/${editando.id_compromisso}`, { method: "PUT", body: JSON.stringify(dados) });
    }
    return api("/api/compromissos", { method: "POST", body: JSON.stringify(dados) });
  }

  async function processar(dados) {
    const res = await enviar(dados);
    if (res.status === 200 || res.status === 201) {
      fecharForm();
      await carregar();
    } else if (res.status === 409 && res.body.conflito) {
      pendente = dados;
      $("conflito-msg").textContent = res.body.error || "A pessoa já tem um compromisso neste horário.";
      $("conflito").hidden = false;
      $("acoes-form").hidden = true;
    } else {
      $("erro").textContent = res.body.error || "Não foi possível salvar.";
    }
  }

  async function salvar(ev) {
    ev.preventDefault();
    limparMensagens();
    esconderConflito();
    const dados = {
      tipo: $("f-tipo").value,
      data_hora: $("f-data").value || null,
      descricao: $("f-descricao").value,
      observacao: $("f-observacao").value
    };
    if (!editando) dados.id_pessoa = Number($("f-pessoa").value);
    await processar(dados);
  }

  async function confirmar() {
    if (!pendente) return;
    const dados = { ...pendente, confirmar: true };
    esconderConflito();
    await processar(dados);
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
  $("btn-confirmar").addEventListener("click", confirmar);
  $("btn-cancelar-conflito").addEventListener("click", esconderConflito);
  $("form").addEventListener("submit", salvar);
  setInterval(() => { if (agoraServidor) render(); }, 30000);
  iniciar();
})();
