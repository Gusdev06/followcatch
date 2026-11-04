import { after, before, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL SQL in memory. Never load .env or contact a provider/production DB.
process.env.DATABASE_URL = 'postgres://test.invalid/followcatch';
process.env.ADMIN_KEY = 'test-admin-key-with-32-characters';
process.env.SESSION_SECRET = 'test-session-secret-not-for-production';
process.env.APP_URL = 'https://example.test';
process.env.MAX_DAILY_USD = '0';
const db = new PGlite();
let ddl;
let failRecording = false;
mock.method(pg.Pool.prototype, 'query', async (sql, params = []) => {
  if (failRecording && sql.startsWith('INSERT INTO followcatch.search_events')) throw new Error('simulated logging failure');
  if (sql.includes('CREATE SCHEMA')) {
    ddl = sql;
    await db.exec(sql);
    return { rows: [] };
  }
  return db.query(sql, params);
});
const { migrate } = await import('../server/db.ts');
const { app } = await import('../server/app.ts');
const adminHeaders = { 'x-admin-key': process.env.ADMIN_KEY };
const request = (url, headers = {}) => app.request(`https://example.test${url}`, { headers });
const activity = async (query = '') => {
  const response = await request(`/api/admin/searches${query}`, adminHeaders);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  return response.json();
};
const seed = async (name = 'nasa', isPrivate = false) => {
  const profile = { username: name, fullName: 'Example', bio: '', picUrl: '', private: isPrivate, verified: false, posts: 1, followers: 1, following: 1, similar: [], fetchedAt: new Date().toISOString() };
  await db.query(`INSERT INTO followcatch.kv (key,value,expires_at) VALUES ($1,$2,now()+interval '1 day')`, [`profile:${name}`, JSON.stringify({ status: 'ok', profile })]);
};

before(async () => {
  await db.waitReady;
  await migrate();
  mock.method(globalThis, 'fetch', async () => { throw new Error('Network is forbidden in this test'); });
});
beforeEach(async () => {
  failRecording = false;
  await db.exec('TRUNCATE followcatch.search_events, followcatch.users, followcatch.kv, followcatch.searches, followcatch.runs RESTART IDENTITY CASCADE');
});
after(async () => { mock.restoreAll(); await db.close(); });

test('admin is protected, including malformed Unicode keys', async () => {
  for (const key of ['', 'wrong', 'é'.repeat(process.env.ADMIN_KEY.length)]) {
    const r = await request('/api/admin/searches', { 'x-admin-key': key });
    assert.equal(r.status, 401);
    assert.equal((await r.json()).error, 'unauthorized');
  }
});

test('anonymous cache hits and repeated searches are recorded with the same visitor', async () => {
  await seed();
  const first = await request('/api/profile?u=@NASA');
  assert.equal(first.status, 200);
  const cookie = first.headers.get('set-cookie');
  assert.match(cookie, /fc_visitor=.*HttpOnly.*Secure.*SameSite=Lax/i);
  const second = await request('/api/profile?u=nasa', { cookie: cookie.split(';')[0] });
  assert.equal(second.status, 200);
  const data = await activity();
  assert.equal(data.total, 2);
  assert.equal(data.summary.anonymous, 2);
  assert.equal(data.summary.visitors, 1);
  assert.equal(data.items[0].email, null);
  assert.equal(data.items[0].username, 'nasa');
  assert.equal(data.items[0].outcome, 'success');
  assert.equal(data.items[0].visitorId, data.items[1].visitorId);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM followcatch.runs')).rows[0].n, 0);
  // The two list requests are part of the same consultation, not two new searches.
  for (const kind of ['following', 'followers']) {
    await db.query(`INSERT INTO followcatch.kv (key,value,expires_at) VALUES ($1,$2,now()+interval '1 day')`, [`${kind}:nasa`, JSON.stringify({ items: [], fetchedAt: new Date().toISOString() })]);
    assert.equal((await request(`/api/${kind}?u=nasa`)).status, 200);
  }
  assert.equal((await activity()).total, 2);
});

test('private, missing and rate-limited profiles remain visible; invalid input is rejected', async () => {
  await seed('private.person', true);
  await db.query(`INSERT INTO followcatch.kv (key,value,expires_at) VALUES ('profile:missing', '{"status":"not_found"}', now()+interval '1 day')`);
  assert.equal((await request('/api/profile?u=private.person')).status, 200);
  assert.equal((await request('/api/profile?u=missing')).status, 404);
  assert.equal((await request('/api/profile?u=uncached')).status, 429);
  assert.equal((await request('/api/profile?u=bad%20username')).status, 400);
  const data = await activity();
  assert.equal(data.total, 3);
  assert.deepEqual(new Set(data.items.map((s) => s.outcome)), new Set(['private', 'not_found', 'rate_limited']));
});

test('logged-in users retain their own history and are separated from anonymous visitors', async () => {
  await seed();
  await request('/api/profile?u=nasa');
  const signup = await app.request('https://example.test/api/auth/signup', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'reader@example.test', password: 'test-password-123' }),
  });
  assert.equal(signup.status, 200);
  const cookie = signup.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/profile?u=nasa', { cookie })).status, 200);
  const registered = await activity('?kind=registered');
  assert.equal(registered.total, 1);
  assert.equal(registered.items[0].email, 'reader@example.test');
  assert.ok(registered.items[0].userId);
  assert.equal((await activity('?kind=anonymous')).total, 1);
  assert.equal((await activity('?q=READER%40example')).total, 1);
  const history = await request('/api/me/searches', { cookie });
  assert.deepEqual((await history.json()).items.map((s) => s.username), ['nasa']);
  const users = await request('/api/admin/users', adminHeaders);
  assert.equal(users.status, 200);
  assert.equal((await users.json()).users[0].searches, 1);
});

test('legacy backfill is idempotent and never copies new rate-limit records again', async () => {
  await db.exec(`
    DELETE FROM followcatch.migrations WHERE id='search_events_legacy_v1';
    INSERT INTO followcatch.users (id,email,password_hash) VALUES ('legacy-user','legacy@example.test','unused');
    INSERT INTO followcatch.searches (who,day,username) VALUES ('ip:192.0.2.1',current_date,'old.anon'), ('user:legacy-user',current_date,'old.user');
    INSERT INTO followcatch.user_searches (user_id,username) VALUES ('legacy-user','old.user'),('legacy-user','cached.user');
  `);
  await db.exec(ddl);
  const data = await activity();
  assert.equal(data.total, 3);
  assert.equal(data.summary.legacy, 3);
  assert.equal(data.summary.anonymous, 1);
  assert.ok(!JSON.stringify(data).includes('192.0.2.1'));
  await db.exec(`INSERT INTO followcatch.searches (who,day,username) VALUES ('ip:192.0.2.2',current_date,'new.after.migration')`);
  await db.exec(ddl);
  assert.equal((await activity()).total, 3);
});

test('pagination and literal search include every record without duplicates', async () => {
  await db.exec(`INSERT INTO followcatch.search_events (id,visitor_id,username,outcome)
    SELECT 'event-' || n,'visitor-' || n,'profile.' || n,'success' FROM generate_series(1, 53) AS n`);
  const first = await activity('?page=1');
  const second = await activity('?page=2');
  assert.equal(first.total, 53);
  assert.equal(first.items.length, 50);
  assert.equal(second.items.length, 3);
  assert.equal(new Set([...first.items, ...second.items].map((i) => i.id)).size, 53);
  assert.equal((await activity('?q=%25')).total, 0);
  assert.equal((await activity('?q=profile.53')).total, 1);
  assert.equal((await activity('?page=NaN')).page, 1);
});

test('a logging failure does not break a successful profile response', async () => {
  await seed();
  failRecording = true;
  const r = await request('/api/profile?u=nasa');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).username, 'nasa');
});
