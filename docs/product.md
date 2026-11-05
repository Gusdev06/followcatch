# Produto e modelo de negócio

## Proposta

FollowCatch mostra a atividade de qualquer conta **pública** do Instagram: quem ela começou a seguir recentemente e quem começou a segui-la, separados por gênero. O público é quem quer acompanhar uma pessoa específica (parceiro, ex, crush, concorrente, influenciador). A interface é em inglês; o mercado-alvo é o exterior.

O negócio é **assinatura recorrente com lucro**. Toda decisão de produto considera a receita por assinante e o custo de dados por assinante (ver [cost-strategy.md](cost-strategy.md)).

## Planos e preços

Definidos em [src/config/site.ts](../src/config/site.ts) e no catálogo do Stripe (`server/stripe.ts`); os dois precisam bater.

| Plano | Semanal | Trimestral (30% off) | Prometido na página de planos |
|---|---|---|---|
| Starter | US$ 12 | US$ 109,20 (US$ 8,40 por semana) | Até 2 contas, novos following e followers, alertas de unfollow, suporte por e-mail |
| Premium | US$ 14 | US$ 127,40 (US$ 9,80 por semana) | Contas ilimitadas, novos following e followers, alertas de unfollow, story viewer, suporte prioritário |

- Preço "âncora" riscado: US$ 30 (Starter) e US$ 35 (Premium) por semana.
- Barra de promoção: "Launch Sale · Quarterly 30% Off", sem data de fim (`site.promo.endsAt = null`).
- Prova social (`site.socialProof`) está vazia de propósito: só entra quando for real.

## Funil

1. **Landing (`/`)**: barra de busca, FAQ, promoção.
2. **Busca (`/search?u=@`)**: o perfil aparece completo. As listas aparecem como prévia: um item real por gênero e o resto bloqueado. Botão fixo de desbloqueio. Só a lista da aba aberta é coletada; a outra só no clique.
3. **Planos (`/plans`)** e **cadastro (`/signup`)**: e-mail e senha (login com Google removido).
4. **Checkout (`/checkout`)**: cartão na própria página (Stripe Payment Element).
5. **Boas-vindas (`/welcome`)**: confirma o pagamento e leva ao dashboard.
6. **Dashboard (`/app`)**: busca com listas completas, buscas recentes, plano e portal de cobrança.

## O que existe e o que está prometido

| Funcionalidade | Estado |
|---|---|
| Perfil, following e followers recentes (25 mais recentes) | Existe |
| Separação por gênero | Existe (estimativa por IA) |
| Prévia bloqueada para visitantes | Existe |
| Contas, assinatura, portal, reset de senha | Existe |
| Painel admin (cadastros, consultas) | Existe |
| **Rastrear contas** (2 no Starter, ilimitadas no Premium) | **Não existe**: não há conceito de conta monitorada. Hoje o plano só muda o acesso às listas completas. |
| **Alertas de unfollow** | **Não existe**: exige snapshots e comparação. |
| **Story viewer** | **Não existe**: `/api/stories` devolve `unavailable`; a página `/story-viewer` existe. |
| Suporte prioritário | Sem diferença operacional definida. |

Fechar essa distância é a prioridade do [roadmap](roadmap.md): o cliente está pagando por funcionalidades que ainda não recebe.

## Limites de uso

| Quem | Limite atual | Configuração |
|---|---|---|
| Visitante | 5 @ novos por dia por IP, dentro de um balde de gasto de US$ 2 por dia para todos os visitantes (provisório) | `FREE_SEARCHES_PER_IP`, `VISITOR_DAILY_USD` |
| Assinante Starter | 10 @ novos por dia e 27 por semana | `SUBSCRIBER_SEARCHES_PER_DAY`, `SUBSCRIBER_WEEKLY_STARTER` |
| Assinante Premium | 10 @ novos por dia e 40 por semana | `SUBSCRIBER_SEARCHES_PER_DAY`, `SUBSCRIBER_WEEKLY_PREMIUM` |
| Todos | Disjuntor de US$ 10 por dia de gasto estimado | `MAX_DAILY_USD` |

Repetir um @ já consultado no mesmo dia não conta. Respostas de cache não gastam. O dia zera à meia-noite UTC e a semana na segunda-feira, também 00:00 UTC. As cotas dos assinantes vêm de cerca de 15% do líquido semanal de cada plano (ver [cost-strategy.md](cost-strategy.md#4-custo-por-jornada-como-o-código-está-hoje)).

Os limites constam nos termos de uso (`/terms`, seção 5, atualizada em 2026-11-04). **Ao mudá-los, atualize `src/pages/legal/Legal.tsx`.**

**Pendente:** o Premium ainda diz "Unlimited accounts" (decisão de Leandro de manter por ora; ideia: "Up to 20 accounts"), o que não condiz com a cota semanal de 40 consultas novas.
