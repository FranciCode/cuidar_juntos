(function () {
  const $ = (id) => document.getElementById(id);
  let usuario = null;
  let atividades = [];
  let pessoas = [];
  let editando = null;
  let ocorrencias = {};

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
    const linhas = [];
    const alertas = [];
    atividades.forEach((a) => {
      const datas = datasDiarias(a);
      if (datas.length) datas.forEach((d) => linhas.push({ a, texto: d.texto, oc: d }));
      else linhas.push({ a, texto: formatarData(a.data_hora) });
    });
    linhas.forEach(({ a, texto, oc }) => {
      const tr = document.createElement("tr");
      celula(tr, a.pessoa || "-");
      celula(tr, a.titulo + (a.dias_semana ? " - diária" : ""));
      celula(tr, texto);
      const resp = oc ? ocorrencias[a.id_atividade + "|" + oc.chave] : null;
      const emAberto = a.status === "PENDENTE" || a.status === "ASSUMIDA";
      const quando = oc ? oc.dt : parseDataHora(a.data_hora);
      const atrasada = quando && quando.getTime() < Date.now();
      const assumida = oc ? !!resp : a.status === "ASSUMIDA";
      if (!emAberto) {
        celula(tr, a.status);
      } else if (assumida) {
        celula(tr, "Assumida");
      } else {
        const sp = document.createElement("span");
        sp.textContent = "Pendente";
        if (atrasada) {
          sp.className = "badge bg-danger";
          tr.className = "table-warning fw-bold";
          tr.style.borderLeft = "4px solid #dc3545";
          alertas.push(a.titulo + " - " + texto);
        }
        celula(tr, sp);
      }
      const nomeResp = oc ? (resp && resp.responsavel) : a.responsavel;
      if (nomeResp) {
        celula(tr, nomeResp);
      } else {
        const nd = celula(tr, "N\u00e3o definido");
        nd.style.color = "#dc3545";
        nd.style.fontWeight = "bold";
      }
      const acoes = document.createElement("div");
      const aberta = a.status === "PENDENTE" || a.status === "ASSUMIDA";
      if (oc) {
        if (aberta && !resp) acoes.appendChild(botao("Assumir", () => assumirOcorrencia(a, oc)));
      } else if (a.status === "PENDENTE") acoes.appendChild(botao("Assumir", () => acaoPatch(a, "assumir")));
      if (!oc && a.status === "ASSUMIDA" && (admin || a.id_responsavel === usuario.id)) {
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
    mostrarAlertas(alertas);
  }

  function mostrarAlertas(lista) {
    let el = document.getElementById("alerta-pendentes");
    if (!el) {
      el = document.createElement("div");
      el.id = "alerta-pendentes";
      el.setAttribute("role", "alert");
      el.style.cssText = "background:#f8d7da;color:#b02a37;border:2px solid #dc3545;padding:10px 14px;margin:10px 0;font-weight:bold";
      $("tabela").parentNode.insertBefore(el, $("tabela"));
    }
    el.hidden = lista.length === 0;
    el.textContent = lista.length ? "ALERTA: atividade pendente - " + lista.join("; ") : "";
  }

  function parseDataHora(v) {
    if (!v) return null;
    const d = new Date(String(v).replace(" ", "T"));
    return isNaN(d) ? null : d;
  }

  async function assumirOcorrencia(a, oc) {
    limparMensagens();
    const res = await api("/api/ocorrencias/assumir", { method: "POST", body: JSON.stringify({ tipo: "ATIVIDADE", id: a.id_atividade, chave: oc.chave }) });
    if (res.status !== 200) $("erro-geral").textContent = res.body.error || "Falha ao assumir.";
    await carregar();
  }

  const NOMES_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  function datasDiarias(a) {
    if (!a.dias_semana) return [];
    const hora = a.data_hora && String(a.data_hora).includes("T") ? String(a.data_hora).split("T")[1].slice(0, 5) : "";
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return String(a.dias_semana).split(",").map(Number).map((d) => {
      const dt = new Date(hoje);
      dt.setDate(dt.getDate() + ((d - hoje.getDay() + 7) % 7));
      return dt;
    }).sort((x, y) => x - y).map((dt) => {
      const chave = dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
      const quando = new Date(dt);
      if (hora) quando.setHours(Number(hora.slice(0, 2)), Number(hora.slice(3, 5)), 0, 0);
      return {
        chave,
        dt: quando,
        texto: String(dt.getDate()).padStart(2, "0") + "/" + String(dt.getMonth() + 1).padStart(2, "0") + "/" + dt.getFullYear() + (hora ? " " + hora : "")
      };
    });
  }

  function descreverDias(a) {
    if (!a.dias_semana) return "";
    const hora = a.data_hora && String(a.data_hora).includes("T") ? String(a.data_hora).split("T")[1].slice(0, 5) : "";
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const itens = String(a.dias_semana).split(",").map(Number).sort((x, y) => x - y).map((d) => {
      const dt = new Date(hoje);
      dt.setDate(dt.getDate() + ((d - hoje.getDay() + 7) % 7));
      const dd = String(dt.getDate()).padStart(2, "0") + "/" + String(dt.getMonth() + 1).padStart(2, "0") + "/" + dt.getFullYear();
      return { dt, txt: NOMES_DIAS[d] + " " + dd + (hora ? " - " + hora : "") };
    }).sort((x, y) => x.dt - y.dt);
    return " (" + itens.map((i) => i.txt).join("; ") + ")";
  }

  function marcarDias(valor) {
    const marcados = valor ? String(valor).split(",") : [];
    $("f-diaria").checked = marcados.length > 0;
    $("f-dias").hidden = marcados.length === 0;
    document.querySelectorAll('#f-dias input[name="dia"]').forEach((i) => { i.checked = marcados.includes(i.value); });
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
      const oc = await api("/api/ocorrencias?tipo=ATIVIDADE");
      ocorrencias = {};
      if (oc.status === 200) (oc.body.ocorrencias || []).forEach((o) => { ocorrencias[o.id_ref + "|" + o.chave] = o; });
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
    marcarDias(a ? a.dias_semana : null);
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
      data_hora: $("f-data").value || null,
      dias_semana: null
    };
    if ($("f-diaria").checked) {
      dados.dias_semana = Array.from(document.querySelectorAll('#f-dias input[name="dia"]:checked')).map((i) => Number(i.value));
      if (dados.dias_semana.length === 0) {
        $("erro").textContent = "Selecione ao menos um dia da semana.";
        return;
      }
    }
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
  $("f-diaria").addEventListener("change", () => {
    $("f-dias").hidden = !$("f-diaria").checked;
    if ($("f-diaria").checked && !document.querySelector('#f-dias input[name="dia"]:checked')) {
      document.querySelectorAll('#f-dias input[name="dia"]').forEach((i) => { i.checked = true; });
    }
  });
  iniciar();
})();
