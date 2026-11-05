# Busca de perfil, listas e prévia

**Estado:** no ar
**Planos:** visitante (prévia) | Starter e Premium (completo)
**Atualizado em:** 2026-11-04

## Problema e valor

É o núcleo do produto e do funil: a pessoa digita um @ e vê o perfil e a atividade recente. Para o visitante, a prévia bloqueada é o gancho da assinatura; para o assinante, é a funcionalidade principal.

## Comportamento

- O usuário digita o @ (aceita `@nome`, `nome` ou a URL do perfil; ver `normalizeUsername`).
- O perfil aparece completo para todos: foto, bio, contagens, verificado, perfis parecidos.
- Se o perfil é público, aparecem duas abas: **Recent Followers** e **Recent Following**, agrupadas por gênero. **Só a aba aberta é coletada** (Following, a padrão, carrega durante a animação); a outra só carrega quando a pessoa clica nela.
- **Visitante e conta sem assinatura:** um item real por gênero (o mais recente de cada), os demais bloqueados e sem dados.
- **Assinante:** os 25 mais recentes de cada lista, completos.
- O loading dura pelo menos 6 s, mesmo com cache, por ritmo do funil (`src/pages/Search.tsx`).
- Erros: `invalid` (400), `not_found` (404), `private` (403 nas listas; o perfil volta 200 com `private: true`), `rate_limited` (429: cota diária ou semanal, balde dos visitantes ou disjuntor global), `provider_error` (502).

## Dados

| Dado | Fonte | Cache |
|---|---|---|
| Perfil | Apify `instagram-profile-scraper` | `profile:@`, 24 h; privado ou inexistente, 1 h |
| Following | Apify `scraping_solutions` (25) | `following:@`, 6 h; vazio não é cacheado |
| Followers | Apify `scraping_solutions` (25) | `followers:@`, 6 h; vazio não é cacheado |
| Gênero | Claude Haiku | Tabela `gender`, permanente |

## Custo

| Chamada paga | Custo unitário | Quando |
|---|---|---|
| Perfil | US$ 0,0026 | Todo @ novo (cache miss) |
| Following | cerca de US$ 0,021 | Todo @ público novo (aba padrão, coletada junto com o perfil) |
| Followers | cerca de US$ 0,021 | Só se a pessoa abrir a aba |
| Gênero | Fração de centavo | Só usernames ainda sem gênero |

- Consulta nova completa: cerca de US$ 0,045 (plano Free da Apify), mas cerca de **US$ 0,024** para quem só olha uma aba. Consulta repetida no TTL: zero.
- Lista vazia de um perfil que tem seguidores (a Apify já devolveu "sucesso" com 0 itens) é tratada como falha do provedor: erro 502, sem cache, e a cota é devolvida.
- Táticas usadas: T1 (cache por alvo), T2 (cache negativo), T3 (deduplicação em voo, por instância), T9 (cotas por plano, balde dos visitantes e disjuntor global), T10 (teto por run), T13 e T14 (gênero).
- **Problemas conhecidos:** a primeira lista ainda é coletada para o visitante (R1, reduzido); cota de assinante por @ e por dia, não por coleta (R10), e falha que consome cota (R11). Ver [cost-strategy.md](../cost-strategy.md#5-vazamentos-e-riscos-conhecidos).

## Implementação

- Rotas: `GET /api/profile`, `/api/following`, `/api/followers`, `/api/gender` em [server/app.ts](../../server/app.ts).
- Regras: [server/service.ts](../../server/service.ts) (`getProfile`, `getList`, `gate`, `teaser`).
- Provedor: [server/providers/apify.ts](../../server/providers/apify.ts).
- Front: [src/components/funnel/useSearch.ts](../../src/components/funnel/useSearch.ts), [Preview.tsx](../../src/components/funnel/Preview.tsx), [src/pages/Search.tsx](../../src/pages/Search.tsx), [src/pages/Dashboard.tsx](../../src/pages/Dashboard.tsx).

## Decisões em aberto

- Qual prévia mínima mantém a conversão com menos custo (R1)?
- Cota de assinante por plano: quantas consultas novas por semana?
