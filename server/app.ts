// App Hono do FollowCatch (sem listen): usado pelo server local (index.ts) e pela
// função da Vercel (api/index.ts). Contrato: ../CONTRATO.md, ../CONTRATO-F2.md, src/lib/types.ts.
import { Hono, type Context } from "hono";
import type { Cycle, PlanId } from "../src/lib/types.js";
import { authenticate, closeSession, createUser, currentUser, getMe, hasAccess, openSession, requestPasswordReset, requireUser, resetPassword } from "./auth.js";
import { billingPortalUrl, confirmWelcome, createCheckout, handleEvent, verifySignature } from "./billing.js";
import { searchesToday, spentToday } from "./cache.js";
import { q } from "./db.js";
import { classify } from "./gender.js";
import { ApiErr, cachedProfile, getList, getProfile, normalizeUsername, teaser, type Who } from "./service.js";

export const app = new Hono();

/** IP do cliente: 1º item do x-forwarded-for (Vercel/proxy). */
function ipOf(c: Context): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "unknown";
}

function fail(c: Context, e: unknown) {
  if (e instanceof ApiErr) return c.json({ error: e.code, message: e.message }, e.status);
  console.error(e);
  return c.json({ error: "provider_error", message: "Unexpected server error." }, 502);
}

/** Quem pede: assinante ativo (sem limite por IP, teto próprio) ou visitante. */
async function whoIs(c: Context): Promise<{ who: Who; userId: string | null; subscriber: boolean }> {
  const ip = ipOf(c);
  const u = await currentUser(c).catch(() => null);
  if (!u) return { who: { ip, subscriberId: null }, userId: null, subscriber: false };
  const sub = hasAccess(await getMe(u));
  return { who: { ip, subscriberId: sub ? u.id : null }, userId: u.id, subscriber: sub };
}

async function rememberSearch(userId: string | null, username: string) {
  if (!userId) return;
  await q(
    `INSERT INTO followcatch.user_searches (user_id, username, at) VALUES ($1, $2, now())
     ON CONFLICT (user_id, username) DO UPDATE SET at = now()`,
    [userId, username],
  ).catch((e) => console.warn("[user_searches]", e instanceof Error ? e.message : e));
}

app.get("/api/health", async (c) => {
  try {
    const s = await spentToday();
    return c.json({
      ok: true,
      db: true,
      spentTodayUsd: Number(s.usd.toFixed(4)),
      runsToday: s.runs,
      maxDailyUsd: Number(process.env.MAX_DAILY_USD || 3),
      searchesTodayForYou: await searchesToday(`ip:${ipOf(c)}`),
      freeSearchesPerIp: Number(process.env.FREE_SEARCHES_PER_IP || 5),
    });
  } catch (e) {
    console.error("[health]", e);
    return c.json({ ok: false, db: false, message: "Database unavailable." }, 503);
  }
});

// ---- busca -----------------------------------------------------------------

app.get("/api/profile", async (c) => {
  try {
    const u = normalizeUsername(c.req.query("u"));
    const { who, userId } = await whoIs(c);
    const p = await getProfile(u, who);
    await rememberSearch(userId, u);
    return c.json(p);
  } catch (e) {
    return fail(c, e);
  }
});

for (const kind of ["following", "followers"] as const) {
  app.get(`/api/${kind}`, async (c) => {
    try {
      const u = normalizeUsername(c.req.query("u"));
      const { who, subscriber } = await whoIs(c);
      const list = await getList(kind, u, who);
      c.header("cache-control", "private, no-store");
      return c.json(subscriber ? list : teaser(list));
    } catch (e) {
      return fail(c, e);
    }
  });
}

/** Gênero do próprio perfil pesquisado (o front decide "gênero oposto"). Não roda Apify. */
app.get("/api/gender", async (c) => {
  try {
    const u = normalizeUsername(c.req.query("u"));
    const p = await cachedProfile(u);
    const g = await classify([{ username: u, fullName: p?.fullName ?? "" }]);
    return c.json({ username: u, gender: g.get(u) ?? "other" });
  } catch (e) {
    return fail(c, e);
  }
});

app.get("/api/stories", (c) => c.json({ status: "unavailable" }));

// ---- contas ----------------------------------------------------------------

async function body(c: Context): Promise<Record<string, unknown>> {
  return (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
}

app.post("/api/auth/signup", async (c) => {
  try {
    const b = await body(c);
    const u = await createUser(b.email, b.password);
    await openSession(c, u.id);
    return c.json(await getMe(u));
  } catch (e) {
    return fail(c, e);
  }
});

app.post("/api/auth/login", async (c) => {
  try {
    const b = await body(c);
    const u = await authenticate(b.email, b.password);
    if (!u) throw new ApiErr("bad_credentials", 401, "Wrong email or password.");
    await openSession(c, u.id);
    return c.json(await getMe(u));
  } catch (e) {
    return fail(c, e);
  }
});

app.post("/api/auth/logout", async (c) => {
  try {
    await closeSession(c);
    return c.json({ ok: true });
  } catch (e) {
    return fail(c, e);
  }
});

app.post("/api/auth/forgot", async (c) => {
  try {
    const b = await body(c);
    await requestPasswordReset(b.email);
  } catch (e) {
    if (e instanceof ApiErr && e.code === "invalid") return fail(c, e);
    console.error("[forgot]", e); // erro interno não muda a resposta: não vaza nada
  }
  return c.json({ ok: true, message: "If an account exists for this email, we've sent a reset link." });
});

app.post("/api/auth/reset", async (c) => {
  try {
    const b = await body(c);
    const u = await resetPassword(b.token, b.password);
    await openSession(c, u.id);
    return c.json(await getMe(u));
  } catch (e) {
    return fail(c, e);
  }
});

app.get("/api/me", async (c) => {
  try {
    const u = await requireUser(c);
    c.header("cache-control", "private, no-store");
    return c.json(await getMe(u));
  } catch (e) {
    return fail(c, e);
  }
});

app.get("/api/me/searches", async (c) => {
  try {
    const u = await requireUser(c);
    const rows = await q<{ username: string; at: Date }>(
      "SELECT username, at FROM followcatch.user_searches WHERE user_id = $1 ORDER BY at DESC LIMIT 30",
      [u.id],
    );
    return c.json({ items: rows.map((r) => ({ username: r.username, at: new Date(r.at).toISOString() })) });
  } catch (e) {
    return fail(c, e);
  }
});

// ---- pagamento -------------------------------------------------------------

const PLANS: PlanId[] = ["premium", "starter"];
const CYCLES: Cycle[] = ["weekly", "quarterly"];

app.post("/api/checkout", async (c) => {
  try {
    const u = await requireUser(c);
    const b = await body(c);
    const plan = b.plan as PlanId;
    const cycle = b.cycle as Cycle;
    if (!PLANS.includes(plan) || !CYCLES.includes(cycle)) throw new ApiErr("invalid", 400, "Invalid plan.");
    let username: string | null = null;
    if (typeof b.username === "string" && b.username) {
      try {
        username = normalizeUsername(b.username);
      } catch {
        username = null;
      }
    }
    const r = await createCheckout(u, plan, cycle, username);
    return c.json({ url: r.url });
  } catch (e) {
    return fail(c, e);
  }
});

app.get("/api/welcome", async (c) => {
  try {
    const session = (c.req.query("session") ?? "").trim();
    if (!session) {
      const u = await requireUser(c);
      return c.json(await getMe(u));
    }
    const r = await confirmWelcome(session);
    if (!r) throw new ApiErr("not_found", 404, "Checkout not found.");
    return c.json(await getMe({ id: r.userId, email: r.email }));
  } catch (e) {
    if (!(e instanceof ApiErr)) {
      console.error("[welcome]", e);
      return c.json({ error: "payment_error", message: "Could not confirm the payment yet. Please refresh in a moment." }, 502);
    }
    return fail(c, e);
  }
});

app.post("/api/billing-portal", async (c) => {
  try {
    const u = await requireUser(c);
    const url = await billingPortalUrl(u).catch((e) => {
      console.error("[portal]", e);
      return null;
    });
    if (!url) throw new ApiErr("payment_error", 404, "No subscription found for this account.");
    return c.json({ url });
  } catch (e) {
    return fail(c, e);
  }
});

app.post("/api/webhooks/paymentkit", async (c) => {
  const raw = await c.req.text();
  const secret = process.env.PAYMENTKIT_WEBHOOK_SECRET ?? "";
  if (!verifySignature(raw, c.req.header("x-webhook-signature"), secret)) {
    return c.json({ error: "unauthorized", message: "Invalid signature." }, 401);
  }
  let ev: { id?: string; type?: string; livemode?: boolean; data?: { object?: Record<string, unknown> } };
  try {
    ev = JSON.parse(raw);
  } catch {
    return c.json({ error: "invalid", message: "Invalid JSON." }, 400);
  }
  const id = ev.id || c.req.header("x-webhook-event-id");
  const type = ev.type || c.req.header("x-webhook-event-type");
  if (!id || !type) return c.json({ error: "invalid", message: "Missing event id/type." }, 400);
  if (ev.livemode === false) return c.json({ ok: true, ignored: "sandbox event" });
  try {
    const result = await handleEvent({ ...ev, id, type });
    console.log(`[webhook] ${type} ${id}: ${result}`);
    return c.json({ ok: true, result });
  } catch (e) {
    console.error(`[webhook] ${type} ${id} falhou:`, e);
    return c.json({ error: "provider_error", message: "Processing failed." }, 500); // 5xx = PaymentKit tenta de novo
  }
});

// ---- proxy de imagem (sem disco: a CDN da Vercel guarda) --------------------
const IMG_HOST = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;

app.get("/api/img", async (c) => {
  const raw = c.req.query("url") ?? "";
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return c.json({ error: "invalid", message: "Invalid image URL." }, 400);
  }
  if (u.protocol !== "https:" || !IMG_HOST.test(u.hostname)) {
    return c.json({ error: "invalid", message: "Image host not allowed." }, 400);
  }
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(15_000), headers: { "user-agent": "Mozilla/5.0" } });
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !type.startsWith("image/")) {
      return c.json({ error: "provider_error", message: `Image fetch failed (HTTP ${r.status}).` }, 502);
    }
    return c.body(await r.arrayBuffer(), 200, {
      "content-type": type,
      "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
    });
  } catch {
    return c.json({ error: "provider_error", message: "Image fetch failed." }, 502);
  }
});

app.notFound((c) => c.json({ error: "not_found", message: "Route not found." }, 404));
