// Painel interno (/admin): quem se cadastrou, plano e uso. Protegido por ADMIN_KEY
// (header x-admin-key). Só leitura, só o schema followcatch.
import { timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { q } from "./db.js";
import { ApiErr, budgets, weeklyLimit } from "./service.js";

export function requireAdmin(c: Context) {
  const want = process.env.ADMIN_KEY ?? "";
  const got = c.req.header("x-admin-key") ?? "";
  const expected = Buffer.from(want);
  const supplied = Buffer.from(got);
  const ok = want.length >= 16 && supplied.length === expected.length && timingSafeEqual(supplied, expected);
  if (!ok) throw new ApiErr("unauthorized", 401, "Chave de admin inválida.");
}

export async function adminSearches(query: Record<string, string>) {
  const page = Math.min(1_000_000, Math.max(1, Math.floor(Number(query.page) || 1)));
  const pageSize = 50;
  const kind = ["anonymous", "registered"].includes(query.kind) ? query.kind : "all";
  const search = (query.q ?? "").trim().toLowerCase().slice(0, 100);
  const where = `WHERE ($1 = 'all' OR ($1 = 'anonymous' AND e.user_id IS NULL) OR ($1 = 'registered' AND e.user_id IS NOT NULL))
    AND ($2 = '' OR strpos(lower(e.username), $2) > 0 OR strpos(lower(COALESCE(u.email, '')), $2) > 0 OR strpos(lower(e.visitor_id), $2) > 0)`;
  const [rows, count, summary] = await Promise.all([
    q<{ id: string; visitor_id: string; user_id: string | null; email: string | null; username: string; outcome: string; source: string; at: Date }>(`
      SELECT e.*, u.email FROM followcatch.search_events e
      LEFT JOIN followcatch.users u ON u.id = e.user_id
      ${where} ORDER BY e.at DESC, e.id DESC LIMIT $3 OFFSET $4`,
      [kind, search, pageSize, (page - 1) * pageSize]),
    q<{ total: number }>(`SELECT count(*)::int AS total FROM followcatch.search_events e
      LEFT JOIN followcatch.users u ON u.id = e.user_id ${where}`, [kind, search]),
    q<{ total: number; anonymous: number; visitors: number; today: number; legacy: number }>(`
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE user_id IS NULL)::int AS anonymous,
        count(DISTINCT COALESCE('user:' || user_id, visitor_id))::int AS visitors,
        count(*) FILTER (WHERE at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS today,
        count(*) FILTER (WHERE source = 'legacy')::int AS legacy
      FROM followcatch.search_events`),
  ]);
  return {
    generatedAt: new Date().toISOString(), page, pageSize, total: count[0].total,
    summary: summary[0],
    items: rows.map((r) => ({
      id: r.id, visitorId: r.visitor_id, userId: r.user_id, email: r.email,
      username: r.username, outcome: r.outcome, source: r.source, at: new Date(r.at).toISOString(),
    })),
  };
}

type Row = {
  id: string;
  email: string;
  created_at: Date;
  plan: string | null;
  cycle: string | null;
  status: string | null;
  provider: string | null;
  renews_at: Date | null;
  cancel_at_period_end: boolean | null;
  searches: number;
  last_search: Date | null;
  last_username: string | null;
  checkouts: number;
  last_seen: Date | null;
};

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

export async function adminUsers() {
  const rows = await q<Row>(`
    SELECT u.id, u.email, u.created_at,
           s.plan, s.cycle, s.status, s.provider, s.renews_at, s.cancel_at_period_end,
           COALESCE(us.n, 0)::int AS searches, us.last_at AS last_search, us.last_username,
           COALESCE(ck.n, 0)::int AS checkouts,
           se.last_seen
    FROM followcatch.users u
    LEFT JOIN followcatch.subscriptions s ON s.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT count(*) AS n, max(at) AS last_at,
             (SELECT username FROM followcatch.user_searches x WHERE x.user_id = u.id ORDER BY at DESC LIMIT 1) AS last_username
      FROM followcatch.user_searches WHERE user_id = u.id
    ) us ON true
    LEFT JOIN LATERAL (SELECT count(*) AS n FROM followcatch.checkouts WHERE user_id = u.id) ck ON true
    LEFT JOIN LATERAL (SELECT max(created_at) AS last_seen FROM followcatch.sessions WHERE user_id = u.id) se ON true
    ORDER BY u.created_at DESC
  `);
  return {
    generatedAt: new Date().toISOString(),
    users: rows.map((r) => ({
      id: r.id,
      email: r.email,
      createdAt: iso(r.created_at)!,
      plan: r.plan,
      cycle: r.cycle,
      status: r.status ?? "none",
      provider: r.provider,
      renewsAt: iso(r.renews_at),
      cancelAtPeriodEnd: !!r.cancel_at_period_end,
      searches: r.searches,
      lastSearchAt: iso(r.last_search),
      lastUsername: r.last_username,
      checkouts: r.checkouts,
      lastSeenAt: iso(r.last_seen),
    })),
  };
}

// ---- custos ----------------------------------------------------------------

type PlanId = "starter" | "premium";

/**
 * Custo de dados (estimado, não é a fatura da Apify): por dia, por quem gastou, cache hit,
 * custo por assinante na semana e gasto de visitantes por checkout concluído.
 * Tudo em UTC, como os limites. Só leitura.
 */
export async function adminCosts() {
  const num = (v: unknown) => Number(v ?? 0);
  const [today, daily, byActor, cache, weekly, acquisition] = await Promise.all([
    q<{ bucket: string | null; usd: string; runs: number }>(`
      SELECT bucket, COALESCE(SUM(custo_est), 0) AS usd, count(*)::int AS runs FROM followcatch.runs
      WHERE at >= (now() AT TIME ZONE 'UTC')::date GROUP BY bucket`),
    q<{ day: string; bucket: string | null; usd: string; runs: number; failed: number }>(`
      SELECT ((at AT TIME ZONE 'UTC')::date)::text AS day, bucket, COALESCE(SUM(custo_est), 0) AS usd,
             count(*)::int AS runs, count(*) FILTER (WHERE NOT ok)::int AS failed
      FROM followcatch.runs WHERE at >= ((now() AT TIME ZONE 'UTC')::date - 13)
      GROUP BY 1, 2 ORDER BY 1 DESC`),
    q<{ actor: string; runs: number; failed: number; itens: string; usd: string; ms: string }>(`
      SELECT actor, count(*)::int AS runs, count(*) FILTER (WHERE NOT ok)::int AS failed,
             COALESCE(SUM(itens), 0) AS itens, COALESCE(SUM(custo_est), 0) AS usd, COALESCE(AVG(ms), 0) AS ms
      FROM followcatch.runs WHERE at >= now() - interval '30 days' GROUP BY actor ORDER BY usd DESC`),
    q<{ hit: number; miss: number; hit7: number; miss7: number }>(`
      SELECT count(*) FILTER (WHERE cache = 'hit' AND at >= (now() AT TIME ZONE 'UTC')::date)::int AS hit,
             count(*) FILTER (WHERE cache = 'miss' AND at >= (now() AT TIME ZONE 'UTC')::date)::int AS miss,
             count(*) FILTER (WHERE cache = 'hit')::int AS hit7,
             count(*) FILTER (WHERE cache = 'miss')::int AS miss7
      FROM followcatch.search_events WHERE at >= now() - interval '7 days'`),
    q<{ user_id: string; email: string | null; plan: string | null; status: string | null; runs: number; failed: number; usd: string; used: number }>(`
      SELECT substring(r.who from 6) AS user_id, u.email, s.plan, s.status, count(*)::int AS runs,
             count(*) FILTER (WHERE NOT r.ok)::int AS failed, COALESCE(SUM(r.custo_est), 0) AS usd,
             (SELECT count(*)::int FROM followcatch.searches x WHERE x.who = r.who
               AND x.day >= date_trunc('week', now() AT TIME ZONE 'UTC')::date) AS used
      FROM followcatch.runs r
      LEFT JOIN followcatch.users u ON u.id = substring(r.who from 6)
      LEFT JOIN followcatch.subscriptions s ON s.user_id = u.id
      WHERE r.bucket = 'subscriber' AND r.at >= date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      GROUP BY r.who, u.email, s.plan, s.status ORDER BY usd DESC LIMIT 20`),
    q<{ paid: number; visitor_usd: string }>(`
      SELECT (SELECT count(*)::int FROM followcatch.checkouts WHERE completed_at >= now() - interval '30 days') AS paid,
             (SELECT COALESCE(SUM(custo_est), 0) FROM followcatch.runs
               WHERE bucket = 'visitor' AND at >= now() - interval '30 days') AS visitor_usd`),
  ]);

  const spent = (bucket: string | null) => num(today.find((r) => r.bucket === bucket)?.usd);
  const b = budgets();
  const days = new Map<string, { day: string; visitor: number; subscriber: number; unattributed: number; runs: number; failed: number }>();
  for (const r of daily) {
    const d = days.get(r.day) ?? { day: r.day, visitor: 0, subscriber: 0, unattributed: 0, runs: 0, failed: 0 };
    const key = r.bucket === "visitor" ? "visitor" : r.bucket === "subscriber" ? "subscriber" : "unattributed";
    d[key] += num(r.usd);
    d.runs += r.runs;
    d.failed += r.failed;
    days.set(r.day, d);
  }
  const rate = (hit: number, miss: number) => (hit + miss > 0 ? hit / (hit + miss) : null);
  const c = cache[0];
  const subs = weekly.map((r) => {
    const plan = r.plan === "premium" ? "premium" : "starter" as PlanId;
    return {
      userId: r.user_id, email: r.email, plan: r.plan, status: r.status, runs: r.runs, failed: r.failed,
      usd: num(r.usd), quotaUsed: r.used, quotaLimit: weeklyLimit(plan),
    };
  });
  const paid = acquisition[0].paid;
  const visitorUsd30 = num(acquisition[0].visitor_usd);
  return {
    generatedAt: new Date().toISOString(),
    today: {
      totalUsd: spent(null) + spent("visitor") + spent("subscriber"),
      visitorUsd: spent("visitor"), subscriberUsd: spent("subscriber"), unattributedUsd: spent(null),
      globalLimitUsd: b.globalUsd, visitorLimitUsd: b.visitorUsd,
    },
    cache: { hitToday: c.hit, missToday: c.miss, rateToday: rate(c.hit, c.miss), hit7d: c.hit7, miss7d: c.miss7, rate7d: rate(c.hit7, c.miss7) },
    daily: [...days.values()],
    byActor: byActor.map((r) => ({ actor: r.actor, runs: r.runs, failed: r.failed, items: num(r.itens), usd: num(r.usd), avgMs: Math.round(num(r.ms)) })),
    subscribersThisWeek: subs,
    acquisition30d: { visitorUsd: visitorUsd30, paidCheckouts: paid, visitorUsdPerPaid: paid > 0 ? visitorUsd30 / paid : null },
  };
}
