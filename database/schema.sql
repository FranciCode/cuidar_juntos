CREATE DATABASE IF NOT EXISTS cuidar_juntos
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cuidar_juntos;

CREATE TABLE IF NOT EXISTS USUARIO (
  id_usuario INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  perfil ENUM('ADMIN','COLABORADOR') NOT NULL DEFAULT 'COLABORADOR',
  status ENUM('ATIVO','INATIVO') NOT NULL DEFAULT 'ATIVO',
  tentativas_falhas INT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_ate DATETIME NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS PESSOA_ASSISTIDA (
  id_pessoa INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  data_nascimento DATE NULL,
  consentimento_registrado BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('ATIVO','INATIVO') NOT NULL DEFAULT 'ATIVO',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS USUARIO_PESSOA (
  id_usuario INT UNSIGNED NOT NULL,
  id_pessoa INT UNSIGNED NOT NULL,
  pode_registrar_administracao BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id_usuario, id_pessoa),
  CONSTRAINT fk_up_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
  CONSTRAINT fk_up_pessoa FOREIGN KEY (id_pessoa) REFERENCES PESSOA_ASSISTIDA(id_pessoa)
);

CREATE TABLE IF NOT EXISTS ATIVIDADE (
  id_atividade INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_pessoa INT UNSIGNED NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  descricao VARCHAR(500) NULL,
  data_hora DATETIME NULL,
  status ENUM('PENDENTE','ASSUMIDA','CONCLUIDA','CANCELADA') NOT NULL DEFAULT 'PENDENTE',
  criado_por INT UNSIGNED NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_atividade_pessoa FOREIGN KEY (id_pessoa) REFERENCES PESSOA_ASSISTIDA(id_pessoa),
  CONSTRAINT fk_atividade_criador FOREIGN KEY (criado_por) REFERENCES USUARIO(id_usuario),
  INDEX idx_atividade_status_data (status, data_hora)
);

CREATE TABLE IF NOT EXISTS RESPONSABILIDADE (
  id_responsabilidade INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_atividade INT UNSIGNED NOT NULL,
  id_usuario INT UNSIGNED NOT NULL,
  assumida_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  liberada_em DATETIME NULL,
  concluida_em DATETIME NULL,
  observacao VARCHAR(500) NULL,
  CONSTRAINT fk_resp_atividade FOREIGN KEY (id_atividade) REFERENCES ATIVIDADE(id_atividade),
  CONSTRAINT fk_resp_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
  INDEX idx_resp_atividade_ativa (id_atividade, liberada_em)
);

CREATE TABLE IF NOT EXISTS MEDICAMENTO (
  id_medicamento INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_pessoa INT UNSIGNED NOT NULL,
  nome VARCHAR(150) NOT NULL,
  instrucao_cadastrada VARCHAR(500) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_medicamento_pessoa FOREIGN KEY (id_pessoa) REFERENCES PESSOA_ASSISTIDA(id_pessoa)
);

CREATE TABLE IF NOT EXISTS ADMINISTRACAO (
  id_administracao INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_medicamento INT UNSIGNED NOT NULL,
  id_usuario INT UNSIGNED NOT NULL,
  data_hora DATETIME NOT NULL,
  observacao VARCHAR(500) NULL,
  CONSTRAINT fk_adm_medicamento FOREIGN KEY (id_medicamento) REFERENCES MEDICAMENTO(id_medicamento),
  CONSTRAINT fk_adm_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
);

CREATE TABLE IF NOT EXISTS COMPROMISSO (
  id_compromisso INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_pessoa INT UNSIGNED NOT NULL,
  tipo ENUM('CONSULTA','EXAME') NOT NULL,
  descricao VARCHAR(250) NOT NULL,
  data_hora DATETIME NOT NULL,
  observacao VARCHAR(500) NULL,
  CONSTRAINT fk_compromisso_pessoa FOREIGN KEY (id_pessoa) REFERENCES PESSOA_ASSISTIDA(id_pessoa)
);

CREATE TABLE IF NOT EXISTS HISTORICO (
  id_historico BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT UNSIGNED NOT NULL,
  acao VARCHAR(80) NOT NULL,
  entidade VARCHAR(60) NOT NULL,
  id_registro BIGINT UNSIGNED NOT NULL,
  data_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  detalhes VARCHAR(500) NULL,
  CONSTRAINT fk_historico_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
  INDEX idx_historico_data (data_hora)
);

-- Dados de demonstração: execute depois de criar um hash bcrypt seguro.
-- Não inclua senhas em texto puro neste script.
-- Exemplo para gerar hash localmente:
-- node -e "require('bcryptjs').hash('SuaSenhaDeTeste!', 12).then(console.log)"
-- Em seguida, use o hash gerado para inserir um usuário de teste.
