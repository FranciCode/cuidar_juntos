function urlBase() {
  const producao = process.env.VERCEL || process.env.NODE_ENV === "production";
  const padrao = producao ? "https://cuidar-juntos-online.vercel.app" : "http://localhost:3000";
  let base = String(process.env.URL_DOMINIO || padrao).trim();
  if (!/^https?:\/\//i.test(base)) base = `${/^(localhost|127\.0\.0\.1)(:|\/|$)/i.test(base) ? "http" : "https"}://${base}`;
  return base.replace(/\/+$/, "");
}

function montarLink(parametro, token) {
  return `${urlBase()}/?${parametro}=${encodeURIComponent(token)}`;
}

module.exports = { urlBase, montarLink };
