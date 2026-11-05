# AGENTS.md — FollowCatch

Este é o ponto de entrada para qualquer IA (Claude, Codex, Cursor, Copilot…) que trabalhe neste repositório. Leia este arquivo inteiro antes de mudar código. Os detalhes estão em `docs/`; leia só o que a tarefa pedir.

## O que é

FollowCatch é um **SaaS por assinatura, feito para dar lucro**. O usuário digita um @ do Instagram e vê o perfil, quem a conta seguiu recentemente e quem começou a segui-la. Visitantes veem uma prévia bloqueada; assinantes (Starter US$ 12/semana, Premium US$ 14/semana, trimestral com 30% off) veem tudo. A interface é em inglês; o mercado é o exterior.

Os dados vêm de scrapers pagos da **Apify**. **Cada consulta nova custa dinheiro real** (hoje cerca de US$ 0,045 por @ consultado, no plano Free da Apify). O produto precisa funcionar com milhares de usuários sem que o custo de dados coma a margem.

## Regra número 1: custo antes de código

Toda feature nova, ou mudança em feature existente, que chame um provedor pago (Apify, Anthropic, e-mail, qualquer API cobrada por uso) **precisa de uma análise de custo antes da implementação**:

1. Preencha a seção "Custo" do template [docs/features/_template.md](docs/features/_template.md): quais chamadas, custo unitário, quantas por usuário por período, custo por usuário por semana em comparação com a receita do plano, e o pior caso.
2. Escolha a estratégia de menor custo que ainda entrega a feature, usando o catálogo de táticas de [docs/cost-strategy.md](docs/cost-strategy.md): cache compartilhado, sonda barata antes da coleta cara, deduplicação de alvos entre usuários, lote, frequência adaptativa, cotas por plano, teto global.
3. Toda chamada paga nova passa pelo mesmo caminho das atuais: cache, depois deduplicação, depois `gate()` (cota e teto diário), depois o run, depois `logRun()`. Nunca chame o provedor direto de uma rota.
4. Se a feature não fecha a conta com margem, diga isso à pessoa usuária antes de construir. Não esconda o custo.

Ao revisar código, trate um aumento de chamadas pagas sem justificativa como um bug.

## Comandos

```sh
npm ci
npm run dev        # Vite (front) + API Hono em http://localhost:8787, juntos
npm test           # Postgres em memória (PGlite); não lê .env, não chama provedores
npm run build      # tsc -b && vite build
npm run typecheck
```

- Node 22 ou superior (produção usa Node 24).
- `?mock=1` em qualquer página do front usa dados gravados e **não gasta nada**. Use para trabalhar na interface. Ver [src/components/funnel/mock.ts](src/components/funnel/mock.ts).
- `npm run dev` com `.env` local **gasta dinheiro de verdade** em cada consulta nova (Apify e Anthropic de produção) e escreve no banco de produção.

## Mapa do código

| Caminho | O que é |
|---|---|
| [server/app.ts](server/app.ts) | Todas as rotas HTTP (Hono). Fino: valida, identifica quem pede, chama serviço. |
| [server/service.ts](server/service.ts) | Regras de negócio da busca: cache, deduplicação, `gate()` (cotas e teto de gasto), teaser. |
| [server/providers/apify.ts](server/providers/apify.ts) | **Único** lugar que fala com a Apify. Registro `ACTORS` com slug, input, custo e teto por run. Normaliza os dados. |
| [server/cache.ts](server/cache.ts) | Cache chave/valor com TTL, cache de gênero, log de custo (`runs`), cotas diárias (`searches`). |
| [server/gender.ts](server/gender.ts) | Classificação de gênero por nome com Claude Haiku, cache permanente por username. |
| [server/auth.ts](server/auth.ts) | Contas, sessão em cookie, assinatura ativa (`hasAccess`), reset de senha (Resend). |
| [server/stripe.ts](server/stripe.ts) | Pagamento ativo: Stripe Payment Element, webhook, portal. |
| [server/billing.ts](server/billing.ts) | PaymentKit, provedor antigo, desligado (`PAYMENT_PROVIDER`). |
| [server/admin.ts](server/admin.ts), [server/search-activity.ts](server/search-activity.ts) | Painel `/admin` e registro de consultas. |
| [server/db.ts](server/db.ts) | Pool Postgres e **todas as migrações** (DDL idempotente). |
| [api/index.ts](api/index.ts) | Função única da Vercel que serve o app Hono. |
| [src/config/site.ts](src/config/site.ts) | Marca, planos, preços, promoção, prova social. |
| [src/lib/types.ts](src/lib/types.ts) | Contrato de tipos entre front e API. |
| [src/pages/](src/pages/), [src/components/funnel/](src/components/funnel/) | Páginas e o funil de busca (prévia, bloqueio, loading). |

Arquitetura completa: [docs/architecture.md](docs/architecture.md).

## Invariantes (não quebrar)

- **Banco compartilhado.** O Postgres (Supabase) é usado por outros projetos. Todo SQL usa o schema `followcatch` com nome qualificado (`followcatch.tabela`). Nunca toque outro schema. Nada de `SET search_path` nem prepared statement nomeado: o pooler de transação não guarda sessão.
- **Migrações** ficam só em `server/db.ts`, precisam ser idempotentes (`IF NOT EXISTS`) e rodam no primeiro acesso, protegidas por advisory lock.
- **Teaser é seguro no servidor.** Quem não assina recebe itens bloqueados **sem** username, nome ou foto (`teaser()` em `service.ts`). Não mande o dado completo ao navegador para esconder com CSS.
- **Sem prova social inventada.** Avaliações, contagens de usuários, assinaturas recentes e depoimentos só entram quando forem reais (`site.socialProof`).
- **Segredos** ficam no `.env` local e nas variáveis da Vercel. Nunca no Git, em logs ou em respostas de API. Nenhum IP cru sai pela API.
- **Testes** nunca acessam produção nem provedores pagos.
- **Pagamento ativo é o Stripe.** O caminho da PaymentKit existe, mas está desligado.

## Pegadinhas conhecidas

- O actor das listas (`scraping_solutions`) exige `resultsLimit` de pelo menos 25. `LIST_SIZE` em `apify.ts` define quantos itens vêm; o custo é linear.
- O actor anterior (`datadoping`) foi trocado em 2026-11-04 porque **não devolvia em ordem de recência** e custava 3,5 vezes mais. Antes de trocar de actor, valide a ordem contra o app (ver [docs/providers.md](docs/providers.md)).
- A ordem do dataset é a ordem de recência (following validado contra o app em 2026-11-04). O produto depende disso para mostrar "novos".
- A conta Apify está no plano Free: US$ 5 por mês e 5 runs simultâneos. Não rode testes em paralelo nem em volume sem checar o saldo.
- O Claude Haiku 5.5 vem com thinking ligado; sem `thinking: { type: "disabled" }`, o `max_tokens` é consumido e a resposta vem vazia.
- O gênero é mapeado por índice, não por posição; uma lista posicional desalinhou na prática.
- Uma lista vazia não entra no cache, porque pode ter sido uma falha do provedor.
- Perfil privado ou inexistente é cacheado por 1 h e não dispara runs de lista.
- As listas são coletadas **sob demanda**: `useSearch` não carrega nenhuma sozinho; a tela chama `ensure("following" | "followers")` para a aba que mostra. Não volte a carregar as duas em paralelo: cada lista é uma coleta paga.
- Os limites de uso aparecem em texto nos termos (`src/pages/legal/Legal.tsx`, seção 5). Mudou cota ou balde? Atualize o texto.
- A Vercel limita a função a 120 s (`vercel.json`); o run síncrono da Apify usa `timeout=110`.

## Documentação

| Documento | Quando ler |
|---|---|
| [docs/product.md](docs/product.md) | Modelo de negócio, planos, funil, o que está prometido e o que existe. |
| [docs/cost-strategy.md](docs/cost-strategy.md) | **Antes de qualquer feature que use provedor pago.** Custos atuais, riscos, táticas, cenários de escala. |
| [docs/providers.md](docs/providers.md) | Actors da Apify, Anthropic, Stripe, Resend: preços, limites, formato dos dados. |
| [docs/architecture.md](docs/architecture.md) | Fluxo das requisições, tabelas, deploy, variáveis de ambiente. |
| [docs/decisions.md](docs/decisions.md) | Decisões tomadas e o motivo. |
| [docs/roadmap.md](docs/roadmap.md) | Features pendentes e ideias, cada uma com a estratégia de custo esperada. |
| [docs/features/](docs/features/) | Uma especificação por feature, com análise de custo. |

## Manter esta documentação viva

A documentação faz parte da entrega. Na mesma mudança que alterar o comportamento:

- **Feature nova:** crie `docs/features/<nome>.md` a partir do template e atualize [docs/roadmap.md](docs/roadmap.md).
- **Mudança de custo, provedor, cota, TTL ou preço:** atualize [docs/cost-strategy.md](docs/cost-strategy.md) e [docs/providers.md](docs/providers.md).
- **Decisão de produto ou arquitetura:** acrescente uma entrada datada em [docs/decisions.md](docs/decisions.md).
- **Rota, tabela, variável de ambiente ou comando novo:** atualize [docs/architecture.md](docs/architecture.md) e, se mudar algo listado aqui, este arquivo.

Escreva o que não dá para deduzir lendo o código: motivo, custo, restrição, armadilha. Não copie listas que o código já mostra. Se encontrar algo desatualizado, corrija ou avise.

Código, comentários e documentação ficam em português; textos da interface, em inglês.
