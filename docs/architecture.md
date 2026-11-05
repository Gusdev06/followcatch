# Arquitetura

Visão técnica do FollowCatch. O código é a fonte de verdade; aqui ficam o desenho geral e o que não é óbvio lendo arquivo por arquivo.

## Stack

| Camada | Tecnologia |
|---|---|
| Front | React 18, Vite, Tailwind, React Router. SPA em `src/`. |
| API | Hono (`server/app.ts`). Local: `server/index.ts` na porta 8787. Produção: `api/index.ts` como função única da Vercel. |
| Banco | Postgres (Supabase compartilhado), schema `followcatch`, driver `pg`. Testes com PGlite em memória. |
| Dados | Apify (Instagram), Anthropic (gênero). Ver [providers.md](providers.md). |
| Pagamento | Stripe (ativo), PaymentKit (desligado). |
| Deploy | Vercel. `vercel.json` reescreve `/api/*` para a função e o resto para `index.html`. |

## Fluxo de uma consulta

```
Navegador (useSearch)
  1. GET /api/profile?u=@
       ├─ registra a consulta em search_events (visitante ou conta)
       ├─ cache kv "profile:@"? ──sim──► responde
       ├─ deduplicação em voo (mesmo @ já sendo buscado nesta instância)
       ├─ gate(): disjuntor global; assinante: cota diária e semanal do plano;
       │          visitante: balde de gasto dos visitantes e cota por IP (5/dia)
       ├─ Apify profile-scraper ──► logRun() em runs
       └─ grava cache (24 h; privado ou inexistente: 1 h)
  2. Se o perfil é público, SÓ a lista da aba aberta (a outra, no clique da pessoa; `ensure` em useSearch):
       GET /api/following?u=@  ou  GET /api/followers?u=@
       ├─ cache kv "following:@" ou "followers:@" (6 h)
       ├─ perfil privado ou inexistente: 403/404 sem gastar run
       ├─ gate() + Apify scraping_solutions (25 itens) + logRun()
       │    lista vazia de perfil que tem gente = falha do provedor: erro, sem cache, cota devolvida
       ├─ classify(): gênero do cache ou Haiku (espera no máximo 4 s)
       └─ assinante recebe tudo; os demais recebem teaser() (1 item por gênero, resto sem dados)
     GET /api/gender?u=@  (gênero do próprio perfil, sem Apify)
```

A cota conta **@ distintos por dia**: perfil e as duas listas do mesmo @ contam como uma consulta.

## Identidade e acesso

- **Sessão:** cookie `fc_session` (30 dias) com token aleatório; o banco guarda só o HMAC do token (`SESSION_SECRET`). Senha em scrypt.
- **Assinante:** `hasAccess()` exige `status = active` e período não vencido, com 2 dias de folga para webhook atrasado.
- **Visitante:** cookie `fc_visitor` (UUID aleatório, HttpOnly). Identifica um navegador, não uma pessoa. A cota grátis usa o IP (`x-forwarded-for`).
- **Admin:** header `x-admin-key` igual a `ADMIN_KEY`. Só leitura.

## Rotas da API

Lista completa em [server/app.ts](../server/app.ts). Grupos:

- **Busca:** `/api/profile`, `/api/following`, `/api/followers`, `/api/gender`, `/api/stories` (ainda devolve `unavailable`), `/api/img` (proxy de imagem do CDN do Instagram).
- **Conta:** `/api/auth/*` (signup, login, logout, forgot, reset), `/api/me`, `/api/me/searches`.
- **Pagamento:** `/api/checkout`, `/api/checkout/embedded`, `/api/welcome`, `/api/billing-portal`, `/api/webhooks/stripe`, `/api/webhooks/paymentkit`.
- **Admin:** `/api/admin/users`, `/api/admin/searches`, `/api/admin/costs`.
- **Operação:** `/api/health` (estado do banco, gasto do dia, cota do IP).

## Banco de dados (schema `followcatch`)

DDL completo e idempotente em [server/db.ts](../server/db.ts).

| Tabela | Para quê |
|---|---|
| `kv` | Cache genérico JSON com `expires_at` (perfis e listas). |
| `gender` | Gênero por username, permanente. |
| `runs` | Cada run de provedor: actor, @, itens, custo estimado, tempo, sucesso, `who` (`ip:` ou `user:`) e `bucket` (`visitor` ou `subscriber`). Base do disjuntor e do balde dos visitantes. Runs anteriores a 2026-11-04 têm `who` e `bucket` nulos. |
| `searches` | Cota diária: um registro por (quem, dia, @). `who` = `ip:<ip>` ou `user:<id>`. |
| `users`, `sessions`, `password_resets` | Contas e autenticação. |
| `subscriptions`, `checkouts`, `webhook_events` | Assinaturas, tentativas de checkout e eventos de webhook (idempotência e auditoria). |
| `user_searches` | Últimos @ consultados por conta (lista "recentes" do dashboard). |
| `search_events` | Log de cada consulta para o admin. Ver [features/search-activity.md](features/search-activity.md). Coluna `cache` (`hit` ou `miss`) mede se a consulta de perfil pagou coleta. |
| `migrations` | Migrações de dados que rodam uma vez. |

## Front

- Rotas em [src/App.tsx](../src/App.tsx): `/` (landing), `/search` (prévia), `/plans`, `/signup`, `/checkout`, `/welcome`, `/app` (dashboard do assinante), `/login`, `/forgot-password`, `/reset-password`, `/story-viewer`, `/admin`, páginas legais.
- O funil de busca fica em [src/components/funnel/](../src/components/funnel/). `useSearch` carrega o perfil primeiro e depois as listas e o gênero.
- Marca, planos e preços ficam em [src/config/site.ts](../src/config/site.ts). Os preços do Stripe ficam em `server/stripe.ts` e **precisam bater** com `site.ts`.
- `?mock=1` usa dados gravados de @nasa sem chamar a API. Também simula gênero, erros e estado da sessão (ver comentário em `mock.ts`).

## Variáveis de ambiente

Os valores ficam no `.env` local e na Vercel. Nunca no Git.

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Postgres (pooler de transação na Vercel). |
| `APIFY_TOKEN` | Apify. |
| `ANTHROPIC_API_KEY` | Classificação de gênero. |
| `MAX_DAILY_USD` | Disjuntor global: gasto estimado por dia, de todos juntos (padrão 10; era 3). Ver [cost-strategy.md](cost-strategy.md). |
| `VISITOR_DAILY_USD` | Balde de gasto dos visitantes por dia (padrão 2, provisório). Sempre limitado a `MAX_DAILY_USD`. |
| `FREE_SEARCHES_PER_IP` | Cota grátis diária por IP (padrão 5). |
| `SUBSCRIBER_SEARCHES_PER_DAY` | Cota diária de @ novos do assinante (padrão 10; era 50). |
| `SUBSCRIBER_WEEKLY_STARTER`, `SUBSCRIBER_WEEKLY_PREMIUM` | Cota semanal de @ novos por plano, de segunda 00:00 UTC (padrão 27 e 40). |
| `SESSION_SECRET` | HMAC dos tokens de sessão. |
| `APP_URL` | URL pública (links de e-mail e retorno do checkout). |
| `ADMIN_KEY` | Acesso ao `/admin`. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PORTAL_CONFIG`, `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe. |
| `PAYMENT_PROVIDER`, `VITE_PAYMENT_PROVIDER` | `stripe` (padrão) ou `paymentkit`. |
| `PAYMENTKIT_*`, `VITE_PAYMENTKIT_PUBLISHABLE_KEY` | PaymentKit (desligado). |
| `RESEND_API_KEY`, `EMAIL_FROM` | E-mail de reset de senha. |
| `PORT` | Porta da API local (padrão 8787). |

## Testes

- `npm test` roda `tests/*.test.mjs` com Node test runner e PGlite. Não lê `.env`, não acessa produção nem provedores.
- Cobertura atual: registro de consultas (`search-activity.test.mjs`), normalização do actor das listas (`apify-normalize.test.mjs`), cotas e orçamentos (`budgets.test.mjs`) e cache hit, cota devolvida, lista vazia e o endpoint de custos (`costs.test.mjs`). A Apify é sempre simulada por um `fetch` falso. Sem teste: `teaser()` e a interface (conferida à mão no modo `?mock=1`).

## Referências quebradas

Comentários no código citam arquivos que não estão no repositório: `CONTRATO.md` e `CONTRATO-F2.md` (em `server/app.ts`), `paymentkit-2026-10-15.md` (em `server/billing.ts`) e `../sonda/*.json` (em `server/providers/apify.ts`). Eram documentos da fase inicial. O contrato atual entre front e API é `src/lib/types.ts`.
