// Painel interno (/admin): quem se cadastrou, plano e uso. Protegido por ADMIN_KEY
// (header x-admin-key). Só leitura, só o schema followcatch.
import { timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { q } from "./db.js";
import { ApiErr } from "./service.js";

export function requireAdmin(c: Context) {
  const want = process.env.ADMIN_KEY ?? "";
  const got = c.req.header("x-admin-key") ?? "";
  const ok = want.length >= 16 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  if (!ok) throw new ApiErr("unauthorized", 401, "Chave de admin inválida.");
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
