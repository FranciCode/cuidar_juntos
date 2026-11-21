USE cuidar_juntos;

-- Correção segura para o banco atual. Revise e execute uma vez, manualmente (DBeaver).
-- Substitui a 002, que reduziria HISTORICO.acao para VARCHAR(40). Não use a 002 neste banco.
ALTER TABLE PESSOA_ASSISTIDA ADD COLUMN data_consentimento DATETIME NULL;

-- Depois execute 003_convite.sql e 004_convite_nome.sql (tabela CONVITE), nesta ordem.
