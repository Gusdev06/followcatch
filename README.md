# FollowCatch

Aplicação React/Vite com API Hono, Postgres e checkout Stripe.

- Repositório: https://github.com/Gusdev06/followcatch
- Produção: https://followcatch.vercel.app
- Admin: `/admin`, protegido por `ADMIN_KEY` no servidor.

## Desenvolvimento e validação

```sh
npm ci
npm run dev
npm test
npm run build
```

Credenciais ficam no `.env` local e nas variáveis da Vercel, nunca no Git. O banco usa somente o schema `followcatch`. Migrações idempotentes, protegidas por advisory lock, rodam no primeiro acesso ao banco.

`npm test` usa PostgreSQL em memória (PGlite), sem carregar `.env`, acessar produção ou chamar provedores externos. Use Node 22 ou superior (produção: Node 24).

## Consultas no admin — 04/11/2026

A aba **Consultas** mostra cada consulta de perfil, com ou sem login: visitante/conta, perfil consultado, horário e resultado. Inclui repetições, respostas de cache e tentativas que falham. Atualiza a cada 30 segundos; filtros e paginação ficam no servidor. **Cadastros** mantém contas, assinaturas e exportação CSV.

Visitantes novos recebem um identificador aleatório no cookie `fc_visitor` (HttpOnly, SameSite=Lax, Secure em HTTPS). Isso identifica um navegador, não uma pessoa. E-mail só aparece quando a consulta tem uma sessão autenticada. O novo log não armazena IP ou user agent.

`GET /api/profile` grava em `search_events` antes de buscar o perfil e atualiza o resultado depois. As chamadas de `following` e `followers` fazem parte da consulta e não geram eventos adicionais. Falha no registro gera log, mas não derruba a busca. Requisições interrompidas podem permanecer com resultado “Iniciada”.

A migração recupera uma única vez o histórico disponível em `searches` e `user_searches`. Esses registros aparecem como antigos: são parciais, podem agrupar por IP, nem sempre identificam login/resultado e não permitem reconstruir todas as repetições ou cache hits antigos. A nova API não expõe IPs crus.

`GET /api/admin/searches?page=1&kind=all&q=` exige `x-admin-key`; aceita `kind=anonymous|registered|all` e retorna 50 registros por página. Consultas e admin usam `Cache-Control: private, no-store`.
