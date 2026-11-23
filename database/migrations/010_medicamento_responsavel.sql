ALTER TABLE MEDICAMENTO
  ADD COLUMN id_responsavel INT UNSIGNED NULL,
  ADD CONSTRAINT fk_medicamento_responsavel FOREIGN KEY (id_responsavel) REFERENCES USUARIO(id_usuario);
