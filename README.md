# FollowCatch

SaaS por assinatura que mostra a atividade recente de contas públicas do Instagram: quem a conta começou a seguir e quem começou a segui-la, separados por gênero. Visitantes veem uma prévia; assinantes veem tudo.

- Repositório: https://github.com/Gusdev06/followcatch
- Produção: https://followcatch.vercel.app
- Admin: `/admin`, protegido por `ADMIN_KEY` no servidor.

Stack: React e Vite no front, API Hono, Postgres (schema `followcatch`), dados do Instagram via Apify, gênero via Claude Haiku, pagamento via Stripe, deploy na Vercel.

> **Custo importa.** Cada consulta nova a um perfil custa dinheiro real em coleta de dados (cerca de US$ 0,045). Antes de criar ou mudar uma feature, leia [docs/cost-strategy.md](docs/cost-strategy.md).

## Desenvolvimento e validação

```sh
npm ci
npm run dev     # front (Vite) + API em http://localhost:8787
npm test
npm run build
```

- Use Node 22 ou superior (produção: Node 24).
- Credenciais ficam no `.env` local e nas variáveis da Vercel, nunca no Git. Lista de variáveis em [docs/architecture.md](docs/architecture.md#variáveis-de-ambiente).
- Com `.env` de produção, `npm run dev` **gasta créditos reais** e grava no banco de produção. Para trabalhar só na interface, abra qualquer página com `?mock=1`.
- `npm test` usa PostgreSQL em memória (PGlite), sem carregar `.env`, acessar produção ou chamar provedores externos.
- O banco usa somente o schema `followcatch`. Migrações idempotentes, protegidas por advisory lock, rodam no primeiro acesso ao banco.

## Documentação

| Documento | Conteúdo |
|---|---|
| [AGENTS.md](AGENTS.md) | Guia para IAs (e um bom resumo para humanos): regras, mapa do código, armadilhas. |
| [docs/product.md](docs/product.md) | Proposta, planos, funil, o que existe e o que está prometido. |
| [docs/cost-strategy.md](docs/cost-strategy.md) | Custos, riscos e táticas para escalar com margem. |
| [docs/providers.md](docs/providers.md) | Apify, Anthropic, Stripe, Resend: como são usados e quanto custam. |
| [docs/architecture.md](docs/architecture.md) | Fluxo das requisições, tabelas, rotas, variáveis de ambiente. |
| [docs/decisions.md](docs/decisions.md) | Decisões e seus motivos. |
| [docs/roadmap.md](docs/roadmap.md) | O que falta e ideias, com estratégia de custo. |
| [docs/features/](docs/features/) | Uma especificação por feature, a partir do [template](docs/features/_template.md). |

A documentação é atualizada na mesma mudança que altera o comportamento. As regras estão no fim do [AGENTS.md](AGENTS.md#manter-esta-documentação-viva).
