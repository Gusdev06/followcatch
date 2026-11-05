import type { ApiError, Cycle, FollowList, Me, PlanId, Profile } from "./types";
import { getTracking } from "./utm";

export class ApiFail extends Error {
  constructor(public code: ApiError["error"], message: string, public status = 0) { super(message); }
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiFail("provider_error", "Network error");
  }
  const data = await r.json().catch(() => (r.ok ? {} : { error: r.status === 401 ? "unauthorized" : "provider_error", message: "Bad response" }));
  if (!r.ok) throw new ApiFail(data.error ?? (r.status === 401 ? "unauthorized" : "provider_error"), data.message ?? "Request failed", r.status);
  return data as T;
}
const get = <T,>(path: string) => call<T>("GET", path);
const post = <T,>(path: string, body: unknown = {}) => call<T>("POST", path, body);

export const normalizeUsername = (raw: string) => raw.trim().replace(/^@/, "").replace(/.*instagram\.com\//, "").replace(/[/?#].*$/, "").toLowerCase();
export const isValidUsername = (u: string) => /^[a-z0-9._]{1,30}$/.test(u);

/** Sessão do checkout embutido (PaymentKit.js). Valores em centavos (USD). */
export type EmbeddedCheckout = {
  ref: string;
  secureToken: string;
  hostedUrl: string;
  subtotal: number;
  discount: number;
  total: number;
  renewal: number;
  promo: { code: string; label: string } | null;
};

/** Checkout embutido do Stripe (Payment Element). Valores em centavos (USD). */
export type StripeCheckout = {
  provider: "stripe";
  ref: string;
  /** client_secret do PaymentIntent da 1ª fatura; null quando não há nada a cobrar */
  clientSecret: string | null;
  /** assinatura já ativa (cupom de 100%) */
  paid: boolean;
  amount: number;
  interval: "week" | "3 months";
  subtotal: number;
  discount: number;
  total: number;
  renewal: number;
  promo: { code: string; label: string } | null;
};

export type RecentSearch = { username: string; at: string };

export const api = {
  profile: (u: string) => get<Profile>(`/api/profile?u=${encodeURIComponent(u)}`),
  following: (u: string) => get<FollowList>(`/api/following?u=${encodeURIComponent(u)}`),
  followers: (u: string) => get<FollowList>(`/api/followers?u=${encodeURIComponent(u)}`),

  signup: (email: string, password: string) => post<Me>("/api/auth/signup", { email, password }),
  login: (email: string, password: string) => post<Me>("/api/auth/login", { email, password }),
  logout: () => post<unknown>("/api/auth/logout"),
  forgot: (email: string) => post<{ ok: true; message: string }>("/api/auth/forgot", { email }),
  resetPassword: (token: string, password: string) => post<Me>("/api/auth/reset", { token, password }),
  /** null = sem sessão (401). Outros erros sobem. */
  me: async (): Promise<Me | null> => {
    try { return await get<Me>("/api/me"); } catch (e) {
      if (e instanceof ApiFail && (e.status === 401 || e.code === "unauthorized")) return null;
      throw e;
    }
  },
  checkout: (plan: PlanId, cycle: Cycle, username?: string) => post<{ url: string }>("/api/checkout", { plan, cycle, ...(username ? { username } : {}) }),
  checkoutEmbedded: (plan: PlanId, cycle: Cycle, username?: string, promo?: string) =>
    post<EmbeddedCheckout>("/api/checkout/embedded", { plan, cycle, ...(username ? { username } : {}), ...(promo ? { promo } : {}) }),
  checkoutStripe: (plan: PlanId, cycle: Cycle, username?: string, promo?: string) =>
    post<StripeCheckout>("/api/checkout/embedded", { plan, cycle, tracking: getTracking(), ...(username ? { username } : {}), ...(promo ? { promo } : {}) }),
  welcome: (session: string) => get<Me>(`/api/welcome?session=${encodeURIComponent(session)}`),
  billingPortal: () => post<{ url: string }>("/api/billing-portal"),
  searches: () => get<{ items: RecentSearch[] }>("/api/me/searches"),
};

/** Toda foto do Instagram passa pelo proxy (CDN do IG expira e bloqueia hotlink). */
export const img = (url: string) => (url ? `/api/img?url=${encodeURIComponent(url)}` : "");
