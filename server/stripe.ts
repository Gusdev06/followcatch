// Stripe direto (decisão de 15/10: a PaymentKit exigia "raw card data APIs" no Stripe).
// Fluxo oficial "build a subscriptions integration" com Payment Element:
//   1. backend cria Customer + Subscription (payment_behavior=default_incomplete)
//   2. devolve o client_secret do PaymentIntent da 1ª fatura (latest_invoice.confirmation_secret)
//   3. o front confirma com stripe.confirmPayment → a fatura paga ativa a assinatura
//   4. webhook (assinado) + /api/welcome mantêm followcatch.subscriptions em dia.
// Catálogo (criado via API em 15/10): lookup_keys premium_weekly, premium_quarterly,
// starter_weekly, starter_quarterly. Conta acct_1UQkE3KB2pE3c4ql.
import { randomBytes } from "node:crypto";
import Stripe from "stripe";
import type { Cycle, Me, PlanId } from "../src/lib/types.js";
import { one, q } from "./db.js";
import type { User } from "./auth.js";

const APP_URL = () => (process.env.APP_URL || "https://followcatch.vercel.app").replace(/\/+$/, "");

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeFail(500, "STRIPE_SECRET_KEY não configurado.");
  client = new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "followcatch" } });
  return client;
}

/** Erro com mensagem que pode ir pro cliente (status 400) ou interno (5xx). */
export class StripeFail extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---- catálogo ----------------------------------------------------------------

/** price_id do Stripe por plano/ciclo (live, 15/10). lookup_key é a referência estável. */
export const STRIPE_PRICES: Record<PlanId, Record<Cycle, string>> = {
  premium: { weekly: "price_1UQp5GKB2pE3c4qlwzwjzEGN", quarterly: "price_1UQp5HKB2pE3c4qllNSt7Pwi" },
  starter: { weekly: "price_1UQp5IKB2pE3c4qlOMDEwxsL", quarterly: "price_1UQp5IKB2pE3c4qlImKuSNdT" },
};
const BY_PRICE = new Map<string, { plan: PlanId; cycle: Cycle }>();
for (const plan of Object.keys(STRIPE_PRICES) as PlanId[]) {
  for (const cycle of Object.keys(STRIPE_PRICES[plan]) as Cycle[]) BY_PRICE.set(STRIPE_PRICES[plan][cycle], { plan, cycle });
}
const BY_LOOKUP = (k: string | null | undefined): { plan: PlanId; cycle: Cycle } | null => {
  const m = /^(premium|starter)_(weekly|quarterly)$/.exec(k ?? "");
  return m ? { plan: m[1] as PlanId, cycle: m[2] as Cycle } : null;
};

/** Valor de cada price em centavos (USD). */
const AMOUNT: Record<PlanId, Record<Cycle, number>> = {
  premium: { weekly: 1400, quarterly: 12740 },
  starter: { weekly: 1200, quarterly: 10920 },
};

/** Portal do cliente (configuração criada via API em 15/10). */
const PORTAL_CONFIG = () => process.env.STRIPE_PORTAL_CONFIG || "bpc_1UQp7xKB2pE3c4qlryoJIPii";

// ---- cliente -----------------------------------------------------------------

async function ensureCustomer(user: User): Promise<string> {
  const row = await one<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM followcatch.users WHERE id = $1",
    [user.id],
  );
  if (row?.stripe_customer_id) return row.stripe_customer_id;
  const c = await stripe().customers.create(
    { email: user.email, metadata: { user_id: user.id, app: "followcatch" } },
    { idempotencyKey: `fc-customer-${user.id}` },
  );
  await q("UPDATE followcatch.users SET stripe_customer_id = COALESCE(stripe_customer_id, $1) WHERE id = $2", [c.id, user.id]);
  const after = await one<{ stripe_customer_id: string }>("SELECT stripe_customer_id FROM followcatch.users WHERE id = $1", [user.id]);
  return after?.stripe_customer_id ?? c.id;
}

// ---- cupom -------------------------------------------------------------------

type Promo = { id: string; code: string; coupon: Stripe.Coupon };

async function resolvePromo(code: string): Promise<Promo> {
  const r = await stripe().promotionCodes.list({ code, active: true, limit: 1, expand: ["data.promotion.coupon"] });
  const p = r.data[0];
  const coupon = couponOf(p);
  if (!p || !coupon || !coupon.valid) throw new StripeFail(400, "That code isn't valid.");
  if (coupon.amount_off && coupon.currency && coupon.currency !== "usd") throw new StripeFail(400, "That code isn't valid.");
  return { id: p.id, code: p.code, coupon };
}

/** O cupom do promotion code (API nova: `promotion.coupon`; antiga: `coupon`). */
function couponOf(p: Stripe.PromotionCode | undefined): Stripe.Coupon | null {
  if (!p) return null;
  const any = p as unknown as { coupon?: Stripe.Coupon | string; promotion?: { coupon?: Stripe.Coupon | string | null } };
  const c = any.promotion?.coupon ?? any.coupon;
  return c && typeof c === "object" ? c : null;
}

function promoLabel(c: Stripe.Coupon): string {
  const off = c.percent_off ? `${+c.percent_off.toFixed(2)}% off` : c.amount_off ? `$${(c.amount_off / 100).toFixed(2)} off` : "Discount";
  if (c.duration === "once") return `${off} your first payment`;
  if (c.duration === "repeating" && c.duration_in_months) return `${off} for ${c.duration_in_months} month${c.duration_in_months > 1 ? "s" : ""}`;
  return off;
}

// ---- checkout embutido -------------------------------------------------------

export type StripeEmbedded = {
  provider: "stripe";
  ref: string;
  /** client_secret do PaymentIntent da 1ª fatura. null = nada a cobrar (cupom de 100%). */
  clientSecret: string | null;
  /** assinatura já ativa (fatura de valor zero) */
  paid: boolean;
  /** centavos, USD */
  amount: number;
  interval: "week" | "3 months";
  subtotal: number;
  discount: number;
  total: number;
  renewal: number;
  promo: { code: string; label: string } | null;
};

const EXPAND = ["latest_invoice.confirmation_secret", "latest_invoice.discounts"];

function invoiceOf(sub: Stripe.Subscription): Stripe.Invoice | null {
  const inv = sub.latest_invoice;
  return inv && typeof inv === "object" ? inv : null;
}

function shape(
  ref: string, sub: Stripe.Subscription, plan: PlanId, cycle: Cycle, promo: Promo | null,
): StripeEmbedded {
  const inv = invoiceOf(sub);
  const subtotal = AMOUNT[plan][cycle];
  const total = inv ? inv.amount_due : subtotal;
  const discount = Math.max(0, subtotal - total);
  const renewal = promo && promo.coupon.duration === "forever" ? total : subtotal;
  return {
    provider: "stripe",
    ref,
    clientSecret: inv?.confirmation_secret?.client_secret ?? null,
    paid: sub.status === "active" || sub.status === "trialing",
    amount: total,
    interval: cycle === "weekly" ? "week" : "3 months",
    subtotal,
    discount,
    total,
    renewal,
    promo: promo ? { code: promo.code, label: promoLabel(promo.coupon) } : null,
  };
}

/**
 * Cria (ou reaproveita) a assinatura incompleta do usuário pro plano/ciclo/@/cupom.
 * Reaproveita a mais recente (< 20h) ainda `incomplete` com fatura aberta, pra um reload
 * não criar outra assinatura.
 */
export async function createStripeEmbedded(
  user: User, plan: PlanId, cycle: Cycle, username: string | null, promoCode: string | null,
): Promise<StripeEmbedded> {
  const s = stripe();
  const customer = await ensureCustomer(user);
  const promo = promoCode ? await resolvePromo(promoCode) : null;

  const prev = await q<{ ref: string; stripe_subscription_id: string; plan: string; cycle: string; username: string | null; promo_code: string | null }>(
    `SELECT ref, stripe_subscription_id, plan, cycle, username, promo_code FROM followcatch.checkouts
      WHERE user_id = $1 AND provider = 'stripe' AND completed_at IS NULL AND stripe_subscription_id IS NOT NULL
        AND created_at > now() - interval '20 hours'
      ORDER BY created_at DESC LIMIT 10`,
    [user.id],
  );
  const same = prev.find(
    (r) => r.plan === plan && r.cycle === cycle && (r.username ?? null) === username && (r.promo_code ?? "").toUpperCase() === (promo?.code ?? "").toUpperCase(),
  );
  if (same) {
    const sub = await s.subscriptions.retrieve(same.stripe_subscription_id, { expand: EXPAND }).catch(() => null);
    const inv = sub ? invoiceOf(sub) : null;
    if (sub && sub.status === "incomplete" && inv?.status === "open" && inv.confirmation_secret?.client_secret) {
      return shape(same.ref, sub, plan, cycle, promo);
    }
  }

  const ref = `ck_${randomBytes(18).toString("base64url")}`;
  let sub: Stripe.Subscription;
  try {
    sub = await s.subscriptions.create(
      {
        customer,
        items: [{ price: STRIPE_PRICES[plan][cycle] }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        ...(promo ? { discounts: [{ promotion_code: promo.id }] } : {}),
        metadata: { user_id: user.id, plan, cycle, username: username ?? "", ref, app: "followcatch" },
        expand: EXPAND,
      },
      { idempotencyKey: `fc-sub-${ref}` },
    );
  } catch (e) {
    if (promo && e instanceof Stripe.errors.StripeInvalidRequestError && /promotion|coupon|discount/i.test(e.message)) {
      throw new StripeFail(400, "That code can't be used on this plan.");
    }
    throw e;
  }
  await q(
    `INSERT INTO followcatch.checkouts (ref, user_id, plan, cycle, username, promo_code, embedded, provider, stripe_subscription_id)
     VALUES ($1, $2, $3, $4, $5, $6, true, 'stripe', $7)`,
    [ref, user.id, plan, cycle, username, promo?.code ?? null, sub.id],
  );

  // as outras incompletas deste usuário (outro plano/cupom) não servem mais: cancela (best effort)
  for (const r of prev) {
    if (r.stripe_subscription_id === sub.id) continue;
    s.subscriptions
      .retrieve(r.stripe_subscription_id)
      .then((old) => (old.status === "incomplete" ? s.subscriptions.cancel(old.id) : null))
      .catch(() => null);
  }

  if (sub.status === "active") await applyStripeSubscription(sub, user.id);
  return shape(ref, sub, plan, cycle, promo);
}

// ---- assinatura: Stripe → nossa tabela ---------------------------------------

function statusOf(s: Stripe.Subscription.Status | string): Me["status"] {
  switch (s) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    default: // incomplete
      return "none";
  }
}

function planOf(sub: Stripe.Subscription): { plan: PlanId; cycle: Cycle } | null {
  for (const it of sub.items?.data ?? []) {
    const hit = BY_LOOKUP(it.price?.lookup_key) ?? (it.price?.id ? BY_PRICE.get(it.price.id) : undefined);
    if (hit) return hit;
  }
  const meta = BY_LOOKUP(`${sub.metadata?.plan}_${sub.metadata?.cycle}`);
  return meta;
}

/** Fim do período atual: na API nova mora nos itens; nas antigas, na assinatura. */
function periodEnd(sub: Stripe.Subscription): Date | null {
  const ends = (sub.items?.data ?? []).map((i) => (i as unknown as { current_period_end?: number }).current_period_end ?? 0);
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end ?? 0;
  const t = Math.max(legacy, ...ends, 0);
  return t ? new Date(t * 1000) : null;
}

const customerIdOf = (c: Stripe.Subscription["customer"]) => (typeof c === "string" ? c : c?.id ?? null);

async function userForSub(sub: Stripe.Subscription): Promise<string | null> {
  const uid = sub.metadata?.user_id;
  if (uid) {
    const u = await one<{ id: string }>("SELECT id FROM followcatch.users WHERE id = $1", [uid]);
    if (u) return u.id;
  }
  const cid = customerIdOf(sub.customer);
  if (cid) {
    const u = await one<{ id: string }>("SELECT id FROM followcatch.users WHERE stripe_customer_id = $1", [cid]);
    if (u) return u.id;
    const c = typeof sub.customer === "object" && !("deleted" in sub.customer && sub.customer.deleted)
      ? (sub.customer as Stripe.Customer)
      : await stripe().customers.retrieve(cid).catch(() => null);
    const meta = c && !("deleted" in c && c.deleted) ? (c as Stripe.Customer) : null;
    const byMeta = meta?.metadata?.user_id
      ? await one<{ id: string }>("SELECT id FROM followcatch.users WHERE id = $1", [meta.metadata.user_id])
      : null;
    const byEmail = !byMeta && meta?.email
      ? await one<{ id: string }>("SELECT id FROM followcatch.users WHERE email = $1", [meta.email.toLowerCase()])
      : null;
    const hit = byMeta ?? byEmail;
    if (hit) {
      await q("UPDATE followcatch.users SET stripe_customer_id = COALESCE(stripe_customer_id, $1) WHERE id = $2", [cid, hit.id]);
      return hit.id;
    }
  }
  return null;
}

/**
 * Grava o estado da assinatura no usuário. Uma assinatura diferente da registrada que NÃO
 * dá acesso (ex.: outra tentativa de checkout que expirou) não derruba quem está ativo.
 */
export async function applyStripeSubscription(sub: Stripe.Subscription, fallbackUserId?: string): Promise<string | null> {
  const userId = (await userForSub(sub)) ?? fallbackUserId ?? null;
  if (!userId) return null;
  const status = statusOf(sub.status);
  const cur = await one<{ stripe_subscription_id: string | null; status: string; renews_at: Date | null }>(
    "SELECT stripe_subscription_id, status, renews_at FROM followcatch.subscriptions WHERE user_id = $1",
    [userId],
  );
  const curActive = cur?.status === "active" && (!cur.renews_at || new Date(cur.renews_at).getTime() > Date.now());
  if (cur && curActive && cur.stripe_subscription_id !== sub.id && status !== "active") return userId;
  if (!cur && status === "none") return userId; // incompleta sem histórico: nada a gravar

  const pc = planOf(sub);
  await q(
    `INSERT INTO followcatch.subscriptions
       (user_id, provider, stripe_subscription_id, stripe_customer_id, plan, cycle, status, pk_state, renews_at, cancel_at_period_end, updated_at)
     VALUES ($1, 'stripe', $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (user_id) DO UPDATE SET
       provider = 'stripe',
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, followcatch.subscriptions.stripe_customer_id),
       plan = COALESCE(EXCLUDED.plan, followcatch.subscriptions.plan),
       cycle = COALESCE(EXCLUDED.cycle, followcatch.subscriptions.cycle),
       status = EXCLUDED.status, pk_state = EXCLUDED.pk_state,
       renews_at = COALESCE(EXCLUDED.renews_at, followcatch.subscriptions.renews_at),
       cancel_at_period_end = EXCLUDED.cancel_at_period_end, updated_at = now()`,
    [
      userId, sub.id, customerIdOf(sub.customer), pc?.plan ?? null, pc?.cycle ?? null,
      status, `stripe:${sub.status}`, periodEnd(sub), !!sub.cancel_at_period_end || !!sub.cancel_at,
    ],
  );
  if (status === "active") {
    await q("UPDATE followcatch.checkouts SET completed_at = COALESCE(completed_at, now()) WHERE stripe_subscription_id = $1", [sub.id]);
  }
  return userId;
}

// ---- /api/welcome ------------------------------------------------------------

type CheckoutRow = { ref: string; user_id: string; email: string; stripe_subscription_id: string | null };

/** É uma ref de checkout do Stripe? (ref nossa ck_… ou id da assinatura sub_…) */
export async function findStripeCheckout(refOrSub: string): Promise<CheckoutRow | null> {
  return one<CheckoutRow>(
    `SELECT c.ref, c.user_id, u.email, c.stripe_subscription_id
       FROM followcatch.checkouts c JOIN followcatch.users u ON u.id = c.user_id
      WHERE c.provider = 'stripe' AND (c.ref = $1 OR c.stripe_subscription_id = $1)`,
    [refOrSub],
  );
}

/**
 * Confere no Stripe e ativa na hora. Logo depois do confirmPayment a fatura pode levar
 * 1–2 s pra virar `paid`: tenta algumas vezes antes de devolver "ainda não".
 */
export async function confirmStripeWelcome(ck: CheckoutRow): Promise<{ userId: string; email: string; paid: boolean }> {
  if (!ck.stripe_subscription_id) return { userId: ck.user_id, email: ck.email, paid: false };
  for (let i = 0; i < 4; i++) {
    const sub = await stripe().subscriptions.retrieve(ck.stripe_subscription_id, { expand: ["latest_invoice"] });
    if (statusOf(sub.status) === "active") {
      await applyStripeSubscription(sub, ck.user_id);
      return { userId: ck.user_id, email: ck.email, paid: true };
    }
    const inv = invoiceOf(sub);
    if (sub.status !== "incomplete" || (inv && inv.status !== "open" && inv.status !== "draft")) break;
    await new Promise((r) => setTimeout(r, 1200));
  }
  return { userId: ck.user_id, email: ck.email, paid: false };
}

// ---- portal ------------------------------------------------------------------

export async function hasStripeCustomer(userId: string): Promise<string | null> {
  const r = await one<{ stripe_customer_id: string | null }>(
    `SELECT COALESCE(u.stripe_customer_id, s.stripe_customer_id) AS stripe_customer_id
       FROM followcatch.users u LEFT JOIN followcatch.subscriptions s ON s.user_id = u.id
      WHERE u.id = $1`,
    [userId],
  );
  return r?.stripe_customer_id ?? null;
}

export async function stripePortalUrl(customerId: string): Promise<string> {
  const cfg = PORTAL_CONFIG();
  const r = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL()}/app`,
    ...(cfg ? { configuration: cfg } : {}),
  });
  return r.url;
}

// ---- webhook -----------------------------------------------------------------

/** Verifica a assinatura `Stripe-Signature` sobre o corpo CRU. null = inválida. */
export function verifyStripeEvent(raw: string, header: string | undefined): Stripe.Event | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return null;
  try {
    return stripe().webhooks.constructEvent(raw, header, secret);
  } catch {
    return null;
  }
}

/** Idempotente por event.id (tabela webhook_events, compartilhada com a PaymentKit). */
export async function handleStripeEvent(ev: Stripe.Event): Promise<string> {
  const ins = await one<{ id: string }>(
    "INSERT INTO followcatch.webhook_events (id, type, payload) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO NOTHING RETURNING id",
    [ev.id, ev.type, JSON.stringify(ev)],
  );
  if (!ins) {
    const prev = await one<{ processed_at: Date | null }>("SELECT processed_at FROM followcatch.webhook_events WHERE id = $1", [ev.id]);
    if (prev?.processed_at) return "duplicate";
  }
  try {
    const result = await applyStripeEvent(ev);
    await q("UPDATE followcatch.webhook_events SET processed_at = now(), error = NULL WHERE id = $1", [ev.id]);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await q("UPDATE followcatch.webhook_events SET error = $2 WHERE id = $1", [ev.id, msg.slice(0, 500)]).catch(() => []);
    throw e;
  }
}

function subIdOfInvoice(inv: Stripe.Invoice): string | null {
  const parent = inv.parent?.subscription_details?.subscription;
  const legacy = (inv as unknown as { subscription?: string | { id: string } | null }).subscription;
  const v = parent ?? legacy;
  return typeof v === "string" ? v : v?.id ?? null;
}

async function applyStripeEvent(ev: Stripe.Event): Promise<string> {
  switch (ev.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const uid = await applyStripeSubscription(ev.data.object);
      return uid ? `assinatura ${ev.data.object.id} (${ev.data.object.status}) → ${uid}` : "assinatura sem usuário";
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      // a fatura só aponta pra assinatura: relê a assinatura (fonte da verdade)
      const subId = subIdOfInvoice(ev.data.object);
      if (!subId) return "fatura sem assinatura";
      const sub = await stripe().subscriptions.retrieve(subId);
      const uid = await applyStripeSubscription(sub);
      return uid ? `assinatura relida ${sub.id} (${sub.status}) → ${uid}` : "assinatura relida sem usuário";
    }
    default:
      return "ignorado";
  }
}
