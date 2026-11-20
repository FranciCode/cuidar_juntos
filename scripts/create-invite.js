require("dotenv").config();
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const readline = require("readline/promises");
const { stdin: input, stdout: output } = require("process");

const PERFIS = ["ADMIN", "COLABORADOR", "PESSOA_ASSISTIDA"];
const PADRAO_HORAS = 72;
const MAX_HORAS = 7 * 24;

(async () => {
  const rl = readline.createInterface({ input, output });
  let db;
  try {
    const email = (await rl.question("E-mail do convidado: ")).trim().toLowerCase();
    const perfil = ((await rl.question("Perfil (ADMIN/COLABORADOR/PESSOA_ASSISTIDA) [COLABORADOR]: ")).trim().toUpperCase()) || "COLABORADOR";
    const horas = Number((await rl.question(`Validade em horas [${PADRAO_HORAS}, máximo ${MAX_HORAS}]: `)).trim() || PADRAO_HORAS);
    const pessoaBruta = (await rl.question("ID da pessoa assistida (opcional): ")).trim();
    const idPessoa = pessoaBruta ? Number(pessoaBruta) : null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !PERFIS.includes(perfil)
      || !Number.isFinite(horas) || horas <= 0 || horas > MAX_HORAS
      || (idPessoa !== null && (!Number.isInteger(idPessoa) || idPessoa <= 0))) {
      throw new Error("Dados inválidos.");
    }

    db = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "cuidar_juntos"
    });

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiraEm = new Date(Date.now() + horas * 3600000);
    await db.execute(
      "INSERT INTO CONVITE (token_hash, email, perfil, id_pessoa, expira_em, criado_por) VALUES (?, ?, ?, ?, ?, NULL)",
      [tokenHash, email, perfil, idPessoa, expiraEm]
    );
    console.log("Convite criado. O código abaixo é exibido uma única vez; compartilhe-o manualmente:");
    console.log(token);
    console.log(`Válido até ${expiraEm.toLocaleString("pt-BR")}.`);
  } catch (error) {
    console.error("Não foi possível criar o convite:", error.message);
    process.exitCode = 1;
  } finally {
    if (db) await db.end();
    rl.close();
  }
})();
