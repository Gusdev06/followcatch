# Provedores externos

Todo serviço pago ou externo que o FollowCatch usa, com custo, limites e particularidades. Para a análise de custo e as táticas, ver [cost-strategy.md](cost-strategy.md).

## Apify (dados do Instagram)

O FollowCatch não acessa o Instagram diretamente. A coleta é feita por "actors" (scrapers prontos) da Apify, chamados em [server/providers/apify.ts](../server/providers/apify.ts), **o único arquivo que fala com a Apify**. Trocar de fornecedor é mudar uma entrada do registro `ACTORS`, não as rotas.

### Como é chamado

- Endpoint `POST https://api.apify.com/v2/acts/{slug}/run-sync-get-dataset-items`: roda o actor e devolve os itens na mesma resposta.
- Parâmetros: `timeout=110` (segundos) e `maxTotalChargeUsd` (a Apify aborta o run antes de passar desse valor).
- Timeout do lado do servidor: 120 s, igual ao limite da função na Vercel.
- Resposta de sucesso é um array de itens; erro é um objeto `{ error: { message } }`.
- Autenticação: `APIFY_TOKEN`.

### Actors em uso

| Uso | Slug | Input | Custo estimado | Teto por run |
|---|---|---|---|---|
| Perfil | `apify~instagram-profile-scraper` | `{ usernames: [u] }` | US$ 0,0026 por perfil | US$ 0,02 |
| Following | `scraping_solutions~instagram-scraper-followers-following-no-cookies` | `{ Account: [u], resultsLimit: 25, dataToScrape: "Followings" }` | US$ 0,00085 por item (Free) | US$ 0,05 |
| Followers | o mesmo actor | `{ Account: [u], resultsLimit: 25, dataToScrape: "Followers" }` | US$ 0,00085 por item (Free) | US$ 0,05 |

Até 2026-11-04 as listas vinham do `datadoping~instagram-*-scraper` (50 itens, US$ 0,00155 por item na faixa Free). Ele foi trocado porque não devolvia em ordem de recência (ver o teste abaixo).

Os custos são as estimativas registradas no código. **Confirme na página de cada actor e na fatura antes de decisões de preço.**

### Plano da conta Apify

Consultado pela API em 2026-11-04:

- Plano **FREE**: US$ 5 de uso por mês (teto rígido), máximo de 5 runs simultâneos, retenção de dados de 7 dias. Ciclo de 23 a 22 de cada mês. Gasto no ciclo até 2026-11-04: cerca de US$ 0,74.
- A Apify cobra preço por faixa do plano. Os custos em `ACTORS` usam os preços da faixa Free. Ao mudar de plano, atualize para os da nova faixa.
- Alguns actors impõem espera entre runs no plano Free (o `seemuapps` exigiu 30 minutos).
- **Ação necessária:** assinar um plano pago antes de tráfego real e atualizar os custos de `ACTORS` para a faixa contratada. Conferir os valores atuais dos planos em apify.com/pricing.

### Custo por plano da Apify (2026-11-04)

Plano (apify.com/pricing): **Free** US$ 0 com US$ 5 de uso e bloqueio ao esgotar; **Starter** US$ 19 por mês com US$ 19 de uso, faixa Bronze, 32 runs simultâneos, excedente até US$ 100; **Scale** US$ 199 com US$ 199 de uso, faixa Silver; **Business** US$ 999, faixa Gold. A mensalidade vira crédito de uso: no Starter, os US$ 19 pagam as próprias consultas. O crédito não acumula de um mês para outro.

Custo de uma consulta completa (perfil + 2 listas), pelos preços por faixa de cada actor:

| Actor das listas | Free | Starter (Bronze) | Scale (Silver) | Business (Gold) |
|---|---|---|---|---|
| `datadoping`, 50 + 50 (anterior) | US$ 0,158 | US$ 0,142 | US$ 0,132 | US$ 0,122 |
| `scraping_solutions`, 25 + 25 (atual) | US$ 0,045 | US$ 0,037 | US$ 0,035 | US$ 0,032 |
| `seemuapps`, 25 + 25 num run | US$ 0,021 (inviável: espera de 30 min entre runs) | US$ 0,020 | US$ 0,020 | US$ 0,020 |

Consultas completas novas que o crédito incluso do mês paga:

| Actor das listas | Free (US$ 5) | Starter (US$ 19) | Scale (US$ 199) |
|---|---|---|---|
| `datadoping` | cerca de 30 | cerca de 130 | cerca de 1.500 |
| `scraping_solutions` | cerca de 110 | cerca de 510 | cerca de 5.700 |
| `seemuapps` | — | cerca de 940 | cerca de 9.900 |

### Actors alternativos testados (2026-11-04)

Teste com @nasa e @therock, 25 itens por lista, custo real lido da Apify (faixa Free):

| Actor | Mínimo de itens | Custo real medido | Tempo | Formato | Resultado |
|---|---|---|---|---|---|
| `datadoping~instagram-*-scraper` (anterior) | 50 | US$ 0,0760 por lista de 49 itens | — | snake_case | Referência |
| `scraping_solutions~instagram-scraper-followers-following-no-cookies` | 25 | US$ 0,0213 por lista de 25 (0,00085 por item; Bronze: 0,0007) | 4 a 6 s | snake_case, campos iguais aos do atual (`username`, `full_name`, `profile_pic_url`, `is_verified`, `is_private`) mais `username_scrape` | Funcionou em 3 de 4 runs; a falha foi o limite de 5 runs simultâneos do plano Free |
| `seemuapps~instagram-followers-scraper` | Livre | US$ 0,0181 pelas **duas** listas de 25 (lote de 50 a US$ 0,009) | 2 a 5 s | camelCase dentro de `results[]`, campo `relation` | Funcionou com @nasa; com @therock devolveu vazio por causa da espera de 30 minutos do plano Free |

**Validação de ordem (2026-11-04).** Following de @leandrinhopelomundo comparado com o app, ordenado por "Date followed: latest":

- `scraping_solutions`: as posições 2 a 10 do app vieram idênticas e na mesma ordem. A primeira do app, seguida minutos antes, não apareceu nem 15 minutos depois: **pode haver atraso** entre seguir e o provedor enxergar. Medir antes de prometer alertas rápidos.
- `datadoping`: nenhum dos 10 primeiros bateu. **Não é ordem de recência.**
- `seemuapps`: não testado na conta validada (espera de 30 minutos do plano Free).
- Followers: o app não ordena seguidores por data, então a ordem não foi validada. Presume-se a mesma lógica do following.

### Formato e particularidades

Conferidos em datasets reais em 2026-10-15:

- **Perfil:** campos em camelCase (`followersCount`, `followsCount`, `postsCount`, `profilePicUrlHD`), com `relatedProfiles` em snake_case por dentro. Quando o @ não existe, vem item com `error`, sem `username` ou sem `id`, ou o dataset vazio.
- **Listas (`scraping_solutions`):** campos em snake_case (`username`, `full_name`, `profile_pic_url`, `is_verified`, `is_private`), mais `username_scrape` (o @ consultado) e `type` (`Followings` ou `Followers`).
- **A ordem do dataset é a ordem de recência.** É isso que permite mostrar "seguiu recentemente" e "novos seguidores". O following foi validado contra o app (ver o teste acima); o followers é presumido.
- `resultsLimit` mínimo é 25 (`LIST_SIZE`). O actor devolve um `continuationToken` no OUTPUT, que permitiria um "carregar mais" pago sob demanda.
- Run vazio custa zero. Uma lista vazia não é cacheada, pois pode ser falha do provedor.
- Contagens às vezes vêm como string (`"1,234"`). A normalização (`num`, `str`, `campo`) aceita todas as grafias.
- O `profile-scraper` aceita vários usernames por run, o que permite lotes em jobs agendados.

### Riscos

- **Falha silenciosa do `datadoping`:** em 2026-11-04, com @leandrinhopelomundo, os dois actors terminaram como `SUCCEEDED` com 0 itens. O log mostrava HTTP 502 e timeout no servidor deles. Uma nova tentativa minutos depois funcionou. O app trata isso como "lista vazia" (não cacheia), e o usuário vê a lista vazia.
- Os actors são de terceiros e podem quebrar quando o Instagram muda. O teste de fumaça é uma consulta real em `npm run dev`.
- A coleta de dados públicos do Instagram está sujeita aos termos do Instagram e às leis de privacidade dos países atendidos. Esse risco é do negócio, não do código, mas deve ser considerado em features que armazenam histórico de terceiros.

## Anthropic (classificação de gênero)

- Arquivo: [server/gender.ts](../server/gender.ts). Modelo `claude-haiku-5-5`, chamado via HTTP direto (sem SDK).
- Uma chamada por lista, só com os usernames que ainda não estão em `followcatch.gender`. O resultado é permanente.
- `thinking: { type: "disabled" }` é obrigatório: com thinking ligado (padrão do Haiku 5.5), o `max_tokens` é consumido e a resposta vem vazia.
- `max_tokens` = mínimo de 4096 e 128 + 12 por pessoa.
- A resposta é um objeto JSON indexado (`{"0":"f"}`), não um array: um array posicional desalinhou na prática.
- A resposta HTTP espera no máximo 4 s. O que não chegar vira "other" e é gravado em segundo plano (ver risco R6 em [cost-strategy.md](cost-strategy.md)).
- Autenticação: `ANTHROPIC_API_KEY`.
- Preço por token: conferir a tabela atual da Anthropic. No volume atual, é uma fração de centavo por lista.

## Stripe (pagamento ativo)

- Arquivo: [server/stripe.ts](../server/stripe.ts). Assinatura com Payment Element embutido na página `/checkout`.
- Fluxo: o backend cria Customer e Subscription (`default_incomplete`), devolve o `client_secret` da primeira fatura, o front confirma com `stripe.confirmPayment`, e o webhook assinado mais `/api/welcome` mantêm `followcatch.subscriptions` atualizado.
- Catálogo identificado por `lookup_key`: `premium_weekly`, `premium_quarterly`, `starter_weekly`, `starter_quarterly`.
- Portal do cliente para cancelar e trocar cartão (`STRIPE_PORTAL_CONFIG`).
- Tarifa: ver a estimativa em [cost-strategy.md](cost-strategy.md#3-receita-por-plano-e-quanto-podemos-gastar).
- Variáveis: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY`.

## PaymentKit (desligado)

- Arquivo: [server/billing.ts](../server/billing.ts). Primeiro provedor de pagamento; substituído pelo Stripe direto (ver [decisions.md](decisions.md)).
- Ativado só com `PAYMENT_PROVIDER=paymentkit` no servidor e `VITE_PAYMENT_PROVIDER=paymentkit` no front.

## Resend (e-mail)

- Usado para o e-mail de redefinição de senha ([server/auth.ts](../server/auth.ts)). Limite de 3 pedidos por hora.
- Variáveis: `RESEND_API_KEY`, `EMAIL_FROM`.

## Vercel e Supabase (infraestrutura)

- **Vercel:** front estático e uma única função Node (`api/index.ts`) com `maxDuration` de 120 s. O proxy de imagem (`/api/img`) usa o CDN da Vercel como cache.
- **Supabase (Postgres):** banco compartilhado com outros projetos; o FollowCatch usa só o schema `followcatch`. Conexão via pooler de transação.
