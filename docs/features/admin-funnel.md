# Funil, Visitantes e Ao vivo no /admin

**Estado:** no ar
**Planos:** interno
**Atualizado em:** 2026-11-05

## Problema e valor

Com anúncio rodando, é preciso ver onde a pessoa desiste e qual anúncio traz quem compra. Molde: painel do The Kingdom of Love. Não entram as abas sem equivalente aqui (consultas espirituais, rituais, comunidade); "Leads" já é a aba Cadastros.

## Comportamento

- **Funil:** visitantes únicos por etapa (landing, busca, prévia, planos, cadastro, checkout, clicou em pagar), compra e cortes por anúncio, campanha, país e aparelho.
- **Visitantes:** pessoas do período, chegadas por hora em Bali, online e até onde cada uma foi.
- **Ao vivo:** quem está no site, atualizado a cada 3 s, com filtro por campanha.

## Dados

Identificador aleatório por navegador em `localStorage`. **Sem IP**, diferente do painel do Kingdom: o AGENTS.md proíbe IP cru na API. "Compra" é visitante com conta e checkout concluído depois da chegada dele (comprador antigo que só visitou não conta): quem assina em outro navegador sem conta ligada ao visitante não entra.

## Custo

| Chamada paga | Custo unitário | Chamadas por usuário por semana | Custo por usuário por semana |
|---|---|---|---|
| Nenhum provedor por uso | US$ 0 | 0 | US$ 0 |

- O gasto é indireto: invocações da Vercel e escrita no Postgres compartilhado. Cada visitante gera poucas etapas e 1 batimento a cada 10 s com a página visível (6 por minuto).
- **Risco:** o `funnel_events` não tem retenção; `live_sessions` apaga linhas com mais de 7 dias. Relatório lê no máximo 200 mil eventos.
- **Visitante anônimo pode disparar o gasto?** Sim, gravação pública: filtro de robô, validação de etapa e id, corpo limitado a 2 KB. Não chama provedor pago.
- **Como medir:** invocações na Vercel e tamanho de `funnel_events`.
