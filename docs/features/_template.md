# Nome da feature

> Copie este arquivo para `docs/features/<nome-curto>.md`. Preencha **antes** de implementar; atualize quando mudar. Seções sem conteúdo podem ser apagadas, menos **Custo**.

**Estado:** ideia | em análise | em desenvolvimento | no ar | descontinuada
**Planos:** visitante | Starter | Premium
**Atualizado em:** AAAA-MM-DD

## Problema e valor

Qual problema do cliente resolve e por que alguém pagaria por isso. Qual métrica deve mudar (conversão, retenção, ticket).

## Comportamento

O que o usuário vê e faz. Casos de erro (perfil privado, inexistente, cota esgotada, provedor fora).

## Dados

Quais dados são necessários, de qual provedor ou actor, e se já existem no cache ou em outra tabela.

## Custo

Obrigatório. Veja [cost-strategy.md](../cost-strategy.md).

| Chamada paga | Custo unitário | Chamadas por usuário por semana (típico / pior caso) | Custo por usuário por semana |
|---|---|---|---|
| | | | |

- **Custo por usuário por semana ÷ líquido do plano:** __%. Somado às features existentes: __%. Meta: até 15%.
- **Compartilhamento:** o dado serve a vários usuários? Chave de cache e TTL:
- **Táticas usadas** (T1 a T16) e por quê:
- **Alternativas descartadas** e quanto custariam:
- **Síncrono ou assíncrono:**
- **Cota por plano e comportamento ao esgotar:**
- **Visitante anônimo pode disparar o gasto?** Com que proteção:
- **Teto por run (`maxTotalChargeUsd`):**
- **Como medir depois do lançamento:**

## Implementação

Arquivos, rotas, tabelas e migrações. Toda chamada paga passa por cache, deduplicação, `gate()`, run e `logRun()`.

## Decisões em aberto

Perguntas para o dono do produto antes ou durante a implementação.
