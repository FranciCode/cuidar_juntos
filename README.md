# Cuidar Juntos

Sistema web de organização e acompanhamento de cuidados familiares.

O Cuidar Juntos centraliza, em um único lugar, as informações necessárias para que uma família organize os cuidados de uma pessoa assistida: atividades da rotina, responsáveis por cada tarefa, medicamentos e suas administrações, consultas e exames, agenda e histórico das ações realizadas.

O sistema organiza registros familiares. Ele não calcula nem sugere doses e não fornece diagnóstico, prescrição ou qualquer recomendação clínica: apenas registra as orientações informadas por um profissional de saúde.

## O que o sistema faz

- **Autenticação e sessão**: login e logout com senha armazenada em hash bcrypt, mensagem genérica de erro, bloqueio de contas inativas e bloqueio temporário de 15 minutos após 5 tentativas inválidas.
- **Primeiro acesso e convites**: enquanto não existe administrador, o primeiro cadastro pela tela inicial recebe o perfil `ADMIN`. Depois disso, novos cadastros exigem um código de convite gerado no servidor (somente o hash do código fica no banco).
- **Redefinição de senha**: o administrador gera um link de redefinição com validade; o usuário define a nova senha pela tela inicial.
- **Usuários e permissões**: cadastro, consulta, edição, desativação e reativação de usuários nos perfis `ADMIN`, `COLABORADOR` e `PESSOA_ASSISTIDA`, com a permissão individual de registrar administração de medicamentos. O sistema impede desativar ou rebaixar o último administrador ativo e impede que o administrador desative a si mesmo.
- **Pessoa assistida**: cadastro, edição e ativação/desativação, com registro de consentimento e vínculo entre usuários e pessoa assistida (todo acesso a dados é filtrado por esse vínculo).
- **Atividades**: cadastro, consulta, edição e cancelamento pelo administrador; qualquer usuário vinculado pode assumir, liberar e concluir uma atividade. A assunção é feita em transação, evitando que duas pessoas assumam a mesma atividade.
- **Medicamentos e administrações**: cadastro, edição, exclusão e consulta de medicamentos com orientação profissional, dose orientada (texto), frequência e horários; registro das administrações realizadas, com data, hora e responsável.
- **Consultas e exames**: cadastro, edição, exclusão e acompanhamento de compromissos, com alerta de conflito de horário para a mesma pessoa.
- **Agenda**: visão unificada de atividades e compromissos por período.
- **Painel inicial**: contadores e listas de atividades pendentes, medicamentos com horário vencido ou pendente e consultas/exames vencidos, destacando itens sem responsável definido.
- **Histórico**: registro das ações relevantes (criar, editar, desativar, assumir, liberar, concluir, administrar) com usuário, data e hora.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, JavaScript e Bootstrap |
| Backend | Node.js 20+ e Express 4 |
| Banco de dados | MySQL 8 |
| Segurança | bcryptjs, express-session, helmet, express-rate-limit, consultas parametrizadas |
| Testes | Jest 30 e Supertest |
| Ferramentas | WebStorm, Git e GitHub |

## Estrutura do projeto

```
database/        schema.sql e migrations incrementais
scripts/         utilitários de linha de comando (criar usuário e convite)
src/
  app.js         configuração do Express, sessão e rotas
  server.js      inicialização do servidor
  routes/        definição das rotas da API e controle de acesso
  controllers/   tratamento de requisição e resposta
  services/      regras de negócio e validações
  repositories/  acesso ao MySQL com consultas parametrizadas
  middlewares/   autenticação, perfil e vínculo com a pessoa assistida
  public/        páginas HTML, CSS e JavaScript do frontend
tests/
  unit/          testes das regras de negócio
  integration/   testes das rotas da API
docs/            plano de execução local e relatório de testes
```

A API segue o padrão REST em `/api`: `login`, `usuarios`, `pessoas`, `atividades`, `medicamentos`, `ocorrencias`, `compromissos`, `agenda`, `historico`, além de `health`, `me` e `logout`.

## Requisitos

- Node.js 20 ou superior
- MySQL 8 ou compatível, em execução
- Navegador moderno
- WebStorm ou outro editor

## Como rodar localmente

### 1. Obter o projeto

```bash
git clone https://github.com/FranciCode/cuidar_juntos.git
cd cuidar_juntos
```

No WebStorm, use **Open** e selecione a pasta do projeto.

### 2. Criar o banco de dados

Execute o script de criação (cria o banco `cuidar_juntos` e todas as tabelas):

```powershell
mysql -u root -p < database\schema.sql
```

Também é possível abrir o arquivo `database/schema.sql` no MySQL Workbench e executá-lo. Se você já tinha um banco criado em uma versão anterior, aplique os arquivos de `database/migrations` em ordem numérica; eles não são executados automaticamente.

Opcionalmente, crie um usuário dedicado em vez de usar o `root`:

```sql
CREATE USER 'cuidar'@'localhost' IDENTIFIED BY 'senha';
GRANT ALL ON cuidar_juntos.* TO 'cuidar'@'localhost';
```

### 3. Configurar as variáveis de ambiente

```powershell
Copy-Item .env.example .env
```

Preencha o arquivo `.env`:

```
PORT=3000
NODE_ENV=development
SESSION_SECRET=chave-longa-e-aleatoria
DB_HOST=localhost
DB_PORT=3306
DB_NAME=cuidar_juntos
DB_USER=root
DB_PASSWORD=sua-senha-local
```

O arquivo `.env` está no `.gitignore` e nunca deve ser versionado. Apenas o `.env.example`, sem credenciais reais, fica no repositório.

### 4. Instalar as dependências e iniciar

```bash
npm install
npm start      # inicia o servidor
npm run dev    # inicia com reinício automático (nodemon)
```

Acesse `http://localhost:3000`.

### 5. Criar o primeiro acesso

Há duas formas:

- Abrir `http://localhost:3000` e usar o cadastro da tela inicial: enquanto não existir administrador, o primeiro usuário cadastrado recebe o perfil `ADMIN`.
- Ou criar pelo terminal:

```bash
node scripts/create-user.js
```

Informe nome, e-mail, senha com pelo menos 12 caracteres e o perfil `ADMIN`. A senha é gravada como hash bcrypt.

Depois de entrar como administrador, cadastre a pessoa assistida pela tela **Pessoa assistida** e crie os demais usuários pela tela **Usuários**. Para liberar um novo cadastro público, gere um convite:

```bash
node scripts/create-invite.js
```

O código do convite é exibido uma única vez e deve ser repassado manualmente à pessoa; no banco fica somente o hash.

Use apenas dados fictícios em desenvolvimento e em demonstrações acadêmicas.

### 6. Verificar a instalação

- `http://localhost:3000/api/health` deve responder que a aplicação está ativa e o banco conectado.
- Entre com o usuário criado e confira o painel inicial.
- Cadastre uma pessoa assistida, uma atividade, um medicamento e uma consulta.
- Assuma, libere e conclua uma atividade; registre uma administração de medicamento.
- Confira a agenda e o histórico.

### 7. Executar os testes

```bash
npm test
```

Jest executa os testes unitários e de integração com relatório de cobertura (mínimo de 80% de linhas). O acesso ao MySQL é simulado nos testes, portanto não é necessário banco em execução.

## Como analisar o código

- Comece por `src/app.js`, que configura sessão, segurança e registra todas as rotas.
- Cada módulo segue a mesma divisão: `routes` define a URL e as permissões, `controllers` trata requisição e resposta, `services` concentra as regras de negócio e validações, e `repositories` executa as consultas SQL parametrizadas.
- As permissões ficam em `src/middlewares`: `auth.js` (sessão e perfil) e `vinculo.js` (acesso restrito às pessoas vinculadas ao usuário).
- O modelo de dados está em `database/schema.sql`, com as tabelas `USUARIO`, `USUARIO_PESSOA`, `PESSOA_ASSISTIDA`, `ATIVIDADE`, `RESPONSABILIDADE`, `MEDICAMENTO`, `ADMINISTRACAO`, `COMPROMISSO` e `HISTORICO`.
- Os testes em `tests/` servem como documentação executável das regras de negócio.

## Publicação

A aplicação é publicada em serviço de hospedagem Node.js com HTTPS e banco MySQL gerenciado. Em produção, a sessão usa armazenamento persistente no banco e o cookie é marcado como seguro. As mesmas variáveis do `.env` são configuradas no painel do serviço de hospedagem, acrescidas de `NODE_ENV=production` e `URL_DOMINIO` com o endereço público.

## Segurança e privacidade

- Senhas sempre em hash bcrypt; nunca em texto puro.
- Todas as consultas ao banco são parametrizadas.
- Acesso restrito por perfil e pelo vínculo entre usuário e pessoa assistida.
- Não use dados reais de saúde ou de familiares durante o desenvolvimento e os testes.
- Não publique o `.env`, senhas ou dados pessoais.
