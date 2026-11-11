USE cuidar_juntos;

-- Para bancos criados antes da T3. Execute uma vez; ignore "Duplicate column" se já aplicado.
ALTER TABLE PESSOA_ASSISTIDA ADD COLUMN data_consentimento DATETIME NULL;
-- Permite as ações USUARIO_* e PESSOA_* no histórico.
ALTER TABLE HISTORICO MODIFY COLUMN acao VARCHAR(40) NOT NULL;
