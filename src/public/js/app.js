(function () {
  const $ = (id) => document.getElementById(id);

  function mostrarMenu(user) {
    $("login").hidden = true;
    $("menu").hidden = false;
    $("nome").textContent = user.nome;
    $("item-usuarios").hidden = user.perfil !== "ADMIN";
  }

  $("login").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    $("erro-login").textContent = "";
    const res = await fetch("/api/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: $("email").value, senha: $("senha").value })
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) mostrarMenu(body.user);
    else $("erro-login").textContent = body.error || "Não foi possível entrar.";
  });

  $("sair").addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    window.location.reload();
  });

  fetch("/api/me", { credentials: "same-origin" })
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => { if (body) mostrarMenu(body.user); });
})();
