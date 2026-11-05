# Decisões

Registro das decisões de produto e arquitetura, da mais recente para a mais antiga. Cada entrada diz o que foi decidido e por quê. Decisões revertidas não são apagadas: marque como substituídas e aponte a nova.

Formato:

```
## AAAA-MM-DD — Título curto
**Decisão:** o que foi decidido.
**Motivo:** por quê.
**Consequências:** o que isso implica ou restringe.
```

---

## 2026-11-04 — Toda feature paga passa por análise de custo

**Decisão:** nenhuma feature que chame provedor pago é implementada sem a análise de custo de [cost-strategy.md](cost-strategy.md) e do [template de feature](features/_template.md).
**Motivo:** o produto é um SaaS que visa lucro e mira milhares de usuários; o custo de dados por consulta é o principal custo variável.
**Consequências:** a documentação de custo faz parte da entrega; aumentar chamadas pagas sem justificativa é tratado como bug.

## 2026-11-04 — Custos no admin, lista sob demanda e cota devolvida em falha

**Decisão:** (1) A aba Custos do `/admin` mostra gasto, cache hit, custo e cota por assinante e gasto por actor. (2) Só a lista da aba aberta é coletada; a outra, apenas no clique. (3) A cota é devolvida quando a coleta falha, e lista vazia de perfil que tem seguidores é tratada como falha do provedor. (4) Os termos de uso (`/terms`, seção 5) informam os limites de uso justo.
**Motivo:** (1) medir antes de otimizar; (2) cada lista é uma coleta paga e o visitante muitas vezes só olha uma aba, o que corta cerca de metade do custo dele; (3) o assinante não deve perder cota por erro nosso, e o actor já devolveu "sucesso" com 0 itens; (4) transparência sobre os limites.
**Consequências:** a seção 5 dos termos cita números (5 por dia sem assinatura; 10 por dia e 27 ou 40 por semana com assinatura). **Ao mudar os limites, atualize `src/pages/legal/Legal.tsx`.**

## 2026-11-04 — "Unlimited accounts" do Premium fica como está por enquanto

**Decisão (Leandro):** manter o texto "Unlimited accounts" por ora. Ideia salva para depois: trocar por "Up to 20 accounts".
**Motivo:** contas monitoradas ainda não existem; o número só importa quando a feature for construída.
**Consequências:** o site continua prometendo algo sem teto, enquanto o produto terá cota. Revisar antes de construir o monitoramento e antes de tráfego pago.

## 2026-11-04 — Captcha de visitante fica para depois

**Decisão (Leandro):** não implementar agora. Plano e gatilho em [roadmap.md](roadmap.md).

## 2026-11-04 — Cotas por plano, balde dos visitantes e disjuntor global

**Decisão:** o teto único de gasto diário foi dividido em três camadas. (1) Assinante: cota de @ novos por dia (10) e por semana (27 no Starter, 40 no Premium). (2) Visitante: cota por IP (5 por dia) e balde de gasto próprio (`VISITOR_DAILY_USD`, provisório). (3) Disjuntor global (`MAX_DAILY_USD`, agora US$ 10), só contra bug e ataque. Cada run registra `who` e `bucket`.
**Motivo:** o teto global de US$ 3 deixava visitantes bloquearem quem paga, e a cota de 50 por dia permitia a um assinante custar mais que a receita. As cotas semanais saem de cerca de 15% do líquido semanal do plano (meta definida por Leandro) dividido pelo custo por consulta.
**Consequências:** o assinante nunca é bloqueado pelo gasto de visitantes. As cotas precisam ser recalculadas quando o custo por consulta mudar. Riscos residuais R10 e R11 em [cost-strategy.md](cost-strategy.md). Pendente: refletir os limites no site e nos termos, e trocar "Unlimited accounts" por um número.

## 2026-11-04 — Listas via `scraping_solutions`, 25 itens

**Decisão:** following e followers passam a vir de `scraping_solutions~instagram-scraper-followers-following-no-cookies`, com 25 itens por lista (`LIST_SIZE`), no lugar do `datadoping` com 50.
**Motivo:** comparado com o app do Instagram ("Date followed: latest"), o novo actor devolveu o following na ordem exata; o `datadoping` não devolvia em ordem de recência, ou seja, o produto mostrava "seguiu recentemente" errado. O novo também é cerca de 3,5 vezes mais barato por consulta (US$ 0,045 contra US$ 0,155 na faixa Free) e falhou menos no teste.
**Consequências:** assinantes veem 25 itens por lista em vez de 50. Para mais, existe o `continuationToken` do actor (carregar mais pago, sob demanda). Novos follows podem demorar a aparecer no provedor. Detalhes em [providers.md](providers.md).

## 2026-11-04 — Registrar todas as consultas, inclusive de visitantes

**Decisão:** `GET /api/profile` grava cada consulta em `search_events`, com visitante identificado pelo cookie `fc_visitor`. Sem IP nem user agent no novo registro.
**Motivo:** ver no admin o que visitantes e assinantes consultam, incluindo repetições e falhas.
**Consequências:** ver [features/search-activity.md](features/search-activity.md).

## 2026-10-17 — Painel admin protegido por chave

**Decisão:** `/admin` usa o header `x-admin-key` comparado com `ADMIN_KEY`, só leitura, só o schema `followcatch`.
**Motivo:** painel interno simples, sem sistema de papéis.

## 2026-10-16 — Sem login com Google

**Decisão:** login e cadastro só com e-mail e senha.
**Motivo:** não registrado.

## 2026-10-15 — Stripe direto no lugar da PaymentKit

**Decisão:** assinatura via Stripe Payment Element, webhook assinado e portal do cliente. A PaymentKit fica no código, desligada por `PAYMENT_PROVIDER`.
**Motivo:** a PaymentKit exigia "raw card data APIs" na conta Stripe.
**Consequências:** catálogo Stripe com `lookup_key` por plano e ciclo; preços em `server/stripe.ts` precisam bater com `src/config/site.ts`.

## 2026-10-15 — Nada de prova social inventada

**Decisão:** avaliações, usuários do mês, assinaturas recentes e depoimentos só aparecem quando forem reais.
**Motivo:** honestidade com o cliente e com plataformas de anúncio e pagamento.

## 2026-10-15 — Teaser montado no servidor

**Decisão:** quem não assina recebe as listas com um item real por gênero; os outros itens vão sem username, nome ou foto.
**Motivo:** o dado pago não pode ser extraído inspecionando a resposta da API.

## 2026-10-15 — Dados via Apify, isolados em um único arquivo

**Decisão:** perfil com `apify~instagram-profile-scraper`; listas com `datadoping~instagram-*-scraper` (50 itens; substituído em 2026-11-04, ver acima). Toda chamada passa por `server/providers/apify.ts`.
**Motivo:** coleta pronta, paga por item, sem manter scraper próprio. O registro `ACTORS` permite trocar de fornecedor sem mexer nas rotas.
**Consequências:** custo por item; dependência de terceiros; listas limitadas aos mais recentes.

## 2026-10-15 — Gênero por IA com espera curta

**Decisão:** gênero de cada conta estimado pelo Claude Haiku a partir de username e nome, com cache permanente; a resposta HTTP espera no máximo 4 s.
**Motivo:** a separação por gênero é central no produto; o custo é baixo e o cache evita repetir.

## 2026-10-15 — Postgres compartilhado, schema próprio

**Decisão:** usar o Supabase de outro projeto, com tudo no schema `followcatch` e nomes qualificados.
**Motivo:** reaproveitar infraestrutura existente.
**Consequências:** nunca tocar outro schema; sem `search_path` nem prepared statements nomeados (pooler de transação).
