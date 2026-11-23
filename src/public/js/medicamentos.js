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

  function listarHorarios(texto) {
    const achados = String(texto || "").match(/\b([01]?\d|2[0-3])(?:[:h][0-5]\d|h)\b/g) || [];
    const horas = achados.map((h) => {
      const [hh, mm] = h.split(/[:h]/);
      return hh.padStart(2, "0") + ":" + (mm || "00");
    });
    return [...new Set(horas)].sort();
  }

  function proximoHorario(texto) {
    const horas = listarHorarios(texto);
    if (horas.length === 0) return "";
    const d = new Date();
    const agora = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    const prox = horas.find((h) => h >= agora);
    return prox ? "Hoje " + prox : "Amanhã " + horas[0];
  }

  function adicionarCampoHorario(valor) {
    const linha = document.createElement("div");
    const input = document.createElement("input");
    input.type = "time";
    input.name = "horario";
    input.value = valor || "";
    linha.appendChild(input);
    linha.appendChild(botao("Remover", () => linha.remove()));
    $("f-horarios-lista").appendChild(linha);
  }

  function lerHorarios() {
    const vals = Array.from(document.querySelectorAll('#f-horarios-lista input[name="horario"]')).map((i) => i.value).filter(Boolean);
    return [...new Set(vals)].sort().join(", ");
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
    let alerta = document.getElementById("alerta-atraso");
    if (!alerta) {
      alerta = document.createElement("div");
      alerta.id = "alerta-atraso";
      alerta.setAttribute("role", "alert");
      alerta.style.cssText = "background:#f8d7da;color:#b02a37;border:2px solid #dc3545;padding:10px 14px;margin:10px 0;font-weight:bold";
      $("tabela").parentNode.insertBefore(alerta, $("tabela"));
    }
    const atras = medicamentos.filter((x) => (x._atrasados || []).length);
    alerta.hidden = atras.length === 0;
    alerta.textContent = "ALERTA: administração em atraso - " + atras.map((x) => x.nome + (x.pessoa ? " (" + x.pessoa + ")" : "") + " " + x._atrasados.join(", ")).join("; ");
    medicamentos.forEach((m) => {
      const tr = document.createElement("tr");
      celula(tr, m.pessoa || "-");
      celula(tr, m.nome);
      const tdInstr = celula(tr, m.instrucao_cadastrada || "");
      tdInstr.style.minWidth = "220px";
      tdInstr.style.maxWidth = "320px";
      tdInstr.style.whiteSpace = "normal";
      tdInstr.style.lineHeight = "1.4";
      tdInstr.style.padding = "10px 14px";
      celula(tr, m.dose || "");
      celula(tr, m.frequencia || "");
      const prox = proximoHorario(m.horarios);
      const boxH = document.createElement("div");
      const hs = listarHorarios(m.horarios);
      (hs.length ? hs : (m.horarios ? [m.horarios] : [])).forEach((h) => {
        const l = document.createElement("div");
        l.textContent = h;
        if ((m._atrasados || []).includes(h)) {
          l.style.color = "#dc3545";
          l.style.fontWeight = "bold";
          l.textContent = h + " (atrasado)";
        }
        boxH.appendChild(l);
      });
      if (prox) {
        const p = document.createElement("div");
        p.style.marginTop = "6px";
        p.style.fontWeight = "bold";
        p.style.color = "#dc3545";
        p.textContent = "Próximo: " + prox;
        boxH.appendChild(p);
      }
      const tdHor = celula(tr, boxH);
      tdHor.style.minWidth = "140px";
      tdHor.style.padding = "10px 14px";
      tdHor.style.lineHeight = "1.5";
      celula(tr, m.responsaveis || "Não definido").style.padding = "10px 14px";
      const acoes = document.createElement("div");
      acoes.style.display = "flex";
      acoes.style.flexWrap = "nowrap";
      acoes.style.gap = "6px";
      if (!m.id_responsavel && m.pode_registrar_administracao) acoes.appendChild(botao("Assumir", () => assumir(m)));
      acoes.appendChild(botao("Histórico", () => abrirPainel(m)));
      if (m.pode_registrar_administracao) acoes.appendChild(botao("Registrar administração", () => abrirPainel(m, true)));
      if (ehAdmin()) {
        acoes.appendChild(botao("Editar", () => abrirForm(m)));
        acoes.appendChild(botao("Excluir", () => excluir(m)));
      }
      celula(tr, acoes).style.whiteSpace = "nowrap";
      corpo.appendChild(tr);
    });
  }

  function limparMensagens() {
    $("erro-geral").textContent = "";
    $("erro").textContent = "";
    $("erro-adm").textContent = "";
  }

  async function calcularAtrasos() {
    const ag = new Date();
    const hoje = ag.toDateString();
    const min = ag.getHours() * 60 + ag.getMinutes();
    await Promise.all(medicamentos.map(async (m) => {
      m._atrasados = [];
      const r = await api(`/api/medicamentos/${m.id_medicamento}/administracoes`);
      if (r.status !== 200) return;
      const feitas = (r.body.administracoes || []).map((x) => new Date(x.data_hora)).filter((d) => d.toDateString() === hoje).map((d) => d.getHours() * 60 + d.getMinutes());
      const restantes = listarHorarios(m.horarios).map((h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3)));
      feitas.forEach((f) => {
        let melhor = 0;
        restantes.forEach((h, i) => { if (Math.abs(h - f) < Math.abs(restantes[melhor] - f)) melhor = i; });
        restantes.splice(melhor, 1);
      });
      m._atrasados = restantes.filter((h) => h <= min).map((h) => String(Math.floor(h / 60)).padStart(2, "0") + ":" + String(h % 60).padStart(2, "0"));
    }));
  }

  async function carregar() {
    const res = await api("/api/medicamentos");
    if (res.status === 200) {
      medicamentos = res.body.medicamentos;
      await calcularAtrasos();
      render();
    } else {
      $("erro-geral").textContent = res.body.error || "Não foi possível carregar os medicamentos.";
    }
  }

  async function assumir(m) {
    limparMensagens();
    const res = await api(`/api/medicamentos/${m.id_medicamento}/assumir`, { method: "POST" });
    if (res.status !== 200) $("erro-geral").textContent = res.body.error || "Não foi possível assumir.";
    await carregar();
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
    $("f-dose").value = (m && m.dose) || "";
    $("f-frequencia").value = (m && m.frequencia) || "";
    $("f-horarios-lista").textContent = "";
    listarHorarios(m && m.horarios).forEach(adicionarCampoHorario);
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
    const dados = { nome: $("f-nome").value, instrucao_cadastrada: $("f-instrucao").value, dose: $("f-dose").value, frequencia: $("f-frequencia").value, horarios: lerHorarios() };
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
  $("btn-add-horario").addEventListener("click", () => adicionarCampoHorario(""));
  $("btn-cancelar-form").addEventListener("click", fecharForm);
  $("btn-fechar-painel").addEventListener("click", fecharPainel);
  $("form").addEventListener("submit", salvar);
  $("form-adm").addEventListener("submit", registrarAdministracao);
  iniciar();
})();
