USE cuidar_juntos;

-- Para bancos criados antes do cadastro por convite. Execute uma vez.
CREATE TABLE IF NOT EXISTS CONVITE (
  id_convite INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  email VARCHAR(190) NOT NULL,
  perfil ENUM('ADMIN','PESSOA_ASSISTIDA','COLABORADOR') NOT NULL DEFAULT 'COLABORADOR',
  id_pessoa INT UNSIGNED NULL,
  expira_em DATETIME NOT NULL,
  usado_em DATETIME NULL,
  usado_por INT UNSIGNED NULL,
  criado_por INT UNSIGNED NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_convite_pessoa FOREIGN KEY (id_pessoa) REFERENCES PESSOA_ASSISTIDA(id_pessoa),
  CONSTRAINT fk_convite_usado_por FOREIGN KEY (usado_por) REFERENCES USUARIO(id_usuario),
  CONSTRAINT fk_convite_criado_por FOREIGN KEY (criado_por) REFERENCES USUARIO(id_usuario)
);
