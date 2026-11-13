const historicoRepository = require("../repositories/historicoRepository");

const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;

function inteiroPositivo(valor) {
  return typeof valor === "string" && /^\d+$/.test(valor) && Number(valor) > 0 ? Number(valor) : null;
}

function erro(mensagem) {
  return { status: 400, body: { error: mensagem } };
}

async function listar(db, usuario, query = {}) {
  let pagina = 1;
  let limite = LIMITE_PADRAO;
  if (query.pagina !== undefined) {
    pagina = inteiroPositivo(query.pagina);
    if (!pagina) return erro("Página inválida.");
  }
  if (query.limite !== undefined) {
    limite = inteiroPositivo(query.limite);
    if (!limite) return erro("Limite inválido.");
    if (limite > LIMITE_MAXIMO) return erro(`O limite máximo é ${LIMITE_MAXIMO}.`);
  }

  const { registros, total } = await historicoRepository.listarVisiveis(db, {
    idUsuario: usuario.id,
    admin: usuario.perfil === "ADMIN",
    limite,
    deslocamento: (pagina - 1) * limite
  });

  return { status: 200, body: { registros, pagina, limite, total } };
}

module.exports = { listar };
