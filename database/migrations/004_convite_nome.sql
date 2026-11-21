USE cuidar_juntos;

-- Nome do convidado no convite. Revise e execute uma vez, manualmente.
ALTER TABLE CONVITE ADD COLUMN nome VARCHAR(120) NULL AFTER token_hash;
