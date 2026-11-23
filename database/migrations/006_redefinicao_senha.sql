USE cuidar_juntos;

-- Redefinição de senha autorizada pelo administrador. Execute uma vez.
CREATE TABLE IF NOT EXISTS REDEFINICAO_SENHA (
  id_redefinicao INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  id_usuario INT UNSIGNED NOT NULL,
  expira_em DATETIME NOT NULL,
  usado_em DATETIME NULL,
  criado_por INT UNSIGNED NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_redef_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
  CONSTRAINT fk_redef_criado_por FOREIGN KEY (criado_por) REFERENCES USUARIO(id_usuario)
);
