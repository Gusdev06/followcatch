import { after, before, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

// Funil e ao vivo do /admin. Postgres em memória; nada sai da máquina.
process.env.DATABASE_URL = 'postgres://test.invalid/followcatch';
process.env.ADMIN_KEY = 'test-admin-key-with-32-characters';
process.env.SESSION_SECRET = 'test-session-secret-not-for-production';
process.env.APP_URL = 'https://example.test';
const db = new PGlite();
mock.method(pg.Pool.prototype, 'query', async (sql, params = []) => {
  if (sql.includes('CREATE SCHEMA')) {
    await db.exec(sql);
    return { rows: [] };
  }
  return db.query(sql, params);
});
const { migrate } = await import('../server/db.ts');
const { app } = await import('../server/app.ts');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Instagram';
const LEAD = 'lead-aaaa-1111';
const post = (path, body, headers = {}) => app.request(`https://example.test${path}`, {
  method: 'POST', body: JSON.stringify(body),
  headers: { 'user-agent': UA, 'content-type': 'text/plain', 'x-forwarded-for': '203.0.113.9', 'x-vercel-ip-country': 'US', 'x-vercel-ip-city': 'New%20York', ...headers },
});
const admin = async (path) => {
  const r = await app.request(`https://example.test${path}`, { headers: { 'x-admin-key': process.env.ADMIN_KEY } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control'), /no-store/);
  return r.json();
};
const count = async (table) => (await db.query(`SELECT count(*)::int AS n FROM followcatch.${table}`)).rows[0].n;

before(async () => {
  await db.waitReady;
  await migrate();
  mock.method(globalThis, 'fetch', async () => { throw new Error('Network is forbidden in this test'); });
});
beforeEach(async () => {
  await db.exec(`DELETE FROM followcatch.funnel_events; DELETE FROM followcatch.live_sessions; DELETE FROM followcatch.checkouts; DELETE FROM followcatch.users;`);
});
after(async () => { await db.close(); });

test('etapa válida grava país, aparelho e UTM', async () => {
  const r = await post('/api/track', { leadId: LEAD, step: 'landing', tracking: { utm_content: 'img|123', evil: 'x' } });
  assert.equal(r.status, 204);
  const { rows } = await db.query('SELECT * FROM followcatch.funnel_events');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].country, 'US');
  assert.equal(rows[0].meta.device, 'iPhone · Instagram');
  assert.equal(rows[0].meta.utm_content, 'img|123');
  assert.equal(rows[0].meta.evil, undefined);
});

test('robô, etapa desconhecida, id inválido e corpo gigante não gravam', async () => {
  await post('/api/track', { leadId: LEAD, step: 'landing' }, { 'user-agent': 'facebookexternalhit/1.1' });
  await post('/api/track', { leadId: LEAD, step: 'inventada' });
  await post('/api/track', { leadId: 'x', step: 'landing' });
  await post('/api/track', { leadId: LEAD, step: 'landing', tracking: { utm_term: 'x'.repeat(3000) } });
  await post('/api/live', { leadId: 'x' });
  assert.equal(await count('funnel_events'), 0);
  assert.equal(await count('live_sessions'), 0);
});

test('funil conta visitante único por etapa e compra só com checkout concluído', async () => {
  await db.query(`INSERT INTO followcatch.users (id, email, password_hash) VALUES ('u1', 'a@b.test', 'x'), ('u2', 'c@d.test', 'x')`);
  await db.query(`INSERT INTO followcatch.users (id, email, password_hash) VALUES ('u3', 'antigo@b.test', 'x')`);
  await db.query(`INSERT INTO followcatch.checkouts (ref, user_id, plan, cycle, completed_at) VALUES ('c3', 'u3', 'premium', 'weekly', now() - interval '20 days')`);
  const ev = async (lead, step, user = null, ad = null) => db.query(
    `INSERT INTO followcatch.funnel_events (lead_id, step, user_id, country, meta) VALUES ($1, $2, $3, 'US', $4::jsonb)`,
    [lead, step, user, JSON.stringify(ad ? { utm_content: ad, device: 'iPhone · Instagram' } : { device: 'Mac · Chrome' })],
  );
  await ev('lead-comprou', 'landing', null, 'img|1');
  await ev('lead-comprou', 'landing');
  await ev('lead-comprou', 'checkout', 'u1');
  await ev('lead-so-abriu', 'checkout', 'u2');
  await ev('lead-so-viu', 'landing');
  await ev('lead-comprador-antigo', 'landing', 'u3');
  await db.query(`INSERT INTO followcatch.checkouts (ref, user_id, plan, cycle, completed_at) VALUES ('c1', 'u1', 'premium', 'weekly', now() + interval '1 second'), ('c2', 'u2', 'premium', 'weekly', NULL)`);

  const f = await admin('/api/admin/funnel?range=7d');
  assert.equal(f.visitors, 4);
  assert.equal(f.steps.find((s) => s.key === 'landing').n, 3);
  assert.equal(f.steps.find((s) => s.key === 'checkout').n, 2);
  assert.equal(f.buyers, 1);
  assert.equal(f.byAd.find((c) => c.key === 'img|1').buyers, 1);

  const v = await admin('/api/admin/visitors?range=today');
  assert.equal(v.total, 4);
  assert.equal(v.people.find((p) => p.leadId === 'lead-comprador-antigo').buyer, false);
  assert.equal(v.bought, 1);
  assert.equal(v.people.find((p) => p.leadId === 'lead-so-abriu').email, 'c@d.test');
  assert.equal(v.people.find((p) => p.leadId === 'lead-comprou').furthest, 'Checkout');
});

test('batimento atualiza a mesma linha, guarda a 1ª campanha e nunca o IP', async () => {
  await post('/api/live', { leadId: LEAD, step: 'landing', tracking: { utm_campaign: 'camp|1' } });
  await post('/api/live', { leadId: LEAD, step: 'plans', tracking: { utm_campaign: 'outra|2' } });
  assert.equal(await count('live_sessions'), 1);
  const l = await admin('/api/admin/live?h=2');
  assert.equal(l.sessions.length, 1);
  const s = l.sessions[0];
  assert.equal(s.step, 'plans');
  assert.equal(s.campaign, 'camp|1');
  assert.equal(s.city, 'New York');
  assert.equal(s.beats, 2);
  assert.ok(!JSON.stringify(l).includes('203.0.113.9'));
  const { rows } = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'followcatch' AND table_name IN ('live_sessions', 'funnel_events')`);
  assert.ok(!rows.some((r) => r.column_name === 'ip'));
});

test('leitura exige a chave de admin', async () => {
  for (const p of ['funnel', 'visitors', 'live']) {
    assert.equal((await app.request(`https://example.test/api/admin/${p}`)).status, 401);
  }
});
