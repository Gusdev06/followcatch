// Envio de vendas à UTMify pela API de credenciais (token em UTMIFY_API_TOKEN).
// A integração nativa Stripe da UTMify lê as UTMs de `client_reference_id`, que só existe em
// link/Checkout Session; aqui a cobrança é Subscription + Payment Element, por isso a API.
// A UTMify deduplica por orderId: reenviar o mesmo pedido com outro status atualiza a venda.

const ORDERS_URL = "https://api.utmify.com.br/api-credentials/orders";
const TIMEOUT_MS = 8_000;
/** Limite de valor em metadata do Stripe é 500; UTM real é bem menor. */
const MAX_TRACKING_LEN = 200;

export const TRACKING_KEYS = ["src", "sck", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type TrackingKey = (typeof TRACKING_KEYS)[number];
export type Tracking = Partial<Record<TrackingKey, string>>;
export type UtmifyStatus = "paid" | "refunded" | "chargedback";

/** Só as chaves conhecidas, como texto curto: o valor vem do navegador. */
export function cleanTracking(input: unknown): Tracking {
  const out: Tracking = {};
  if (!input || typeof input !== "object") return out;
  for (const key of TRACKING_KEYS) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value !== "string") continue;
    const clean = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_TRACKING_LEN);
    if (clean) out[key] = clean;
  }
  return out;
}

/** "YYYY-MM-DD HH:MM:SS" em UTC, formato exigido pela UTMify. */
export function utmifyDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export type OrderInput = {
  orderId: string;
  status: UtmifyStatus;
  createdAt: Date;
  approvedAt: Date;
  refundedAt?: Date | null;
  email: string;
  name: string;
  country: string;
  ip: string;
  productId: string;
  productName: string;
  planId: string | null;
  planName: string | null;
  amountCents: number;
  feeCents: number;
  currency: string;
  tracking: Tracking;
  isTest: boolean;
};

export function buildOrder(o: OrderInput) {
  return {
    orderId: o.orderId,
    platform: "FollowCatch",
    paymentMethod: "credit_card", // Apple Pay e Google Pay também liquidam como cartão
    status: o.status,
    createdAt: utmifyDate(o.createdAt),
    approvedDate: utmifyDate(o.approvedAt),
    refundedAt: o.refundedAt ? utmifyDate(o.refundedAt) : null,
    customer: { name: o.name, email: o.email, phone: null, document: null, country: o.country, ip: o.ip },
    products: [
      { id: o.productId, name: o.productName, planId: o.planId, planName: o.planName, quantity: 1, priceInCents: o.amountCents },
    ],
    trackingParameters: {
      src: o.tracking.src ?? null,
      sck: o.tracking.sck ?? null,
      utm_source: o.tracking.utm_source ?? null,
      utm_campaign: o.tracking.utm_campaign ?? null,
      utm_medium: o.tracking.utm_medium ?? null,
      utm_content: o.tracking.utm_content ?? null,
      utm_term: o.tracking.utm_term ?? null,
    },
    commission: {
      totalPriceInCents: o.amountCents,
      gatewayFeeInCents: o.feeCents,
      userCommissionInCents: o.amountCents - o.feeCents,
      currency: o.currency.toUpperCase(),
    },
    isTest: o.isTest,
  };
}

/** false = sem token (desligado). Falha lança: o webhook responde 5xx e a Stripe reenvia. */
export async function sendUtmifyOrder(order: ReturnType<typeof buildOrder>): Promise<boolean> {
  const token = process.env.UTMIFY_API_TOKEN;
  if (!token) return false;
  const res = await fetch(ORDERS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-token": token },
    body: JSON.stringify(order),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`UTMify ${order.status} ${res.status}: ${text.slice(0, 300)}`);
  }
  return true;
}
