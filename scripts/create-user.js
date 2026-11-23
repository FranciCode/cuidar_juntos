require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const readline = require("readline/promises");
const { stdin: input, stdout: output } = require("process");

(async () => {
  const rl = readline.createInterface({ input, output });
  try {
    const nome = (await rl.question("Nome do usuário: ")).trim();
    const email = (await rl.question("E-mail do usuário: ")).trim().toLowerCase();
    const senha = await rl.question("Senha inicial (não será exibida): ");
    const perfilInput = (await rl.question("Perfil (ADMIN/COLABORADOR) [ADMIN]: ")).trim().toUpperCase();
    const perfil = perfilInput || "ADMIN";
    if (!nome || !email || senha.length < 12 || !["ADMIN", "COLABORADOR"].includes(perfil)) {
      throw new Error("Dados inválidos. A senha precisa ter pelo menos 12 caracteres.");
    }
    const db = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "cuidar_juntos"
    });
    const hash = await bcrypt.hash(senha, 12);
    await db.execute(
      "INSERT INTO USUARIO (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)",
      [nome, email, hash, perfil]
    );
    await db.end();
    console.log("Usuário criado com sucesso. Guarde a senha em local seguro.");
  } catch (error) {
    console.error("Não foi possível criar o usuário:", error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
})();
