// PaymentKit: checkout, portal, confirmação de sessão e webhook.
// Detalhes da conta/catálogo: ../../paymentkit-2026-10-15.md
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Cycle, Me, PlanId } from "../src/lib/types.js";
import { paymentLinks } from "../src/config/paymentkit.js";
import { one, q } from "./db.js";
import type { User } from "./auth.js";

const BASE = "https://app.paymentkit.com/api";
const ACCOUNT = () => process.env.PAYMENTKIT_ACCOUNT_ID || "acc_prod_2c1aa48ecd234963";
const APP_URL = () => (process.env.APP_URL || "https://followcatch.vercel.app").replace(/\/+$/, "");

/** price_id ↔ plano/ciclo (catálogo criado em 15/10). */
export const PRICES: Record<PlanId, Record<Cycle, string>> = {
  premium: { weekly: "price_prod_1ffe715598ab4424", quarterly: "price_prod_a1ac37a5cee14ad2" },
  starter: { weekly: "price_prod_1816caef3a4249fa", quarterly: "price_prod_273cfca6307e4080" },
};
const BY_PRICE = new Map<string, { plan: PlanId; cycle: Cycle }>();
for (const plan of Object.keys(PRICES) as PlanId[]) {
  for (const cycle of Object.keys(PRICES[plan]) as Cycle[]) BY_PRICE.set(PRICES[plan][cycle], { plan, cycle });
}

export class PkError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function pk<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const key = process.env.PAYMENTKIT_SECRET_KEY;
  if (!key) throw new PkError(0, "PAYMENTKIT_SECRET_KEY não configurado.");
  const r = await fetch(`${BASE}/${ACCOUNT()}${path}`, {
    method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await r.text();
  if (!r.ok) throw new PkError(r.status, `PaymentKit ${method} ${path} → HTTP ${r.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

// ---- cliente ---------------------------------------------------------------

type PkCustomer = { id: string; email: string | null; metadata?: Record<string, unknown> | null };

/** Cliente da PaymentKit do usuário: reaproveita o salvo, senão cria (ou acha pelo email). */
async function ensureCustomer(user: User): Promise<string> {
  if (user.pk_customer_id) return user.pk_customer_id;
  let id: string | null = null;
  try {
    const c = await pk<PkCustomer>("POST", "/customers/", { email: user.email, metadata: { user_id: user.id, app: "followcatch" } });
    id = c.id;
  } catch (e) {
    // email já existe na conta: procura o cliente existente
    const found = await pk<{ items?: PkCustomer[] }>("GET", `/customers/?search=${encodeURIComponent(user.email)}&limit=10`).catch(() => null);
    const hit = found?.items?.find((x) => (x.email ?? "").toLowerCase() === user.email);
    if (!hit) throw e;
    id = hit.id;
  }
  await q("UPDATE followcatch.users SET pk_customer_id = $1 WHERE id = $2", [id, user.id]);
  user.pk_customer_id = id;
  return id;
}

// ---- checkout --------------------------------------------------------------

type PkSession = {
  id: string;
  secure_token: string;
  state: "open" | "success" | "expired";
  completed: boolean;
  customer_id: string | null;
  customer_email: string | null;
  line_items?: { price_id: string }[];
};

/**
 * Cria a checkout session. A API da PaymentKit não aceita metadata na session, então
 * plano/ciclo/@ ficam na tabela `checkouts`, ligados por uma ref nossa que vai no
 * success_url (`/welcome?session=<ref>`).
 */
export async function createCheckout(user: User, plan: PlanId, cycle: Cycle, username: string | null): Promise<{ url: string; fallback: boolean }> {
  const ref = `ck_${randomBytes(18).toString("base64url")}`;
  try {
    const customerId = await ensureCustomer(user);
    const s = await pk<PkSession>("POST", "/checkout-sessions/", {
      customer_id: customerId,
      line_items: [{ price_id: PRICES[plan][cycle], quantity: 1 }],
      success_url: `${APP_URL()}/welcome?session=${ref}`,
      return_url: `${APP_URL()}/plans${username ? `?username=${encodeURIComponent(username)}` : ""}`,
      expires_in_hours: 24,
    });
    await q(
      "INSERT INTO followcatch.checkouts (ref, user_id, pk_session_id, plan, cycle, username) VALUES ($1, $2, $3, $4, $5, $6)",
      [ref, user.id, s.id, plan, cycle, username],
    );
    return { url: hostedUrlOf(s.secure_token), fallback: false };
  } catch (e) {
    console.warn("[checkout] session falhou, usando payment link:", e instanceof Error ? e.message : e);
    return { url: paymentLinks[plan][cycle], fallback: true };
  }
}

// ---- checkout embutido (PaymentKit.js) ---------------------------------------
// Fluxo oficial (docs PaymentKit.js → getting-started): o backend cria a checkout
// session com o price recorrente e devolve o `secure_token`; o front monta os campos
// do SDK com esse token e chama `submit()`. A session com price recorrente cria a
// assinatura ao concluir; a ativação segue pelo webhook + /api/welcome (ref nossa).

/** Valor de cada price em centavos (catálogo de 15/10, ver paymentkit-2026-10-15.md). */
const AMOUNT_ATOM: Record<PlanId, Record<Cycle, number>> = {
  premium: { weekly: 1400, quarterly: 12740 },
  starter: { weekly: 1200, quarterly: 10920 },
};

type PkCoupon = {
  id: string;
  name: string | null;
  percent_off: number | null;
  amount_atom_off: number | null;
  duration: string; // once | forever | repeating
  duration_in_months: number | null;
};

export type EmbeddedCheckout = {
  ref: string;
  secureToken: string;
  hostedUrl: string;
  /** centavos, USD */
  subtotal: number;
  discount: number;
  total: number;
  /** valor das renovações (cupom "once" só vale na 1ª cobrança) */
  renewal: number;
  promo: { code: string; label: string } | null;
};

const hostedUrlOf = (token: string) => `https://app.paymentkit.com/customer/?checkout_token=${encodeURIComponent(token)}`;

/** Valida o código na PaymentKit e devolve o cupom. Código inválido → ApiErr-like PkError 400. */
async function resolvePromo(code: string, customerId: string, amount: number): Promise<PkCoupon> {
  const v = await pk<{ valid: boolean; error?: string | null; promotion_code?: { coupon_id: string } | null }>(
    "POST",
    "/promotion-codes/validate",
    { code, customer_id: customerId, order_amount: amount / 100, order_currency: "usd" },
  ).catch((e) => {
    // 404/422 do validate = código não existe
    if (e instanceof PkError && e.status >= 400 && e.status < 500) return { valid: false, error: null, promotion_code: null };
    throw e;
  });
  if (!v.valid || !v.promotion_code?.coupon_id) throw new PkError(400, v.error || "That code isn't valid.");
  return pk<PkCoupon>("GET", `/coupons/${encodeURIComponent(v.promotion_code.coupon_id)}`);
}

function discountOf(c: PkCoupon | null, amount: number): number {
  if (!c) return 0;
  if (c.percent_off) return Math.min(amount, Math.round((amount * c.percent_off) / 100));
  if (c.amount_atom_off) return Math.min(amount, c.amount_atom_off);
  return 0;
}

function promoLabel(c: PkCoupon): string {
  const off = c.percent_off ? `${+c.percent_off.toFixed(2)}% off` : c.amount_atom_off ? `$${(c.amount_atom_off / 100).toFixed(2)} off` : "Discount";
  if (c.duration === "once") return `${off} your first payment`;
  if (c.duration === "repeating" && c.duration_in_months) return `${off} for ${c.duration_in_months} month${c.duration_in_months > 1 ? "s" : ""}`;
  return off;
}

/**
 * Sessão pro checkout embutido. Sem cupom, reaproveita uma sessão aberta recente do
 * mesmo usuário/plano/ciclo/@ (evita criar uma sessão a cada reload).
 */
export async function createEmbeddedCheckout(
  user: User, plan: PlanId, cycle: Cycle, username: string | null, promoCode: string | null,
): Promise<EmbeddedCheckout> {
  const subtotal = AMOUNT_ATOM[plan][cycle];
  const customerId = await ensureCustomer(user);

  let coupon: PkCoupon | null = null;
  if (promoCode) coupon = await resolvePromo(promoCode, customerId, subtotal);
  const discount = discountOf(coupon, subtotal);
  const promo = coupon && promoCode ? { code: promoCode, label: promoLabel(coupon) } : null;
  const renewal = coupon && coupon.duration === "forever" ? subtotal - discount : subtotal;
  const priced = { subtotal, discount, total: subtotal - discount, renewal, promo };

  if (!promoCode) {
    const prev = await one<{ ref: string; pk_session_id: string; secure_token: string }>(
      `SELECT ref, pk_session_id, secure_token FROM followcatch.checkouts
        WHERE user_id = $1 AND plan = $2 AND cycle = $3 AND username IS NOT DISTINCT FROM $4
          AND embedded AND promo_code IS NULL AND completed_at IS NULL AND secure_token IS NOT NULL
          AND created_at > now() - interval '20 hours'
        ORDER BY created_at DESC LIMIT 1`,
      [user.id, plan, cycle, username],
    );
    if (prev) {
      const s = await pk<PkSession>("GET", `/checkout-sessions/${encodeURIComponent(prev.pk_session_id)}`).catch(() => null);
      if (s && s.state === "open" && !s.completed) {
        return { ref: prev.ref, secureToken: prev.secure_token, hostedUrl: hostedUrlOf(prev.secure_token), ...priced };
      }
    }
  }

  const ref = `ck_${randomBytes(18).toString("base64url")}`;
  const s = await pk<PkSession>("POST", "/checkout-sessions/", {
    customer_id: customerId,
    line_items: [{ price_id: PRICES[plan][cycle], quantity: 1 }],
    ...(promoCode ? { promotion_code: promoCode } : {}),
    success_url: `${APP_URL()}/welcome?session=${ref}`,
    return_url: `${APP_URL()}/checkout?plan=${plan}&cycle=${cycle}${username ? `&username=${encodeURIComponent(username)}` : ""}`,
    expires_in_hours: 24,
  });
  await q(
    `INSERT INTO followcatch.checkouts (ref, user_id, pk_session_id, plan, cycle, username, secure_token, promo_code, embedded)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
    [ref, user.id, s.id, plan, cycle, username, s.secure_token, promoCode],
  );
  return { ref, secureToken: s.secure_token, hostedUrl: hostedUrlOf(s.secure_token), ...priced };
}

// ---- assinatura: PaymentKit → nossa tabela --------------------------------

type PkSubscription = {
  id: string;
  state: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  items?: { price?: { id?: string } | null }[];
  customer?: PkCustomer | null;
  metadata?: Record<string, unknown> | null;
};

function statusOf(state: string): Me["status"] {
  switch (state) {
    case "active":
    case "active_unsettled":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "cancelled":
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    default: // incomplete, scheduled
      return "none";
  }
}

function planOf(sub: PkSubscription): { plan: PlanId; cycle: Cycle } | null {
  for (const it of sub.items ?? []) {
    const hit = it.price?.id ? BY_PRICE.get(it.price.id) : undefined;
    if (hit) return hit;
  }
  return null;
}

/** Acha o usuário dono de uma assinatura/cliente: metadata.user_id → customer id → email. */
async function userFor(opts: { userId?: unknown; customerId?: string | null; email?: string | null }): Promise<string | null> {
  if (typeof opts.userId === "string" && opts.userId) {
    const u = await one<{ id: string }>("SELECT id FROM followcatch.users WHERE id = $1", [opts.userId]);
    if (u) return u.id;
  }
  if (opts.customerId) {
    const u = await one<{ id: string }>("SELECT id FROM followcatch.users WHERE pk_customer_id = $1", [opts.customerId]);
    if (u) return u.id;
  }
  if (opts.email) {
    const u = await one<{ id: string }>("SELECT id FROM followcatch.users WHERE email = $1", [opts.email.toLowerCase()]);
    if (u) {
      if (opts.customerId) await q("UPDATE followcatch.users SET pk_customer_id = COALESCE(pk_customer_id, $1) WHERE id = $2", [opts.customerId, u.id]);
      return u.id;
    }
  }
  return null;
}

export async function applySubscription(sub: PkSubscription, fallbackUserId?: string): Promise<string | null> {
  const userId =
    (await userFor({
      userId: sub.metadata?.user_id ?? sub.customer?.metadata?.user_id,
      customerId: sub.customer?.id ?? null,
      email: sub.customer?.email ?? null,
    })) ?? fallbackUserId ?? null;
  if (!userId) return null;
  const pc = planOf(sub);
  await q(
    `INSERT INTO followcatch.subscriptions
       (user_id, pk_subscription_id, pk_customer_id, plan, cycle, status, pk_state, renews_at, cancel_at_period_end, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (user_id) DO UPDATE SET
       pk_subscription_id = EXCLUDED.pk_subscription_id,
       pk_customer_id = COALESCE(EXCLUDED.pk_customer_id, followcatch.subscriptions.pk_customer_id),
       plan = COALESCE(EXCLUDED.plan, followcatch.subscriptions.plan),
       cycle = COALESCE(EXCLUDED.cycle, followcatch.subscriptions.cycle),
       status = EXCLUDED.status, pk_state = EXCLUDED.pk_state,
       renews_at = COALESCE(EXCLUDED.renews_at, followcatch.subscriptions.renews_at),
       cancel_at_period_end = EXCLUDED.cancel_at_period_end, updated_at = now()`,
    [
      userId, sub.id, sub.customer?.id ?? null, pc?.plan ?? null, pc?.cycle ?? null,
      statusOf(sub.state), sub.state, sub.current_period_end ?? null, !!sub.cancel_at_period_end,
    ],
  );
  return userId;
}

/** Assinatura mais recente do cliente na PaymentKit (preferindo as que dão acesso). */
async function latestSubscription(customerId: string): Promise<PkSubscription | null> {
  const r = await pk<{ items?: PkSubscription[] } | PkSubscription[]>(
    "GET",
    `/subscriptions/?customer_external_id=${encodeURIComponent(customerId)}&limit=10`,
  );
  const items = Array.isArray(r) ? r : r.items ?? [];
  return items.find((s) => statusOf(s.state) === "active") ?? items[0] ?? null;
}

/** Sessão paga mas assinatura ainda não visível na API: ativa pelo plano do checkout. */
async function activateFromCheckout(ck: { user_id: string; plan: string; cycle: string }, customerId: string | null) {
  const days = ck.cycle === "quarterly" ? 92 : 7;
  await q(
    `INSERT INTO followcatch.subscriptions (user_id, pk_customer_id, plan, cycle, status, pk_state, renews_at, updated_at)
     VALUES ($1, $2, $3, $4, 'active', 'checkout_completed', now() + ($5 || ' days')::interval, now())
     ON CONFLICT (user_id) DO UPDATE SET
       pk_customer_id = COALESCE(EXCLUDED.pk_customer_id, followcatch.subscriptions.pk_customer_id),
       plan = EXCLUDED.plan, cycle = EXCLUDED.cycle, status = 'active', pk_state = EXCLUDED.pk_state,
       renews_at = GREATEST(COALESCE(followcatch.subscriptions.renews_at, now()), EXCLUDED.renews_at), updated_at = now()`,
    [ck.user_id, customerId, ck.plan, ck.cycle, String(days)],
  );
}

type CheckoutRow = { ref: string; user_id: string; pk_session_id: string; plan: string; cycle: string; completed_at: Date | null };

/** Confere uma checkout session paga e ativa o usuário. Devolve o user_id (ou null se não pagou). */
async function settleCheckout(ck: CheckoutRow, session?: PkSession): Promise<string | null> {
  const s = session ?? (await pk<PkSession>("GET", `/checkout-sessions/${encodeURIComponent(ck.pk_session_id)}`));
  if (!(s.completed || s.state === "success")) return null;
  await q("UPDATE followcatch.checkouts SET completed_at = COALESCE(completed_at, now()) WHERE ref = $1", [ck.ref]);
  if (s.customer_id) {
    await q("UPDATE followcatch.users SET pk_customer_id = COALESCE(pk_customer_id, $1) WHERE id = $2", [s.customer_id, ck.user_id]);
    const sub = await latestSubscription(s.customer_id).catch(() => null);
    if (sub && statusOf(sub.state) === "active") {
      await applySubscription(sub, ck.user_id);
      return ck.user_id;
    }
  }
  await activateFromCheckout(ck, s.customer_id);
  return ck.user_id;
}

/** /api/welcome: aceita a ref nossa (ck_…) ou o id da session (cs_…). */
export async function confirmWelcome(session: string): Promise<{ userId: string; email: string; paid: boolean } | null> {
  const ck = await one<CheckoutRow & { email: string }>(
    `SELECT c.ref, c.user_id, c.pk_session_id, c.plan, c.cycle, c.completed_at, u.email
       FROM followcatch.checkouts c JOIN followcatch.users u ON u.id = c.user_id
      WHERE c.ref = $1 OR c.pk_session_id = $1`,
    [session],
  );
  if (!ck) return null;
  const paid = (await settleCheckout(ck)) !== null;
  return { userId: ck.user_id, email: ck.email, paid };
}

// ---- portal ----------------------------------------------------------------

export async function billingPortalUrl(user: User): Promise<string | null> {
  const customerId =
    user.pk_customer_id ??
    (await one<{ pk_customer_id: string | null }>("SELECT pk_customer_id FROM followcatch.subscriptions WHERE user_id = $1", [user.id]))
      ?.pk_customer_id;
  if (!customerId) return null;
  const r = await pk<{ billing_portal_url: string }>("POST", "/billing-portal-sessions", { customer_id: customerId, expires_in_hours: 1 });
  return r.billing_portal_url;
}

// ---- webhook ---------------------------------------------------------------

/** HMAC-SHA256 do corpo CRU, hex, header `sha256=<hex>`, comparação em tempo constante. */
export function verifySignature(rawBody: string, header: string | undefined, secret: string): boolean {
  if (!header || !secret) return false;
  const got = header.trim().replace(/^sha256=/i, "");
  if (!/^[0-9a-f]{64}$/i.test(got)) return false;
  const want = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return timingSafeEqual(Buffer.from(want, "hex"), Buffer.from(got.toLowerCase(), "hex"));
}

type PkEvent = { id: string; type: string; livemode?: boolean; data?: { object?: Record<string, unknown> } };

/** Grava o evento (idempotência por id) e aplica. Devolve o que aconteceu, pra log. */
export async function handleEvent(ev: PkEvent): Promise<string> {
  const ins = await one<{ id: string }>(
    "INSERT INTO followcatch.webhook_events (id, type, payload) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO NOTHING RETURNING id",
    [ev.id, ev.type, JSON.stringify(ev)],
  );
  if (!ins) {
    const prev = await one<{ processed_at: Date | null }>("SELECT processed_at FROM followcatch.webhook_events WHERE id = $1", [ev.id]);
    if (prev?.processed_at) return "duplicate";
  }
  try {
    const result = await applyEvent(ev);
    await q("UPDATE followcatch.webhook_events SET processed_at = now(), error = NULL WHERE id = $1", [ev.id]);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await q("UPDATE followcatch.webhook_events SET error = $2 WHERE id = $1", [ev.id, msg.slice(0, 500)]).catch(() => []);
    throw e;
  }
}

async function applyEvent(ev: PkEvent): Promise<string> {
  const obj = (ev.data?.object ?? {}) as Record<string, unknown>;
  const t = ev.type;

  if (t === "checkout.session.completed") {
    const s = obj as unknown as PkSession;
    const ck = await one<CheckoutRow>(
      "SELECT ref, user_id, pk_session_id, plan, cycle, completed_at FROM followcatch.checkouts WHERE pk_session_id = $1",
      [s.id],
    );
    if (!ck) {
      // Veio de payment link (sem checkout nosso): liga pelo cliente/email; a assinatura chega no evento dela.
      const uid = await userFor({ customerId: s.customer_id, email: s.customer_email });
      return uid ? `checkout sem ref ligado a ${uid}` : "checkout sem usuário";
    }
    await settleCheckout(ck, { ...s, completed: true });
    return `checkout ${ck.ref} ativado`;
  }

  if (t.startsWith("customer.subscription.")) {
    const uid = await applySubscription(obj as unknown as PkSubscription);
    return uid ? `assinatura → ${uid}` : "assinatura sem usuário";
  }

  if (t.startsWith("invoice.") || t.startsWith("payment.")) {
    // A fatura/pagamento só aponta pra assinatura: relê a assinatura na API (fonte da verdade).
    const subId = pickId(obj, "subscription_id", "subscription");
    if (subId) {
      const sub = await pk<PkSubscription>("GET", `/subscriptions/${encodeURIComponent(subId)}`);
      const uid = await applySubscription(sub);
      return uid ? `assinatura relida → ${uid}` : "assinatura relida sem usuário";
    }
    const customerId = pickId(obj, "customer_id", "customer");
    if (customerId) {
      const sub = await latestSubscription(customerId).catch(() => null);
      if (sub) {
        const uid = await applySubscription(sub);
        return uid ? `assinatura do cliente → ${uid}` : "sem usuário";
      }
    }
    return "ignorado (sem assinatura)";
  }

  return "ignorado";
}

function pickId(o: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v) return v;
    if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string") return (v as { id: string }).id;
  }
  return null;
}
