# Admin: aba Custos

**Estado:** no ar desde 2026-11-04 (só no código local até o deploy)
**Planos:** interno
**Atualizado em:** 2026-11-04

## Problema e valor

O produto precisa dar lucro, e o custo de dados é o principal custo variável. Antes desta aba não havia como saber quanto se gasta por dia, quem gasta, quanto o cache economiza nem se um assinante passa da conta. Ver [cost-strategy.md](../cost-strategy.md).

## Comportamento

`/admin` → aba **Custos** (mesma `ADMIN_KEY`, só leitura, atualiza a cada 60 segundos). Valores **estimados** pelo custo por item que o servidor assume, não a fatura da Apify. Dia e semana em UTC, como os limites.

- **Gasto hoje** contra o disjuntor global, e **balde dos visitantes** contra o limite dele (barra vermelha a partir de 80%).
- **Cache hit do perfil (7 dias e hoje):** consultas de perfil atendidas sem pagar ÷ total com resultado.
- **Gasto de visitantes por checkout concluído (30 dias):** aproximação do custo de dados para adquirir um assinante.
- **Gasto por dia (14 dias):** visitantes, assinantes, sem dono (coletas anteriores a 2026-11-04), total e coletas com falhas.
- **Assinantes na semana:** custo, coletas e uso da cota semanal de cada um (até 20, do mais caro ao mais barato).
- **Por actor (30 dias):** coletas, falhas, itens, custo e tempo médio.

## Dados

`GET /api/admin/costs` ([server/admin.ts](../../server/admin.ts), `adminCosts`). Fontes: `runs` (com `who` e `bucket`), `search_events.cache`, `searches`, `subscriptions`, `checkouts.completed_at`.

## Custo

Nenhuma chamada paga: só leitura no Postgres, 6 consultas agregadas por atualização.

## Limitações conhecidas

- Estimativa, não fatura. Falhas aparecem com custo 0 (a Apify pode cobrar a partida; risco R7).
- "Cache hit" só mede consultas de perfil. Listas não têm medição própria.
- Runs anteriores a 2026-11-04 não têm dono: contam no total e em "sem dono".
- "Visitantes por checkout" divide o gasto pelo número de checkouts concluídos; não liga um visitante específico à compra.

## Implementação

[src/pages/AdminCosts.tsx](../../src/pages/AdminCosts.tsx), aba em [src/pages/Admin.tsx](../../src/pages/Admin.tsx), testes em [tests/costs.test.mjs](../../tests/costs.test.mjs).
