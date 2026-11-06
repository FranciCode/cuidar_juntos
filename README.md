# Cuidar Juntos

Sistema web de organização e acompanhamento de cuidados familiares.

## Estado deste pacote

Este é o **ponto de partida da implementação**, não a versão final para avaliação. Inclui uma aplicação inicial com autenticação, painel, cadastro de atividades, assunção/liberação/conclusão de atividades e histórico básico. As telas e APIs de medicamentos, administrações, compromissos e gerenciamento de usuários ainda precisam ser implementadas antes de marcar essas funções como concluídas no documento AS.

## Requisitos

- Node.js 20 ou superior
- MySQL 8 ou compatível
- WebStorm (ou outro editor)
- Navegador moderno

## 1. Abrir no WebStorm

1. Extraia o ZIP para uma pasta local.
2. No WebStorm, escolha **Open** e selecione a pasta `cuidar_juntos`.
3. Abra o terminal integrado do WebStorm.

## 2. Criar o banco

1. Inicie o serviço MySQL.
2. Abra o MySQL Workbench ou outro cliente SQL.
3. Execute o arquivo `database/schema.sql`.
4. Confirme que o banco `cuidar_juntos` e as tabelas foram criados.

## 3. Configurar variáveis locais

1. Copie `.env.example` para um arquivo chamado `.env`.
2. Preencha `DB_USER` e `DB_PASSWORD` com as credenciais locais do MySQL.
3. Altere `SESSION_SECRET` para uma chave aleatória longa.
4. Nunca envie o arquivo `.env` para o GitHub nem inclua senhas reais no ZIP de avaliação.

## 4. Instalar dependências e iniciar

No terminal do WebStorm, na pasta raiz do projeto:

```bash
npm install
npm start
```

Acesse `http://localhost:3000`.

## 5. Criar o primeiro usuário

Depois de executar o schema e configurar o `.env`, execute:

```bash
node scripts/create-user.js
```

Informe nome, e-mail, uma senha inicial com pelo menos 12 caracteres e o perfil `ADMIN`. A senha é armazenada como hash bcrypt, não em texto puro.

Depois, cadastre ao menos uma pessoa assistida diretamente no banco, por exemplo:

```sql
INSERT INTO PESSOA_ASSISTIDA (nome, consentimento_registrado)
VALUES ('Pessoa de demonstração', TRUE);
```

Use somente dados fictícios nos testes e na demonstração acadêmica.

## 6. Verificação

- `http://localhost:3000/api/health` deve informar que a aplicação está ativa e que o banco está conectado.
- Entre com o usuário criado.
- Cadastre uma atividade.
- Assuma, libere e conclua uma atividade.
- Confira o histórico.

## Funcionalidades iniciais disponíveis

- Login e logout
- Consulta de atividades
- Cadastro de atividade para administrador
- Assunção, liberação e conclusão de atividades
- Registro básico de histórico
- Hash de senha e consultas SQL parametrizadas

## Pendências para completar a AS

- Interface e API de gerenciamento de usuários e permissões.
- Cadastro/edição da pessoa assistida pela interface.
- Telas e APIs de medicamentos e administrações.
- Telas e APIs de consultas e exames.
- Melhorias de autorização, validações e testes.
- Configuração de armazenamento de sessão persistente para produção.
- Deploy e teste do endereço público.
- Revisão final do documento PDF e do ZIP de avaliação.

## Orientações de segurança

- Não use dados reais de saúde ou de familiares durante o desenvolvimento.
- Não publique o `.env`, senhas ou dados pessoais.
- Para produção, configure HTTPS, segredo de sessão forte, armazenamento persistente de sessão, políticas de backup e controles de acesso adequados.
- Este sistema organiza registros familiares; não fornece diagnóstico, prescrição ou recomendações clínicas.
