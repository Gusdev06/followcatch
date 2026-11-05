import { after, before, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

// Medição de custo, cota devolvida em falha e lista vazia do provedor. Postgres em memória; a
// Apify é simulada por um fetch falso, então nada paga nem sai da máquina.
process.env.DATABASE_URL = 'postgres://test.invalid/followcatch';
process.env.ADMIN_KEY = 'test-admin-key-with-32-characters';
process.env.SESSION_SECRET = 'test-session-secret-not-for-production';
process.env.APP_URL = 'https://example.test';
process.env.APIFY_TOKEN = 'test-token';
process.env.MAX_DAILY_USD = '10';
process.env.VISITOR_DAILY_USD = '5';
process.env.FREE_SEARCHES_PER_IP = '5';
delete process.env.ANTHROPIC_API_KEY;

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
const { getList, ApiErr } = await import('../server/service.ts');

let apify = () => [];
const apifyCalls = [];
const request = (url, headers = {}) => app.request(`https://example.test${url}`, { headers: { 'x-forwarded-for': '8.8.8.8', ...headers } });
const admin = { 'x-admin-key': process.env.ADMIN_KEY };
const visitor = { ip: '8.8.8.8', subscriberId: null };
const searches = async () => (await db.query('SELECT who, username FROM followcatch.searches ORDER BY username')).rows;
const profileItem = (extra = {}) => ({ id: '1', username: 'alvo', followersCount: 10, followsCount: 5, postsCount: 1, private: false, ...extra });
const seedProfile = (following = 5, followers = 7) =>
  db.query(`INSERT INTO followcatch.kv (key, value, expires_at) VALUES ('profile:alvo', $1, now() + interval '1 day')`, [JSON.stringify({
    status: 'ok',
    profile: { username: 'alvo', fullName: 'Alvo', bio: '', picUrl: '', private: false, verified: false, posts: 1, followers, following, similar: [], fetchedAt: new Date().toISOString() },
  })]);
const listItems = (n) => Array.from({ length: n }, (_, i) => ({ username_scrape: 'alvo', username: `p${i}`, full_name: `P ${i}`, is_private: false, is_verified: false, profile_pic_url: '' }));

before(async () => {
  await db.waitReady;
  await migrate();
  mock.method(console, 'warn', () => {});
  mock.method(console, 'log', () => {});
  mock.method(globalThis, 'fetch', async (url) => {
    const u = String(url);
    assert.ok(u.startsWith('https://api.apify.com/'), `chamada externa inesperada: ${u}`);
    apifyCalls.push(u);
    const body = apify(u);
    return new Response(JSON.stringify(body), { status: Array.isArray(body) ? 201 : 400, headers: { 'content-type': 'application/json' } });
  });
});
beforeEach(async () => {
  apify = () => [];
  apifyCalls.length = 0;
  await db.exec('TRUNCATE followcatch.search_events, followcatch.users, followcatch.kv, followcatch.searches, followcatch.runs, followcatch.checkouts RESTART IDENTITY CASCADE');
});
after(async () => { mock.restoreAll(); await db.close(); });

test('a consulta de perfil registra miss quando coletou e hit quando veio do cache', async () => {
  apify = () => [profileItem()];
  assert.equal((await request('/api/profile?u=alvo')).status, 200);
  assert.equal((await request('/api/profile?u=alvo')).status, 200);
  assert.equal(apifyCalls.length, 1);
  const rows = (await db.query('SELECT cache FROM followcatch.search_events ORDER BY at, id')).rows.map((r) => r.cache).sort();
  assert.deepEqual(rows, ['hit', 'miss']);
  const run = (await db.query('SELECT who, bucket FROM followcatch.runs')).rows;
  assert.deepEqual(run, [{ who: 'ip:8.8.8.8', bucket: 'visitor' }]);
});

test('falha do provedor devolve a cota: o @ não fica contado', async () => {
  apify = () => ({ error: { message: 'actor fora do ar' } });
  const r = await request('/api/profile?u=alvo');
  assert.equal(r.status, 502);
  assert.deepEqual(await searches(), []);
  const [fail] = (await db.query('SELECT ok FROM followcatch.runs')).rows;
  assert.equal(fail.ok, false);
});

test('lista vazia de um perfil que tem gente é erro, não cache nem cota gasta', async () => {
  await seedProfile(5, 7);
  apify = () => [];
  await assert.rejects(getList('following', 'alvo', visitor), (e) => e instanceof ApiErr && e.code === 'provider_error' && e.status === 502);
  assert.deepEqual(await searches(), []);
  assert.equal((await db.query(`SELECT 1 FROM followcatch.kv WHERE key = 'following:alvo'`)).rows.length, 0);
  assert.equal(apifyCalls.length, 3);
});

test('lista vazia ou run recusado é repetido, com prazo curto, até vir resultado', async () => {
  await seedProfile(5, 7);
  const respostas = [{ error: { message: 'status: TIMED-OUT' } }, [], listItems(5)];
  apify = () => respostas.shift();
  assert.equal((await getList('following', 'alvo', visitor)).total, 5);
  assert.equal(apifyCalls.length, 3);
  assert.ok(apifyCalls.every((u) => u.includes('timeout=30&')));
  assert.equal((await searches()).length, 1);
});

test('lista com itens é cacheada e uma segunda leitura não chama a Apify', async () => {
  await seedProfile(5, 7);
  apify = () => listItems(5);
  const first = await getList('following', 'alvo', visitor);
  assert.equal(first.total, 5);
  assert.equal(apifyCalls.length, 1);
  assert.equal((await getList('following', 'alvo', visitor)).total, 5);
  assert.equal(apifyCalls.length, 1);
  assert.equal((await searches()).length, 1);
});

test('perfil com 0 seguindo de verdade continua devolvendo lista vazia', async () => {
  await seedProfile(0, 0);
  apify = () => [];
  assert.equal((await getList('following', 'alvo', visitor)).total, 0);
  assert.equal(apifyCalls.length, 1);
});

test('falha da lista não devolve a cota que o perfil já tinha gasto', async () => {
  apify = (u) => (u.includes('instagram-profile-scraper') ? [profileItem({ followsCount: 5 })] : { error: { message: 'x' } });
  assert.equal((await request('/api/profile?u=alvo')).status, 200);
  assert.equal((await request('/api/following?u=alvo')).status, 502);
  assert.deepEqual((await searches()).map((r) => r.username), ['alvo']);
});

test('/api/admin/costs exige a chave de admin', async () => {
  const r = await request('/api/admin/costs');
  assert.equal(r.status, 401);
});

test('/api/admin/costs soma o gasto por quem gerou, o cache hit e o custo por assinante', async () => {
  await db.exec(`
    INSERT INTO followcatch.users (id, email, password_hash) VALUES ('u1', 'ana@example.test', 'x'), ('u2', 'bia@example.test', 'x');
    INSERT INTO followcatch.subscriptions (user_id, plan, cycle, status) VALUES ('u1', 'premium', 'weekly', 'active'), ('u2', 'starter', 'weekly', 'active');
    INSERT INTO followcatch.checkouts (ref, user_id, plan, cycle, completed_at) VALUES ('c1', 'u1', 'premium', 'weekly', now());
    INSERT INTO followcatch.runs (actor, username, itens, custo_est, ms, ok, who, bucket) VALUES
      ('a', 'x', 25, 0.0213, 100, true, 'ip:1.1.1.1', 'visitor'),
      ('a', 'y', 25, 0.0213, 300, true, 'user:u1', 'subscriber'),
      ('a', 'z', 0, 0, 50, false, 'user:u1', 'subscriber'),
      ('a', 'w', 25, 0.0213, 100, true, 'user:u2', 'subscriber'),
      ('b', 'old', 1, 0.0026, 100, true, NULL, NULL);
    INSERT INTO followcatch.searches (who, day, username) VALUES ('user:u1', (now() AT TIME ZONE 'UTC')::date, 'y'), ('user:u2', (now() AT TIME ZONE 'UTC')::date, 'w');
    INSERT INTO followcatch.search_events (id, visitor_id, username, outcome, cache) VALUES
      ('e1', 'v', 'a', 'success', 'hit'), ('e2', 'v', 'b', 'success', 'hit'), ('e3', 'v', 'c', 'success', 'hit'), ('e4', 'v', 'd', 'success', 'miss'),
      ('e5', 'v', 'e', 'rate_limited', NULL);
  `);
  const r = await request('/api/admin/costs', admin);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control'), /no-store/);
  const d = await r.json();
  assert.ok(Math.abs(d.today.visitorUsd - 0.0213) < 1e-9);
  assert.ok(Math.abs(d.today.subscriberUsd - 0.0426) < 1e-9);
  assert.ok(Math.abs(d.today.unattributedUsd - 0.0026) < 1e-9);
  assert.ok(Math.abs(d.today.totalUsd - 0.0665) < 1e-9);
  assert.equal(d.today.globalLimitUsd, 10);
  assert.equal(d.today.visitorLimitUsd, 5);
  assert.deepEqual([d.cache.hit7d, d.cache.miss7d, d.cache.rate7d], [3, 1, 0.75]); // a consulta sem cache (null) não entra
  assert.equal(d.daily[0].runs, 5);
  assert.equal(d.daily[0].failed, 1);
  const [ana, bia] = d.subscribersThisWeek;
  assert.equal(ana.email, 'ana@example.test');
  assert.deepEqual([ana.plan, ana.runs, ana.failed, ana.quotaUsed, ana.quotaLimit], ['premium', 2, 1, 1, 40]);
  assert.deepEqual([bia.plan, bia.quotaLimit], ['starter', 27]);
  assert.deepEqual(d.byActor.map((a) => a.actor).sort(), ['a', 'b']);
  assert.equal(d.acquisition30d.paidCheckouts, 1);
  assert.ok(Math.abs(d.acquisition30d.visitorUsdPerPaid - 0.0213) < 1e-9);
});
