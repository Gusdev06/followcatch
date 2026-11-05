# Estratégia de custos

> FollowCatch é um SaaS feito para dar lucro. O maior custo variável é a coleta de dados do Instagram, paga por item. Este documento diz quanto cada operação custa, onde o dinheiro vaza hoje e quais táticas usar para entregar cada feature com o menor gasto possível, pensando em milhares de usuários.
>
> **Leitura obrigatória antes de criar ou mudar qualquer feature que chame um provedor pago.**

Última revisão: 2026-11-04. Os valores de custo são os de `ACTORS` em `server/providers/apify.ts`, nos preços da faixa Free da Apify (plano atual). Os custos do perfil e das listas foram conferidos contra o valor cobrado em runs reais em 2026-11-04; a reconciliação periódica com a fatura ainda não existe (ver [seção 8](#8-métricas-e-reconciliação)).

## 1. Princípios

1. **Quem paga é o alvo, não o usuário.** Um @ coletado uma vez deve servir a todos que pedirem o mesmo @ dentro da janela de validade. Cache e agendamento são sempre por alvo.
2. **Sonda barata antes da coleta cara.** Um perfil custa cerca de US$ 0,0026; as duas listas, cerca de US$ 0,043, ou seja, 16 vezes mais. Use o barato para decidir se o caro é necessário.
3. **Só colete o que a tela vai mostrar.** Dado coletado e não exibido é dinheiro jogado fora.
4. **Todo gasto tem dono e limite.** Cada run passa por cota (por visitante ou por conta), teto por run (`maxTotalChargeUsd`) e teto diário global, e é registrado em `followcatch.runs`.
5. **O custo de uma feature é calculado por usuário por semana e comparado com a receita do plano** antes de construir.
6. **Medir antes de otimizar além do óbvio.** Taxa de cache hit, custo por assinante e custo por conversão precisam ser medidos; hoje boa parte não é (ver seção 8).

> **2026-11-05, em produção:** `VISITOR_DAILY_USD` = 10 e `MAX_DAILY_USD` = 15, decisão do Gusta com a campanha da Meta no ar. Apify no plano Starter, limite de US$ 19 no ciclo até 04/12. Na largada, os dados custaram perto de metade do gasto com anúncio (amostra pequena): reavaliar com mais vendas. O plano Free devolve 0 item com status de sucesso no actor das listas.

## 2. Custo de cada operação (hoje)

| Operação | Provedor | Custo estimado | Teto por run | Cache |
|---|---|---|---|---|
| Perfil de 1 @ | Apify `instagram-profile-scraper` | US$ 0,0026 | US$ 0,02 | 24 h (privado ou inexistente: 1 h) |
| Following (25 mais recentes) | Apify `scraping_solutions` | 25 × US$ 0,00085 = **US$ 0,021** | US$ 0,05 | 6 h |
| Followers (25 mais recentes) | Apify `scraping_solutions` | 25 × US$ 0,00085 = **US$ 0,021** | US$ 0,05 | 6 h |
| Gênero de uma lista | Anthropic Claude Haiku 5.5 | Frações de centavo (preço por token a conferir) | — | Permanente por username |
| Proxy de imagem | Vercel (banda e invocação) | Baixo por imagem; cresce com tráfego | — | CDN 7 dias |
| E-mail de reset de senha | Resend | Irrelevante no volume atual | — | — |

**Consulta completa de um @ novo (perfil + 2 listas): cerca de US$ 0,045** nos preços da faixa Free da Apify (Bronze: cerca de US$ 0,037; ver [providers.md](providers.md#custo-por-plano-da-apify-2026-11-04)). Era US$ 0,155 com o actor anterior, até 2026-11-04. Uma consulta repetida dentro do TTL custa zero.

## 3. Receita por plano e quanto podemos gastar

| Plano | Cobrança | Receita por semana | Tarifa Stripe estimada* | Líquido por semana |
|---|---|---|---|---|
| Starter semanal | US$ 12 por semana | 12,00 | ~0,65 (5,4%) | ~11,35 |
| Starter trimestral | US$ 109,20 a cada 13 semanas | 8,40 | ~0,27 | ~8,13 |
| Premium semanal | US$ 14 por semana | 14,00 | ~0,71 (5,0%) | ~13,29 |
| Premium trimestral | US$ 127,40 a cada 13 semanas | 9,80 | ~0,31 | ~9,49 |

\* Tarifa padrão de cartão nos EUA, 2,9% + US$ 0,30 por cobrança. Confirmar na conta Stripe. A cobrança semanal paga a taxa fixa 13 vezes por trimestre; o trimestral é mais barato também nisso.

**Meta proposta (a confirmar com o dono do produto):** custo variável de dados por assinante de **no máximo 15% do líquido semanal**, ou seja, cerca de US$ 1,20 a 2,00 por assinante por semana. Na prática, um Starter trimestral comporta cerca de **27 consultas completas novas por semana**. Toda feature deve caber nessa conta, somada às outras.

## 4. Custo por jornada (como o código está hoje)

### Visitante (sem login)

O funil (`useSearch`) busca o perfil e **só a lista da aba aberta** (following, a aba padrão); a outra lista só é coletada se a pessoa clicar nela (`ensure` em [useSearch.ts](../src/components/funnel/useSearch.ts)). Até 2026-11-04 as duas listas eram coletadas em paralelo para todo visitante, mesmo que ele só olhasse a prévia bloqueada.

- Custo por @ novo consultado: cerca de **US$ 0,024** (perfil + uma lista) para quem não abre a segunda aba, e cerca de US$ 0,045 para quem abre as duas.
- Cota: 5 @ novos por IP por dia (`FREE_SEARCHES_PER_IP`), ou seja, até cerca de US$ 0,23 por IP por dia.
- **Balde diário dos visitantes** (`VISITOR_DAILY_USD`, padrão US$ 2, **valor provisório ainda não decidido**): é o orçamento de marketing do dia. Quando esgota, só os visitantes são bloqueados ("Free searches are at capacity for today"). Cerca de 44 consultas novas por dia com o padrão.
- **Custo de dados para adquirir um assinante** = 0,045 × (1 − taxa de cache hit) ÷ taxa de conversão por consulta.
  - Exemplo hipotético: 1% de conversão e 20% de cache hit dão cerca de **US$ 3,60 por assinante**, quase meia semana de receita, antes de pagar qualquer anúncio.

### Assinante

Implementado em 2026-11-04. Duas cotas de @ novos, contadas por (conta, @, dia) em `followcatch.searches`:

| Cota | Starter | Premium | Variável | Zera |
|---|---|---|---|---|
| Por dia | 10 | 10 | `SUBSCRIBER_SEARCHES_PER_DAY` | 00:00 UTC |
| Por semana | **27** | **40** | `SUBSCRIBER_WEEKLY_STARTER`, `SUBSCRIBER_WEEKLY_PREMIUM` | segunda 00:00 UTC |

- **Pior caso por assinante por semana:** 27 × US$ 0,045 = **US$ 1,22** (Starter, cerca de 15% do líquido de US$ 8,13 do trimestral) e 40 × US$ 0,045 = **US$ 1,80** (Premium, cerca de 19% do líquido de US$ 9,49 do trimestral e 14% do semanal). Nenhum assinante dá prejuízo só com buscas novas.
- Repetir um @ já contado no dia não gasta cota. Cache hit não passa pelo `gate()`.
- A cota é em número de consultas, mas calculada a partir de um orçamento em dólares. Se o custo por consulta mudar (outro actor, outro plano da Apify), **recalcule as cotas** com: cota semanal = 15% do líquido semanal ÷ custo por consulta.
- Quando a cota acaba, a mensagem diz qual foi (diária ou semanal) e quando zera.

### Global

- **Disjuntor** (`MAX_DAILY_USD`, padrão US$ 10 desde 2026-11-04; era US$ 3): bloqueia qualquer run novo, de visitante ou assinante, quando o gasto estimado do dia (UTC) passaria do teto. Existe para bug ou ataque, não para dosar o uso. O padrão é um valor provisório: **calibre para cerca de 3 vezes o gasto diário normal** quando houver tráfego real. Ao desarmar, escreve `[ALERTA] disjuntor global` no log (uma vez por dia por instância). Ainda não há aviso por e-mail ou push.
- **Invariante:** o balde dos visitantes é sempre menor que o disjuntor (`VISITOR_DAILY_USD` é limitado a `MAX_DAILY_USD`), então visitantes sozinhos nunca bloqueiam assinantes.
- No plano Free da Apify, o limite real continua sendo o de US$ 5 por mês (R0), muito abaixo destes tetos diários.

## 5. Vazamentos e riscos conhecidos

Ordenados por impacto provável. Ao resolver um item, atualize esta lista.

| # | Problema | Impacto | Direção da solução |
|---|---|---|---|
| R0 | **A conta Apify está no plano Free** (verificado em 2026-11-04): teto de US$ 5 por mês e no máximo 5 runs simultâneos. | Cerca de 110 consultas completas **por mês** para o produto inteiro; quando o teto acaba, todas as consultas falham até o próximo ciclo (dia 23). Uma consulta usa 3 runs, então só 1 ou 2 consultas simultâneas. Os preços por item também são os da faixa Free, mais caros. | Decisão de 2026-11-04: continuar no Free durante a fase de testes, com uso contido. Assinar um plano pago (Starter, US$ 19 com US$ 19 de uso) antes de qualquer tráfego real. Ver [providers.md](providers.md#plano-da-conta-apify). |
| R1 | **Reduzido em 2026-11-04.** A lista da outra aba agora só é coletada no clique (visitante que só olha uma aba custa cerca de US$ 0,024, não US$ 0,045). | Resta o custo da primeira lista, coletada durante a animação para a prévia abrir pronta. | Só reduzir mais com teste A/B de conversão (prévia menor, cota grátis menor), quando houver tráfego. |
| ~~R2~~ | ~~Cota do assinante (50 por dia) permite custo maior que a receita.~~ **Resolvido em 2026-11-04** (cota por dia e por semana, por plano; seção 4). | — | Falta citar o uso justo nos termos (`/terms`). |
| ~~R3~~ | ~~O teto diário é um balde só.~~ **Resolvido em 2026-11-04** (balde de visitantes, cotas de assinante e disjuntor global; seção 4). | — | O valor do balde dos visitantes é provisório. |
| R10 | O mesmo @, no mesmo dia, pode rodar de novo quando o cache da lista (6 h) expira, e isso **não** consome cota (a linha de `searches` é por @ e por dia). | Até 4 coletas de lista por @ por dia, cerca de US$ 0,043 cada, fora da cota. Raro, mas furaria a conta do pior caso. | Contar a coleta, não o @ (por exemplo, uma linha por run em `runs` com `who`), ou subir o TTL da lista. Medir antes. |
| ~~R11~~ | ~~Run que falha consome a cota.~~ **Resolvido em 2026-11-04:** a cota é devolvida quando o run de perfil ou de lista falha, e uma lista vazia de um perfil que tem seguidores passa a ser tratada como falha do provedor (erro, sem cache). | — | A cota do @ que o perfil já gastou não é devolvida se só a lista falhar. |
| R4 | A cota grátis é por IP. | VPN e IPv6 contornam; bots drenam o orçamento; NAT compartilhado penaliza inocentes. | Captcha ou desafio invisível antes do primeiro run pago; combinar IP e cookie `fc_visitor`; detecção de padrão de bot. |
| R5 | A deduplicação em voo (`inflight`) vale só dentro de uma instância. | Na Vercel, duas instâncias podem coletar o mesmo @ ao mesmo tempo. | Trava no banco (linha de "coleta em andamento" ou advisory lock por chave). |
| R6 | A classificação de gênero continua em segundo plano depois da resposta. | Em serverless, o processo pode ser congelado e a chamada paga se perde e é refeita. **A verificar.** | `waitUntil` da Vercel ou mover para fila. |
| R7 | Run que falha é registrado com custo 0. | A Apify pode cobrar o início do run; `runs` subestima o gasto. | Reconciliar com a fatura da Apify; ler o custo real do run pela API da Apify. |
| ~~R8~~ | ~~A taxa de cache hit não é medida.~~ **Resolvido em 2026-11-04** para consultas de perfil (`search_events.cache`), visível na aba Custos do admin. | Listas não têm medição própria; os runs de lista aparecem em `runs`. | Acompanhar a taxa por semana antes de mexer nos TTL. |
| R9 | URLs do CDN do Instagram têm assinatura que expira. | O proxy de imagem cacheia por URL; URLs novas viram cache miss. | Baixo hoje. Em escala, guardar avatar em storage próprio por username. |

## 6. Catálogo de táticas

Use esta lista como cardápio. Toda feature nova deve dizer quais táticas usa e por quê.

| Tática | O que é | Quando usar | Já usada? |
|---|---|---|---|
| **T1. Cache compartilhado por alvo** | Chave é o @, não o usuário. TTL conforme a necessidade de frescor. | Sempre. | Sim (`kv`) |
| **T2. Cache negativo** | Guardar "não existe" e "privado" por pouco tempo. | Sempre que o resultado vazio for estável. | Sim (1 h) |
| **T3. Deduplicação em voo** | Pedidos iguais simultâneos compartilham um run. | Sempre. Em escala, no banco e não só em memória. | Parcial (R5) |
| **T4. Sonda barata antes da coleta cara** | Ler contagens do perfil (US$ 0,0026) e só coletar listas (US$ 0,043) se mudaram. | Monitoramento, atualização de dados antigos. | Parcial (perfil privado não dispara listas) |
| **T5. Coleta sob demanda** | Buscar só o que a tela mostra, quando ela mostra. | Abas, detalhes, telas secundárias. | Não |
| **T6. Deduplicação de alvos entre usuários** | N assinantes que monitoram o mesmo @ geram 1 coleta. | Monitoramento, alertas, relatórios. | Não se aplica ainda |
| **T7. Lote** | Vários @ em um run quando o actor aceita (o `profile-scraper` aceita lista). | Jobs agendados. Conferir se o actor cobra por início de run. | Não |
| **T8. Frequência adaptativa** | Contas que mudam pouco são verificadas com menos frequência; aumenta após mudança. | Monitoramento. | Não |
| **T9. Cotas por plano e orçamentos separados** | Limites por usuário derivados da receita do plano; balde de visitante separado do de assinante. | Qualquer feature paga. | Sim, para a busca (2026-11-04); falta nas features futuras |
| **T10. Teto por run** | `maxTotalChargeUsd` em todo run; a Apify aborta antes de passar. | Sempre, sem exceção. | Sim |
| **T11. Snapshot e diff** | Guardar o último estado e comparar; para "novos", basta a cabeça da lista (ordem de recência). | Alertas de novos seguidores, histórico. | Não |
| **T12. Trabalho assíncrono** | Fila ou cron em vez de run síncrono na requisição; fora do pico; sem limite de 120 s. | Coleta periódica, relatórios, lotes. | Não |
| **T13. Persistência permanente do que não muda** | Ex.: gênero por username. | Classificações, enriquecimentos. | Sim (`gender`) |
| **T14. LLM barato** | Menor modelo capaz, em lote, só para o que falta no cache, sem thinking, `max_tokens` justo. | Qualquer uso de IA. | Sim |
| **T15. Troca de provedor** | Registro `ACTORS` isola o fornecedor; comparar preço e qualidade periodicamente. | Quando surgir actor mais barato ou o atual quebrar. | Estrutura pronta |
| **T16. Antiabuso antes do gasto** | Captcha, limites e detecção de bot antes do primeiro run pago. | Tudo que visitante anônimo dispara. | Não (R4) |

## 7. Escala: como pensar milhares de usuários

Custo diário de dados ≈ (consultas novas de visitantes + consultas novas de assinantes + coletas agendadas) × custo unitário × (1 − cache hit).

Pontos que mudam com escala:

- **O cache rende mais com alvos populares** (celebridades, marcas), mas o caso de uso principal (ver quem uma pessoa específica segue) é de cauda longa. **Não conte com cache hit alto** sem medir (R8).
- **Monitoramento recorrente é o que define o custo de um assinante**, não a busca avulsa. Exemplo: verificar 2 contas por dia com as duas listas custa cerca de US$ 0,63 por semana, cerca de 8% do líquido do Starter trimestral. Com sonda barata (T4) e só coletando quando a contagem mudar, cai para uma fração disso. "Contas ilimitadas" no Premium **exige** cota de uso justo.
- **O balde dos visitantes deve crescer com a receita**, por exemplo um percentual da receita do dia anterior. Hoje é um valor fixo.
- **Novas features pagas** (monitoramento, stories) precisam do próprio balde ou de uma cota dentro da cota semanal do plano; não somar em silêncio ao que o assinante já gasta com buscas.
- **Compute e banco** (Vercel, Supabase) hoje são marginais. Com jobs agendados, prefira um worker ou fila a manter funções serverless ocupadas esperando a Apify.

## 8. Métricas e reconciliação

| Métrica | Fonte hoje | Lacuna |
|---|---|---|
| Gasto estimado do dia | `followcatch.runs`, `GET /api/health` | Estimativa, não fatura (R7). |
| Gasto real | Painel ou API de uso da Apify | Não reconciliado. Fazer pelo menos uma vez por semana. |
| Cache hit (perfil) | `search_events.cache`, aba Custos do `/admin` | Só consultas de perfil; listas não. |
| Custo por assinante por semana | `runs.who` + `runs.bucket`, aba Custos | Estimativa, e só desde 2026-11-04 (runs antigos ficam sem dono). |
| Gasto de visitantes por checkout concluído (30 dias) | aba Custos | Aproximação: não liga o visitante específico à compra (`fc_visitor`). |

A aba **Custos** do `/admin` (implementada em 2026-11-04, ver [features/admin-costs.md](features/admin-costs.md)) mostra gasto do dia contra os limites, gasto por dia, cache hit, custo e cota por assinante na semana e gasto por actor.

## 9. Checklist para qualquer feature nova

Copie para a seção "Custo" do documento da feature ([template](features/_template.md)):

- [ ] Quais chamadas pagas a feature faz, com custo unitário de cada uma.
- [ ] Quantas chamadas por usuário por semana, no uso típico e no pior caso.
- [ ] Custo por usuário por semana ÷ líquido do plano (seção 3), somado às features existentes.
- [ ] O dado é compartilhável entre usuários? Qual a chave de cache e o TTL?
- [ ] Existe sonda mais barata que evita a coleta cara?
- [ ] Precisa ser síncrona ou pode ir para fila ou cron?
- [ ] Qual cota por plano e qual o comportamento quando a cota acaba?
- [ ] O visitante anônimo consegue disparar esse gasto? Com que proteção?
- [ ] Teto por run configurado?
- [ ] Como o custo será medido depois do lançamento?
