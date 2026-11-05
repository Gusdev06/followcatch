# Painel admin: cadastros e consultas

**Estado:** no ar desde 2026-11-04 (aba Consultas); 2026-10-17 (Cadastros)
**Planos:** interno
**Atualizado em:** 2026-11-04

## Comportamento

`/admin` é protegido por `ADMIN_KEY` no servidor e só faz leitura.

- **Cadastros:** contas, assinaturas e exportação CSV.
- **Consultas:** cada consulta de perfil, com ou sem login: visitante ou conta, perfil consultado, horário e resultado. Inclui repetições, respostas de cache e tentativas que falham. Atualiza a cada 30 segundos; filtros e paginação ficam no servidor.

## Dados e privacidade

Visitantes novos recebem um identificador aleatório no cookie `fc_visitor` (HttpOnly, SameSite=Lax, Secure em HTTPS). Isso identifica um navegador, não uma pessoa. E-mail só aparece quando a consulta tem uma sessão autenticada. O novo log não armazena IP nem user agent.

`GET /api/profile` grava em `search_events` antes de buscar o perfil e atualiza o resultado depois. As chamadas de `following` e `followers` fazem parte da consulta e não geram eventos adicionais. Falha no registro gera log, mas não derruba a busca. Requisições interrompidas podem permanecer com resultado "Iniciada".

A migração recupera uma única vez o histórico disponível em `searches` e `user_searches`. Esses registros aparecem como antigos: são parciais, podem agrupar por IP, nem sempre identificam login ou resultado e não permitem reconstruir todas as repetições ou cache hits antigos. A API não expõe IPs crus.

## API

`GET /api/admin/searches?page=1&kind=all&q=` exige `x-admin-key`; aceita `kind=anonymous|registered|all` e retorna 50 registros por página. Consultas e admin usam `Cache-Control: private, no-store`.

## Custo

Nenhuma chamada paga: só leitura e escrita no Postgres. Uma linha em `search_events` por consulta de perfil.

O registro ainda não diz se a consulta foi atendida por cache ou gerou run pago. Acrescentar isso resolve o risco R8 de [cost-strategy.md](../cost-strategy.md#5-vazamentos-e-riscos-conhecidos).

## Implementação

[server/search-activity.ts](../../server/search-activity.ts), [server/admin.ts](../../server/admin.ts), [src/pages/Admin.tsx](../../src/pages/Admin.tsx), [src/pages/AdminSearches.tsx](../../src/pages/AdminSearches.tsx), teste em [tests/search-activity.test.mjs](../../tests/search-activity.test.mjs).
