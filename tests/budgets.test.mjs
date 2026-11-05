import { after, before, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

// Orçamentos e cotas (etapa 2 de docs/cost-strategy.md). Postgres real em memória; nada de .env,
// produção ou provedor pago.
process.env.DATABASE_URL = 'postgres://test.invalid/followcatch';
process.env.SESSION_SECRET = 'test-session-secret-not-for-production';
process.env.MAX_DAILY_USD = '10';
process.env.VISITOR_DAILY_USD = '0.1';
process.env.FREE_SEARCHES_PER_IP = '2';
process.env.SUBSCRIBER_SEARCHES_PER_DAY = '100';
process.env.SUBSCRIBER_WEEKLY_STARTER = '5';
process.env.SUBSCRIBER_WEEKLY_PREMIUM = '8';

const db = new PGlite();
mock.method(pg.Pool.prototype, 'query', async (sql, params = []) => {
  if (sql.includes('CREATE SCHEMA')) {
    await db.exec(sql);
    return { rows: [] };
  }
  return db.query(sql, params);
});
const { migrate } = await import('../server/db.ts');
const { gate, ApiErr } = await import('../server/service.ts');
const { logRun, spentToday, searchesThisWeek } = await import('../server/cache.ts');

const starter = { ip: '1.1.1.1', subscriberId: 'u-starter', plan: 'starter' };
const premium = { ip: '1.1.1.2', subscriberId: 'u-premium', plan: 'premium' };
const visitor = (n = 1) => ({ ip: `9.9.9.${n}`, subscriberId: null });

const blocked = async (promise, pattern) => {
  await assert.rejects(promise, (e) => {
    assert.ok(e instanceof ApiErr, String(e));
    assert.equal(e.code, 'rate_limited');
    assert.equal(e.status, 429);
    assert.match(e.message, pattern);
    return true;
  });
};
// n buscas de dias anteriores da semana atual (ou de hoje, se hoje for segunda).
const seedWeek = (who, n, offsetDays = 0) =>
  db.query(
    `INSERT INTO followcatch.searches (who, day, username)
     SELECT $1, date_trunc('week', now() AT TIME ZONE 'UTC')::date + $3::int, 'old' || g FROM generate_series(1, $2::int) g`,
    [who, n, offsetDays],
  );

before(async () => {
  await db.waitReady;
  await migrate();
  mock.method(globalThis, 'fetch', async () => { throw new Error('Network is forbidden in this test'); });
  mock.method(console, 'error', () => {});
});
beforeEach(async () => {
  await db.exec('TRUNCATE followcatch.searches, followcatch.runs RESTART IDENTITY CASCADE');
});
after(async () => { mock.restoreAll(); await db.close(); });

test('cota semanal do Starter: bloqueia o @ novo depois do limite, com mensagem de segunda-feira', async () => {
  await seedWeek('user:u-starter', 5);
  assert.equal(await searchesThisWeek('user:u-starter'), 5);
  await blocked(gate('following', 'alvo', starter), /Weekly .*\(5 new profiles per week.*Monday/);
});

test('o Premium tem cota maior que o Starter, na mesma semana', async () => {
  await seedWeek('user:u-premium', 5);
  await gate('following', 'alvo', premium); // 6º de 8: passa (o Starter já estaria bloqueado em 5)
  await db.query(`INSERT INTO followcatch.searches (who, day, username) SELECT 'user:u-premium', (now() AT TIME ZONE 'UTC')::date, 'x' || g FROM generate_series(1, 2) g`);
  await blocked(gate('following', 'outro', premium), /Weekly .*\(8 new profiles/);
});

test('buscas da semana passada não contam', async () => {
  await seedWeek('user:u-starter', 5, -7);
  assert.equal(await searchesThisWeek('user:u-starter'), 0);
  await gate('following', 'alvo', starter);
});

test('repetir um @ já contado hoje não gasta cota', async () => {
  await seedWeek('user:u-starter', 4);
  await gate('profile', 'alvo', starter); // 5º: passa e registra
  await gate('following', 'alvo', starter); // mesmo @, mesmo dia: livre
  await gate('followers', 'alvo', starter);
  assert.equal(await searchesThisWeek('user:u-starter'), 5);
  await blocked(gate('profile', 'novo', starter), /Weekly/);
});

test('cota diária do assinante', async () => {
  process.env.SUBSCRIBER_SEARCHES_PER_DAY = '2';
  try {
    await gate('profile', 'a', starter);
    await gate('profile', 'b', starter);
    await blocked(gate('profile', 'c', starter), /Daily .*\(2 new profiles per day/);
  } finally {
    process.env.SUBSCRIBER_SEARCHES_PER_DAY = '100';
  }
});

test('balde dos visitantes esgotado bloqueia visitante, mas nunca o assinante', async () => {
  await logRun({ actor: 'a', username: 'x', itens: 25, custo: 0.1, ms: 1, ok: true, who: 'ip:9.9.9.1', bucket: 'visitor' });
  assert.equal((await spentToday('visitor')).usd, 0.1);
  await blocked(gate('profile', 'alvo', visitor()), /Free searches are at capacity/);
  await gate('profile', 'alvo', starter);
  await gate('following', 'alvo', premium);
});

test('visitante dentro do balde ainda respeita a cota por IP', async () => {
  const v = visitor(2);
  await gate('profile', 'a', v);
  await gate('profile', 'b', v);
  await blocked(gate('profile', 'c', v), /Free search limit reached \(2 per day\)/);
  await gate('profile', 'a', v); // @ já contado hoje continua livre
});

test('disjuntor global bloqueia todo mundo, inclusive assinante, e avisa no log', async () => {
  await logRun({ actor: 'a', username: 'x', itens: 1, custo: 10, ms: 1, ok: true, who: 'user:outro', bucket: 'subscriber' });
  await blocked(gate('profile', 'alvo', starter), /at capacity for today/);
  await blocked(gate('profile', 'alvo', visitor(3)), /at capacity for today/);
  assert.ok(console.error.mock.calls.some((c) => String(c.arguments[0]).includes('[ALERTA] disjuntor global')));
});

test('o gasto fica atribuído a quem gerou (who e bucket) e o total soma tudo', async () => {
  await logRun({ actor: 'a', username: 'x', itens: 1, custo: 0.03, ms: 1, ok: true, who: 'user:u1', bucket: 'subscriber' });
  await logRun({ actor: 'a', username: 'y', itens: 1, custo: 0.02, ms: 1, ok: true, who: 'ip:9.9.9.9', bucket: 'visitor' });
  await logRun({ actor: 'a', username: 'z', itens: 1, custo: 0.01, ms: 1, ok: true }); // antigo, sem dono
  assert.equal((await spentToday('subscriber')).usd, 0.03);
  assert.equal((await spentToday('visitor')).usd, 0.02);
  assert.ok(Math.abs((await spentToday()).usd - 0.06) < 1e-9);
});
