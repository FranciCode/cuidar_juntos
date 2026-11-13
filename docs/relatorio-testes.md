# Relatório de testes, acessibilidade e segurança (T8)

## Endurecimento aplicado

| Item | Situação |
| --- | --- |
| Cabeçalhos `helmet` (padrões, incluindo CSP e `X-Content-Type-Options: nosniff`) | aplicado em `src/app.js` |
| Limite de login: 5 tentativas por 15 minutos por IP, `429` com `{error}` | `src/middlewares/loginLimiter.js`, aplicado em `POST /api/login` |
| Cookie de sessão: `HttpOnly`, `SameSite=Lax`, `Secure` só em produção | já configurado em `src/app.js` |
| `npm test` com `jest --coverage` e limite de 80% de linhas em services, middlewares e controllers | configurado no `package.json` |

Obs.: a rota real de login é `POST /api/login` (o plano cita `/api/auth/login`).

## Casos de teste e resultado de `npm test`

Os testes automatizados de permissões, injeção de SQL e hash (S1 a S5) **não foram implementados**, por decisão do usuário.
Enquanto não existirem, `npm test` sai com código diferente de 0, porque a cobertura fica abaixo de 80%.
Isso é esperado e protege o limite definido.

## Cobertura

Não medida: não há testes em `tests/unit` nem em `tests/integration`.

## Acessibilidade por página

| Página | Lighthouse (Acessibilidade) | Erros WAVE |
| --- | --- | --- |
| index.html | medição manual pendente | medição manual pendente |
| usuarios.html | medição manual pendente | medição manual pendente |
| pessoa.html | medição manual pendente | medição manual pendente |
| atividades.html | medição manual pendente | medição manual pendente |
| compromissos.html | medição manual pendente | medição manual pendente |
| medicamentos.html | medição manual pendente | medição manual pendente |

Revisão estática: todos os campos de formulário têm `label` (associado por `for` ou envolvendo o campo) e todas as páginas declaram `lang="pt-BR"`.
Contraste, foco visível e operação por teclado ainda precisam de medição no navegador.

## Falhas encontradas e correções

| Falha | Correção |
| --- | --- |
| Login sem limite de tentativas | `loginLimiter` (5 por 15 min por IP) |
| `helmet` com a CSP desligada | `helmet()` com os padrões |
