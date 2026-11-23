function urlBase() {
  let base = String(process.env.URL_SITE || "http://localhost:3000").trim();
  if (!/^https?:\/\//i.test(base)) base = `${/^(localhost|127\.0\.0\.1)(:|\/|$)/i.test(base) ? "http" : "https"}://${base}`;
  return base.replace(/\/+$/, "");
}

function montarLink(parametro, token) {
  return `${urlBase()}/?${parametro}=${encodeURIComponent(token)}`;
}

module.exports = { urlBase, montarLink };
