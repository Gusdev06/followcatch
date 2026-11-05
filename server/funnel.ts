// Funil, visitantes e ao vivo do /admin, no molde do painel do The Kingdom of Love.
// O navegador manda etapas (/api/track) e batimentos (/api/live). Sem IP: o AGENTS.md proíbe IP cru
// na API, então só país, região e cidade dos headers da Vercel. Sem provedor pago.
import type { Context } from "hono";
import { currentUser } from "./auth.js";
import { q } from "./db.js";

export const STEPS = [
  ["landing", "Landing"],
  ["search", "Busca"],
  ["preview", "Prévia"],
  ["plans", "Planos"],
  ["signup", "Cadastro"],
  ["checkout", "Checkout"],
  ["pay_click", "Clicou em pagar"],
] as const;
/** Fora da linha principal do funil, mas aparecem no ao vivo. */
const EXTRA_STEPS = ["app", "welcome", "login"];
const ALL_STEPS = new Set<string>([...STEPS.map(([k]) => k), ...EXTRA_STEPS]);

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|facebot|meta-externalagent|headlesschrome|lighthouse|phantomjs|puppeteer|playwright|selenium|preview|scrapy|python-requests|curl|wget/i;
const LEAD_RE = /^[a-z0-9-]{8,64}$/i;
const META_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const MAX_BODY = 2000;
const LIVE_RETENTION_DAYS = 7;
/** Teto de eventos lidos por relatório: o período "tudo" não pode derrubar a função. */
const MAX_EVENTS = 200_000;
const MAX_PEOPLE = 500;

/** Gusta está em Bali: "hoje" e os horários do painel são em UTC+8. */
const TZ_OFFSET_H = 8;
export const RANGES = { today: -1, "24h": 1, "7d": 7, "30d": 30, all: 0 } as const;
export type Range = keyof typeof RANGES;

const cut = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

function deviceOf(ua: string) {
  const os = /iphone|ipad|ipod/i.test(ua) ? "iPhone" : /android/i.test(ua) ? "Android" : /mobile/i.test(ua) ? "Mobile" : /macintosh/i.test(ua) ? "Mac" : /windows/i.test(ua) ? "Windows" : "Desktop";
  const app = /instagram/i.test(ua) ? "Instagram" : /FBAN|FBAV|FB_IAB|FBIOS/i.test(ua) ? "Facebook" : /tiktok|musical_ly|bytedance/i.test(ua) ? "TikTok"
    : /edg\//i.test(ua) ? "Edge" : /crios|chrome/i.test(ua) ? "Chrome" : /fxios|firefox/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : "Outro";
  return `${os} · ${app}`;
}

function geo(c: Context, key: string) {
  const v = c.req.header(key);
  if (!v) return null;
  try {
    return decodeURIComponent(v).slice(0, 80);
  } catch {
    return v.slice(0, 80);
  }
}

/** Corpo do navegador, ou null se for robô, grande demais ou inválido. */
async function readBody(c: Context): Promise<Record<string, unknown> | null> {
  if (BOT_UA.test(c.req.header("user-agent") ?? "")) return null;
  const raw = await c.req.text();
  if (raw.length > MAX_BODY) return null;
  try {
    const b = JSON.parse(raw);
    return b && typeof b === "object" && LEAD_RE.test(String(b.leadId ?? "")) ? b : null;
  } catch {
    return null;
  }
}

function metaOf(input: unknown) {
  const m: Record<string, string> = {};
  if (!input || typeof input !== "object") return m;
  for (const k of META_KEYS) {
    const v = cut((input as Record<string, unknown>)[k], 200);
    if (v) m[k] = v;
  }
  return m;
}

/** Uma etapa do funil. A conta logada liga o visitante à compra. */
export async function recordStep(c: Context) {
  const b = await readBody(c);
  if (!b) return;
  const step = cut(b.step, 30);
  if (!step || !ALL_STEPS.has(step)) return;
  const user = await currentUser(c).catch(() => null);
  const meta = { ...metaOf(b.tracking), device: deviceOf(c.req.header("user-agent") ?? "") };
  await q(
    `INSERT INTO followcatch.funnel_events (lead_id, step, user_id, country, meta) VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [String(b.leadId), step, user?.id ?? null, cut(c.req.header("x-vercel-ip-country"), 5), JSON.stringify(meta)],
  );
}

/** Batimento a cada ~10 s com a página aberta. Uma linha por visitante. */
export async function recordBeat(c: Context) {
  const b = await readBody(c);
  if (!b) return;
  const m = metaOf(b.tracking);
  await q(
    `INSERT INTO followcatch.live_sessions (lead_id, country, region, city, device, ad, campaign, step)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (lead_id) DO UPDATE SET
       country = COALESCE(EXCLUDED.country, followcatch.live_sessions.country),
       region = COALESCE(EXCLUDED.region, followcatch.live_sessions.region),
       city = COALESCE(EXCLUDED.city, followcatch.live_sessions.city),
       device = EXCLUDED.device,
       ad = COALESCE(followcatch.live_sessions.ad, EXCLUDED.ad),
       campaign = COALESCE(followcatch.live_sessions.campaign, EXCLUDED.campaign),
       step = COALESCE(EXCLUDED.step, followcatch.live_sessions.step),
       beats = followcatch.live_sessions.beats + 1,
       last_seen = now()`,
    [
      String(b.leadId), cut(c.req.header("x-vercel-ip-country"), 5), geo(c, "x-vercel-ip-country-region"), geo(c, "x-vercel-ip-city"),
      deviceOf(c.req.header("user-agent") ?? ""), m.utm_content ?? null, m.utm_campaign ?? null, cut(b.step, 30),
    ],
  );
  if (Math.random() < 0.01) await q(`DELETE FROM followcatch.live_sessions WHERE last_seen < now() - interval '${LIVE_RETENTION_DAYS} days'`);
}

function sinceOf(range: Range): Date | null {
  const days = RANGES[range];
  if (days === -1) {
    const local = new Date(Date.now() + TZ_OFFSET_H * 3600_000);
    local.setUTCHours(0, 0, 0, 0);
    return new Date(local.getTime() - TZ_OFFSET_H * 3600_000);
  }
  return days ? new Date(Date.now() - days * 86400_000) : null;
}

export const parseRange = (v: string | undefined, fallback: Range): Range => (v && v in RANGES ? (v as Range) : fallback);

type Event = { lead_id: string; step: string; user_id: string | null; country: string | null; meta: Record<string, string> | null; at: Date };

function loadEvents(range: Range) {
  const since = sinceOf(range);
  return q<Event>(
    `SELECT lead_id, step, user_id, country, meta, at FROM followcatch.funnel_events
      WHERE ($1::timestamptz IS NULL OR at >= $1::timestamptz) ORDER BY at LIMIT ${MAX_EVENTS}`,
    [since],
  );
}

async function buyerIds() {
  const rows = await q<{ user_id: string }>("SELECT DISTINCT user_id FROM followcatch.checkouts WHERE completed_at IS NOT NULL");
  return new Set(rows.map((r) => r.user_id));
}

type Lead = { steps: Set<string>; country: string | null; device: string | null; ad: string | null; campaign: string | null; placement: string | null; user: string | null; first: Date; last: Date };

function groupLeads(events: Event[]) {
  const leads = new Map<string, Lead>();
  for (const e of events) {
    let l = leads.get(e.lead_id);
    if (!l) leads.set(e.lead_id, (l = { steps: new Set(), country: null, device: null, ad: null, campaign: null, placement: null, user: null, first: e.at, last: e.at }));
    l.steps.add(e.step);
    l.last = e.at;
    l.country ??= e.country;
    l.user ??= e.user_id;
    const m = e.meta ?? {};
    l.device ??= m.device ?? null;
    l.ad ??= m.utm_content ?? null;
    l.campaign ??= m.utm_campaign ?? null;
    l.placement ??= m.utm_term ?? null;
  }
  return leads;
}

export async function funnelReport(range: Range) {
  const [events, buyers] = await Promise.all([loadEvents(range), buyerIds()]);
  const leads = groupLeads(events);
  const isBuyer = (l: Lead) => !!l.user && buyers.has(l.user);
  const steps = STEPS.map(([key, label]) => ({ key, label, n: [...leads.values()].filter((l) => l.steps.has(key)).length }));

  const cohorts = (pick: (l: Lead) => string | null, limit: number) => {
    const map = new Map<string, { key: string; visitors: number; search: number; plans: number; checkout: number; buyers: number }>();
    for (const l of leads.values()) {
      const key = pick(l) ?? "—";
      const c = map.get(key) ?? { key, visitors: 0, search: 0, plans: 0, checkout: 0, buyers: 0 };
      c.visitors++;
      if (l.steps.has("search")) c.search++;
      if (l.steps.has("plans")) c.plans++;
      if (l.steps.has("checkout")) c.checkout++;
      if (isBuyer(l)) c.buyers++;
      map.set(key, c);
    }
    return [...map.values()].sort((a, b) => b.visitors - a.visitors).slice(0, limit);
  };

  return {
    generatedAt: new Date().toISOString(),
    range,
    visitors: leads.size,
    steps,
    buyers: [...leads.values()].filter(isBuyer).length,
    byAd: cohorts((l) => l.ad, 20),
    byCampaign: cohorts((l) => l.campaign, 20),
    byCountry: cohorts((l) => l.country, 15),
    byDevice: cohorts((l) => l.device, 10),
  };
}

const STEP_POS = new Map<string, number>(STEPS.map(([k], i) => [k, i]));
const STEP_LABEL = new Map<string, string>(STEPS.map(([k, l]) => [k, l]));

export async function visitorsReport(range: Range) {
  const [events, buyers] = await Promise.all([loadEvents(range), buyerIds()]);
  const leads = groupLeads(events);
  const users = [...new Set([...leads.values()].map((l) => l.user).filter(Boolean))] as string[];
  const emails = new Map((users.length
    ? await q<{ id: string; email: string }>("SELECT id, email FROM followcatch.users WHERE id = ANY($1)", [users])
    : []).map((u) => [u.id, u.email]));

  const byHour = Array.from({ length: 24 }, () => 0);
  const fiveMin = Date.now() - 5 * 60_000;
  let online = 0;
  const people = [...leads.entries()].map(([leadId, l]) => {
    byHour[(new Date(l.first).getUTCHours() + TZ_OFFSET_H) % 24]++;
    if (new Date(l.last).getTime() >= fiveMin) online++;
    let furthest = "";
    let pos = -1;
    for (const s of l.steps) {
      const p = STEP_POS.get(s) ?? -1;
      if (p > pos) { pos = p; furthest = STEP_LABEL.get(s) ?? s; }
    }
    return {
      leadId, first: new Date(l.first).toISOString(), last: new Date(l.last).toISOString(),
      country: l.country, device: l.device, ad: l.ad, campaign: l.campaign, placement: l.placement, furthest,
      clickedPay: l.steps.has("pay_click"), email: l.user ? emails.get(l.user) ?? null : null, buyer: !!l.user && buyers.has(l.user),
      // revisão automática da Meta: abre pela coluna da direita (desktop) e não passa da entrada
      review: /right_column/i.test(l.placement ?? "") && l.steps.size <= 1,
    };
  }).sort((a, b) => (a.first < b.first ? 1 : -1));

  return {
    generatedAt: new Date().toISOString(),
    range,
    total: people.length,
    reviews: people.filter((p) => p.review).length,
    online,
    bought: people.filter((p) => p.buyer).length,
    byHour,
    people: people.slice(0, MAX_PEOPLE),
  };
}

export async function liveReport(hoursRaw: string | undefined) {
  const hours = Math.min(48, Math.max(1, Math.floor(Number(hoursRaw)) || 2));
  const rows = await q<{
    lead_id: string; country: string | null; region: string | null; city: string | null; device: string | null;
    ad: string | null; campaign: string | null; step: string | null; beats: number; first_seen: Date; last_seen: Date;
    idle_s: number; email: string | null; bought: boolean;
  }>(
    `SELECT s.lead_id, s.country, s.region, s.city, s.device, s.ad, s.campaign, s.step, s.beats, s.first_seen, s.last_seen,
            extract(epoch FROM (now() - s.last_seen))::int AS idle_s, u.email,
            EXISTS (SELECT 1 FROM followcatch.checkouts k WHERE k.user_id = u.id AND k.completed_at IS NOT NULL) AS bought
       FROM followcatch.live_sessions s
       LEFT JOIN LATERAL (
         SELECT e.user_id FROM followcatch.funnel_events e
          WHERE e.lead_id = s.lead_id AND e.user_id IS NOT NULL ORDER BY e.at DESC LIMIT 1
       ) ev ON true
       LEFT JOIN followcatch.users u ON u.id = ev.user_id
      WHERE s.last_seen > now() - ($1 || ' hours')::interval
      ORDER BY s.last_seen DESC LIMIT 300`,
    [String(hours)],
  );
  return { generatedAt: new Date().toISOString(), hours, sessions: rows };
}
