# Roadmap e ideias

Backlog de features, cada uma com a estratégia de custo esperada. Antes de implementar qualquer item, crie o documento em [features/](features/) a partir do [template](features/_template.md) e faça a análise completa. Os custos abaixo são estimativas de partida, não compromissos.

Táticas citadas (T1 a T16) estão no catálogo de [cost-strategy.md](cost-strategy.md#6-catálogo-de-táticas).

## Agora: entregar o que já é vendido

### 1. Contas monitoradas

Assinante escolhe quais @ acompanhar (Starter: 2; Premium: hoje o site diz "Unlimited" e ainda não tem número; **ideia salva em 2026-11-04: 20 contas**, a decidir quando esta feature for construída). É a base dos alertas.

- **Custo:** nenhum por si só; define quantos alvos os jobs vão coletar.
- **Estratégia:** tabela de alvos monitorados **por @**, com a lista de assinantes que seguem cada alvo (T6). Cota de uso justo para o Premium, por exemplo 10 a 20 contas, a definir com a análise de custo.

### 2. Novos following e followers e alertas de unfollow

Detectar mudanças entre coletas e avisar por e-mail ou no dashboard.

- **Custo ingênuo:** coletar as duas listas de cada alvo todo dia dá cerca de US$ 0,32 por alvo por semana. Dois alvos consomem cerca de 8% do líquido de um Starter trimestral.
- **Estratégia:**
  - Sonda diária barata com o perfil (US$ 0,0026): só coletar a lista cuja contagem mudou (T4).
  - Guardar snapshot e comparar (T11). "Novos" aparecem na cabeça da lista porque a ordem é de recência, então 25 itens costumam bastar. Novos follows podem levar algum tempo para aparecer no provedor (ver [providers.md](providers.md)); medir antes de prometer alertas "em tempo real".
  - **Unfollow é o caso caro:** quem deixou de seguir pode estar em qualquer posição. Opções: detectar só dentro dos 25 mais recentes (barato, incompleto); usar a queda na contagem como sinal e fazer varredura maior só quando necessário; ou limitar a contas pequenas. Decidir com números reais.
  - Frequência adaptativa (T8), lote de perfis por run (T7), execução em cron ou fila (T12), deduplicação por alvo (T6).
- **Pré-requisito:** medir a taxa de mudança real das contas para calibrar.

### 3. Story viewer

Ver stories públicos sem aparecer como visualizador.

- **Custo:** desconhecido; depende do actor de stories escolhido. Pesquisar preço e confiabilidade.
- **Estratégia:** sob demanda (T5), só quando o assinante abre; cache curto, porque stories expiram em 24 h; só Premium; cota diária.

## Próximo: reduzir custo das features existentes

Ver riscos R1 a R9 em [cost-strategy.md](cost-strategy.md#5-vazamentos-e-riscos-conhecidos). Os de maior impacto:

- ~~Prévia mais barata para visitantes (R1)~~: feito em 2026-11-04 (lista da outra aba só no clique). Uma prévia ainda menor só com teste A/B, quando houver tráfego.
- ~~Cotas por plano (R2) e orçamentos separados (R3).~~ Feito em 2026-11-04. Faltam o texto do plano no site e os termos de uso justo.
- **Captcha antes do primeiro run pago (R4). Salvo para depois (decisão de 2026-11-04).** Plano: Cloudflare Turnstile (grátis, invisível). Precisa de uma conta e de chaves do Leandro (site key no front, secret key no servidor). O visitante resolve o desafio uma vez e recebe um cookie assinado; `gate()` exige esse cookie antes do primeiro run pago do visitante. Prioridade sobe quando começar tráfego pago ou o balde dos visitantes esgotar sem razão aparente.
- ~~Medir cache hit e custo por assinante (R8) e uma aba "Custos" no admin.~~ Feito em 2026-11-04.

## Ideias (sem prioridade)

| Ideia | Dado necessário | Estratégia de custo provável |
|---|---|---|
| Histórico de crescimento (gráfico de seguidores, seguindo, posts) | Contagens do perfil | Quase de graça se reaproveitar as sondas do monitoramento (T4). Gravar contagens a cada coleta de perfil. |
| Mudanças de perfil (bio, foto, nome, privado ou público) | Perfil | Mesmo caso: comparar com o snapshot anterior, sem coleta extra. |
| Seguidores em comum entre dois @ | Duas listas | Só os 25 mais recentes de cada; reaproveitar cache (T1). Cobrar como recurso Premium. |
| Engajamento e posts recentes | Actor de posts | Custo novo por post; sob demanda (T5), cache longo, só Premium. |
| Quem mais curte ou comenta | Actors de comentários e curtidas | Caro por natureza (muitos itens). Só com limite rígido de posts analisados e de uso. |
| Análise de audiência (idioma, país, bots) | Listas já coletadas + IA | Reaproveita os dados; IA barata em lote com cache permanente por username (T13, T14). |
| Relatório semanal por e-mail | Snapshots do monitoramento | Sem coleta extra; só e-mail. |
| Comparação de concorrentes (para pequenos negócios) | Perfis e listas | Pode justificar um plano mais caro. Analisar como produto separado. |
| API ou acesso para agências | Tudo que já existe | Precificar por consulta com margem sobre o custo unitário. |
