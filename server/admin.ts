// Painel interno (/admin): quem se cadastrou, plano e uso. Protegido por ADMIN_KEY
// (header x-admin-key). Só leitura, só o schema followcatch.
import { timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { q } from "./db.js";
import { ApiErr } from "./service.js";

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
