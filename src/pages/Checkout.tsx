import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Footer, Header, PromoBar } from "../components/ui";
import { findPlan, parseCycle, priceOf } from "../components/funnel/plan";
import { Check, money, Sparkles, Spinner } from "../components/funnel/shared";
import { paymentLinks } from "../config/paymentkit";
import { site } from "../config/site";
import { api, ApiFail, isValidUsername, normalizeUsername, type EmbeddedCheckout } from "../lib/api";
import { isActive, useMe, writePending } from "../lib/session";
import type { PkErrors, PkHandle } from "../lib/paymentkit";
import type { PlanId } from "../lib/types";

// Checkout embutido (PaymentKit.js): o cartão é digitado aqui, em iframes seguros do SDK.
// Backend: POST /api/checkout/embedded → secure_token. Sucesso → /welcome?session=<ref>.
// Se o SDK não carregar, oferece a página hospedada da mesma sessão.

type CardField = "card_pan" | "card_exp" | "card_cvc";
type Phase = "session" | "fields" | "ready" | "paying";

const SEL: Record<CardField, string> = { card_pan: "#pk-card-pan", card_exp: "#pk-card-exp", card_cvc: "#pk-card-cvc" };
const LOAD_TIMEOUT_MS = 15_000;

const COUNTRIES = [
  "US", "CA", "GB", "AU", "NZ", "IE", "DE", "FR", "ES", "IT", "NL", "BE", "PT", "CH", "AT", "SE", "NO", "DK", "FI", "PL",
  "CZ", "GR", "RO", "HU", "BR", "MX", "AR", "CL", "CO", "PE", "IN", "JP", "KR", "SG", "HK", "TW", "PH", "MY", "TH", "ID",
  "VN", "AE", "SA", "IL", "TR", "ZA", "NG", "EG", "KE", "PK",
];

function regionName(code: string) {
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code; } catch { return code; }
}

function guessCountry(): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    if (region && COUNTRIES.includes(region)) return region;
  } catch { /* navegador antigo */ }
  return "US";
}

const CARD_MSG: Record<string, string> = {
  card_pan: "Enter a valid card number.",
  card_exp: "Enter a valid expiration date.",
  card_cvc: "Enter a valid security code.",
};

/** Mensagens do SDK → texto pro cliente. A mensagem de recusa (`root`) vem pronta da PaymentKit. */
function describe(errors: PkErrors): { field: Partial<Record<string, string>>; root: string } {
  const field: Partial<Record<string, string>> = {};
  for (const k of ["card_pan", "card_exp", "card_cvc"]) if (errors[k]) field[k] = CARD_MSG[k];
  if (errors.customer_name) field.name = "Enter your full name as it appears on the card.";
  if (errors.customer_zip_code) field.zip = "Enter a valid ZIP or postal code.";
  if (errors.customer_country) field.country = "Select your country.";
  if (errors.customer_email) field.root = "Your account email looks invalid. Contact support.";
  let root = typeof errors.root === "string" ? errors.root : "";
  for (const k of ["apple_pay", "google_pay"]) {
    const v = errors[k];
    if (typeof v === "string" && !/cancel/i.test(v)) root = root || v;
  }
  if (!root && field.root) root = field.root;
  return { field, root };
}

export default function Checkout() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const plan = findPlan(params.get("plan"));
  const planId: PlanId = plan.id === "starter" ? "starter" : "premium";
  const cycle = parseCycle(params.get("cycle"));
  const rawU = normalizeUsername(params.get("username") ?? "");
  const username = isValidUsername(rawU) ? rawU : "";
  const pr = priceOf(plan, cycle);
  const { me, loading } = useMe();
  const keep = `plan=${planId}&cycle=${cycle}${username ? `&username=${encodeURIComponent(username)}` : ""}`;

  const [session, setSession] = useState<EmbeddedCheckout | null>(null);
  const [sessionErr, setSessionErr] = useState(false);
  const [phase, setPhase] = useState<Phase>("session");
  const [sdkFailed, setSdkFailed] = useState(false);
  const [loaded, setLoaded] = useState<Record<CardField, boolean>>({ card_pan: false, card_exp: false, card_cvc: false });
  const [focus, setFocus] = useState<CardField | null>(null);
  const [wallets, setWallets] = useState({ apple: false, google: false });

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState(guessCountry);
  const [fieldErr, setFieldErr] = useState<Partial<Record<string, string>>>({});
  const [rootErr, setRootErr] = useState("");

  const [couponOpen, setCouponOpen] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponErr, setCouponErr] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);

  const pkRef = useRef<PkHandle | null>(null);

  useEffect(() => {
    document.title = "Checkout | FollowCatch";
    // aquece o SDK e o Stripe.js enquanto a sessão é criada no backend
    void import("../lib/paymentkit").then((m) => m.loadStripeJs()).catch(() => undefined);
  }, []);

  const ready = !!me && !isActive(me);

  // 1) sessão no backend
  const openSession = useCallback(async (promo?: string) => {
    const s = await api.checkoutEmbedded(planId, cycle, username || undefined, promo);
    setSession(s);
    return s;
  }, [planId, cycle, username]);

  useEffect(() => {
    if (!ready) return;
    writePending({ plan: planId, cycle, username, email: me?.email });
    openSession().catch(() => setSessionErr(true));
  }, [ready, openSession, planId, cycle, username, me?.email]);

  // 2) SDK com o token da sessão (remonta quando o cupom troca a sessão)
  const token = session?.secureToken;
  useEffect(() => {
    if (!token) return;
    let disposed = false;
    let unmount: (() => void) | null = null;
    let handle: PkHandle | null = null;
    setPhase("fields");
    setSdkFailed(false);
    setLoaded({ card_pan: false, card_exp: false, card_cvc: false });
    setWallets({ apple: false, google: false });
    const timer = window.setTimeout(() => { if (!disposed) setSdkFailed(true); }, LOAD_TIMEOUT_MS);

    (async () => {
      try {
        const mod = await import("../lib/paymentkit");
        await mod.loadStripeJs();
        if (disposed) return;
        handle = mod.createPaymentKit(token);
        pkRef.current = handle;
        unmount = handle.mountCard(SEL, {
          onLoaded: (f) => { if (!disposed) setLoaded((l) => ({ ...l, [f]: true })); },
          onFocus: (f, on) => { if (!disposed) setFocus((cur) => (on ? f : cur === f ? null : cur)); },
        });
        handle.onWalletReady((w) => { if (!disposed) setWallets(w); });
      } catch (e) {
        console.error("[checkout] PaymentKit.js failed to load", e);
        if (!disposed) setSdkFailed(true);
      }
    })();

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      try { unmount?.(); } catch { /* já desmontado */ }
      try { handle?.cleanup(); } catch { /* idem */ }
      if (pkRef.current === handle) pkRef.current = null;
    };
  }, [token]);

  const fieldsReady = loaded.card_pan && loaded.card_exp && loaded.card_cvc;
  useEffect(() => { if (fieldsReady && phase === "fields") setPhase("ready"); }, [fieldsReady, phase]);
  useEffect(() => { if (fieldsReady) setSdkFailed(false); }, [fieldsReady]);

  const succeed = useCallback(() => {
    if (!session) return;
    nav(`/welcome?session=${encodeURIComponent(session.ref)}`, { replace: true });
  }, [nav, session]);

  const payCard = async () => {
    const h = pkRef.current;
    if (!h || !me || phase !== "ready") return;
    const errs: Partial<Record<string, string>> = {};
    if (!first.trim()) errs.first = "Required";
    if (!last.trim()) errs.last = "Required";
    if (!zip.trim()) errs.zip = "Required";
    setRootErr("");
    if (Object.keys(errs).length) return setFieldErr(errs);
    setFieldErr({});
    setPhase("paying");
    const r = await h.submitCard({ name: `${first.trim()} ${last.trim()}`, email: me.email, country, zip: zip.trim() });
    if (r.ok) return succeed();
    const d = describe(r.errors);
    setFieldErr(d.field);
    setRootErr(d.root || (Object.keys(d.field).length ? "" : "Payment failed. Check your details or try another card."));
    setPhase("ready");
  };

  const payWallet = async (kind: "apple_pay" | "google_pay") => {
    const h = pkRef.current;
    if (!h || !me || phase !== "ready") return;
    setRootErr("");
    setPhase("paying");
    const local = me.email.split("@")[0] || "Customer";
    const r = await h.submitWallet(kind, { first: first.trim() || local, last: last.trim() || "Customer", email: me.email });
    if (r.ok) return succeed();
    setRootErr(describe(r.errors).root);
    setPhase("ready");
  };

  const applyCoupon = async () => {
    const code = coupon.trim();
    if (!code) return setCouponErr("Enter a code.");
    setCouponBusy(true);
    setCouponErr("");
    try {
      await openSession(code);
      setCouponOpen(false);
    } catch (e) {
      setCouponErr(e instanceof ApiFail && e.code === "invalid" ? e.message || "That code isn't valid." : "Couldn't apply the code. Try again.");
    } finally {
      setCouponBusy(false);
    }
  };

  const removeCoupon = async () => {
    setCouponBusy(true);
    try { await openSession(); setCoupon(""); } catch { setRootErr("Couldn't remove the code. Refresh the page."); } finally { setCouponBusy(false); }
  };

  const hostedFallback = session?.hostedUrl ?? paymentLinks[planId][cycle];
  const totalToday = session ? session.total / 100 : pr.total;
  const renewal = session ? session.renewal / 100 : pr.total;
  const cadence = cycle === "weekly" ? "week" : "3 months";

  const walletAny = wallets.apple || wallets.google;
  const busy = phase === "paying";
  const disabled = phase !== "ready";

  const header = useMemo(() => (
    <div className="border-b border-gray-100 pb-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink sm:text-2xl">{plan.name} Plan</h1>
          <p className="mt-1 text-[15px] text-gray-600">
            {planId === "premium" ? "Get started & enjoy unlimited access" : "Get started & track up to 2 accounts"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[22px] font-extrabold leading-none text-ink sm:text-2xl">
            {money(pr.perWeek).replace(/\.00$/, "")}<span className="text-sm font-semibold text-gray-500"> / week</span>
          </div>
          {cycle === "quarterly" && <div className="mt-1 text-xs text-gray-500">{money(pr.total)} every 3 months</div>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600"><Check className="h-4 w-4" /> Cancel anytime</span>
        {username && <span className="text-sm text-gray-600">Unlocks <b className="text-ink">@{username}</b>'s full lists</span>}
      </div>
      <div className="mt-2 text-xs">
        <Link to={`/plans?${keep}`} className="font-semibold text-brand-magenta hover:underline">Change plan</Link>
      </div>
    </div>
  ), [plan.name, planId, pr.perWeek, pr.total, cycle, username, keep]);

  // ---- portões de sessão ----
  if (loading) return <Shell><div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div></Shell>;
  if (!me) return <Navigate to={`/signup?${keep}`} replace />;
  if (isActive(me)) {
    return (
      <Shell>
        <div className="py-6 text-center">
          <h1 className="text-2xl font-extrabold text-ink">You're already subscribed</h1>
          <p className="mt-2 text-[15px] text-gray-600">Your plan is active on <b className="text-ink">{me.email}</b>.</p>
          <Link to="/app" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-cta px-4 py-3.5 font-bold text-white">Open dashboard</Link>
        </div>
      </Shell>
    );
  }

  if (sessionErr) {
    return (
      <Shell>
        {header}
        <div className="py-6 text-center">
          <p className="text-[15px] text-gray-700">We couldn't start the secure checkout here.</p>
          <a href={hostedFallback} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-cta px-4 py-3.5 font-bold text-white">Continue to secure checkout</a>
        </div>
      </Shell>
    );
  }

  const box = (f: CardField, err?: string) =>
    `relative h-[50px] rounded-xl border-2 bg-white px-4 py-[13px] transition ${err ? "border-red-300" : focus === f ? "border-pink-300 ring-4 ring-pink-100" : "border-gray-200"}`;

  return (
    <Shell>
      {header}

      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); void payCard(); }}
        className="pt-5"
        aria-busy={busy}
      >
        {/* Express (só aparece quando o SDK confirma Apple Pay / Google Pay neste aparelho) */}
        {walletAny && (
          <div className="mb-5">
            <div className="grid gap-2.5">
              {wallets.apple && (
                <button type="button" disabled={disabled} onClick={() => void payWallet("apple_pay")} className="flex h-12 items-center justify-center gap-1 rounded-xl bg-black text-[17px] font-semibold text-white transition hover:bg-gray-900 disabled:opacity-60" aria-label="Pay with Apple Pay">
                  <AppleGlyph /> Pay
                </button>
              )}
              {wallets.google && (
                <button type="button" disabled={disabled} onClick={() => void payWallet("google_pay")} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-black text-[17px] font-semibold text-white transition hover:bg-gray-900 disabled:opacity-60" aria-label="Pay with Google Pay">
                  <GoogleG /> Pay
                </button>
              )}
            </div>
            <div className="relative my-5 text-center">
              <span className="absolute inset-x-0 top-1/2 h-px bg-gray-200" />
              <span className="relative bg-white px-3 text-[13px] font-medium text-gray-500">or pay with card</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Labeled label="First Name" err={fieldErr.first}>
            <input value={first} onChange={(e) => { setFirst(e.target.value); setFieldErr((x) => ({ ...x, first: undefined, name: undefined })); }} autoComplete="cc-given-name" placeholder="First name" className={inputCls(!!fieldErr.first || !!fieldErr.name)} />
          </Labeled>
          <Labeled label="Last Name" err={fieldErr.last}>
            <input value={last} onChange={(e) => { setLast(e.target.value); setFieldErr((x) => ({ ...x, last: undefined, name: undefined })); }} autoComplete="cc-family-name" placeholder="Last name" className={inputCls(!!fieldErr.last || !!fieldErr.name)} />
          </Labeled>
        </div>
        {fieldErr.name && <p className="mt-1.5 text-[13px] text-red-500">{fieldErr.name}</p>}

        <div className="mt-4">
          <Labeled label="Card Information" err={fieldErr.card_pan}>
            <div className={box("card_pan", fieldErr.card_pan)}>
              <div id="pk-card-pan" className="h-full w-full" />
              {!loaded.card_pan && <FieldSkeleton />}
            </div>
          </Labeled>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Labeled err={fieldErr.card_exp} srLabel="Expiration date (MM/YY)">
            <div className={box("card_exp", fieldErr.card_exp)}>
              <div id="pk-card-exp" className="h-full w-full" />
              {!loaded.card_exp && <FieldSkeleton />}
            </div>
          </Labeled>
          <Labeled err={fieldErr.card_cvc} srLabel="Security code (CVV)">
            <div className={box("card_cvc", fieldErr.card_cvc)}>
              <div id="pk-card-cvc" className="h-full w-full" />
              {!loaded.card_cvc && <FieldSkeleton />}
            </div>
          </Labeled>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Labeled label="ZIP Code" err={fieldErr.zip}>
            <input value={zip} onChange={(e) => { setZip(e.target.value); setFieldErr((x) => ({ ...x, zip: undefined })); }} autoComplete="postal-code" inputMode="text" placeholder="ZIP / Postal" maxLength={12} className={inputCls(!!fieldErr.zip)} />
          </Labeled>
          <Labeled label="Country" err={fieldErr.country}>
            <select value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="country" className={`${inputCls(!!fieldErr.country)} appearance-none bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-8`} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7280' stroke-width='1.8' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")" }}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{regionName(c)}</option>)}
            </select>
          </Labeled>
        </div>

        {/* Cupom: aplica criando uma nova sessão com promotion_code (API de checkout sessions) */}
        <div className="mt-4">
          {session?.promo ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm">
              <span className="min-w-0 text-emerald-800"><b className="font-mono">{session.promo.code}</b> · {session.promo.label}</span>
              <button type="button" onClick={() => void removeCoupon()} disabled={couponBusy || busy} className="shrink-0 font-semibold text-emerald-800 underline disabled:opacity-60">Remove</button>
            </div>
          ) : couponOpen ? (
            <div>
              <div className="flex gap-2">
                <input value={coupon} onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setCouponErr(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void applyCoupon(); } }} placeholder="Coupon code" autoComplete="off" autoCapitalize="characters" aria-label="Coupon code" className={`${inputCls(!!couponErr)} min-w-0 flex-1 font-mono uppercase`} />
                <button type="button" onClick={() => void applyCoupon()} disabled={couponBusy || busy} className="shrink-0 rounded-xl border-2 border-pink-200 bg-white px-4 text-sm font-bold text-brand-magenta transition hover:border-pink-300 disabled:opacity-60">
                  {couponBusy ? <Spinner className="h-4 w-4" /> : "Apply"}
                </button>
              </div>
              {couponErr && <p className="mt-1.5 text-[13px] text-red-500" role="alert">{couponErr}</p>}
            </div>
          ) : (
            <button type="button" onClick={() => setCouponOpen(true)} className="text-sm font-semibold text-brand-magenta hover:underline">Have a coupon code?</button>
          )}
        </div>

        {session && session.discount > 0 && (
          <dl className="mt-4 space-y-1 rounded-xl bg-gray-50 px-4 py-3 text-sm">
            <div className="flex justify-between text-gray-600"><dt>Subtotal</dt><dd>{money(session.subtotal / 100)}</dd></div>
            <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>−{money(session.discount / 100)}</dd></div>
            <div className="flex justify-between font-bold text-ink"><dt>Due today</dt><dd>{money(session.total / 100)}</dd></div>
          </dl>
        )}

        <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3 text-[13px] font-medium text-gray-600">
          <LockIcon /> Your payment information is encrypted and secure
        </div>

        {rootErr && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{rootErr}</div>
        )}

        <button
          type="submit"
          disabled={disabled}
          aria-busy={busy}
          className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-cta text-[17px] font-bold text-white shadow-[0_14px_30px_-12px_rgba(255,45,85,0.75)] transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? <><Spinner className="h-5 w-5 !text-white" /> Processing…</> : phase === "ready" ? "Get Started" : <><Spinner className="h-5 w-5 !text-white" /> Loading secure checkout…</>}
        </button>

        <p className="mt-3 text-center text-xs leading-relaxed text-gray-500">
          You'll be charged {money(totalToday)} today, then {money(renewal)} every {cadence} until you cancel.
          {" "}By subscribing you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/refund-policy" className="underline">Refund Policy</Link>.
        </p>

        {sdkFailed && !fieldsReady && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900" role="status">
            The card form is taking longer than usual.{" "}
            <a href={hostedFallback} className="font-semibold underline">Pay on our secure checkout page instead</a>
          </div>
        )}
      </form>
      <p className="mt-4 text-center text-xs text-gray-500">Signed in as {me.email} · <a href={`mailto:${site.supportEmail}`} className="underline">Help</a></p>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#f3ecff] via-[#fdeef6] to-[#fff3ea]">
      <PromoBar />
      <Header />
      <main className="relative isolate flex flex-1 items-start justify-center px-4 py-8 sm:py-14">
        <Sparkles />
        <div className="w-full max-w-[480px] rounded-[24px] bg-white p-5 shadow-[0_30px_80px_-40px_rgba(124,58,237,0.45)] ring-1 ring-black/[0.03] sm:p-8">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}

const inputCls = (err: boolean) =>
  `h-[50px] w-full rounded-xl border-2 bg-white px-4 text-base text-ink outline-none transition placeholder:text-gray-400 focus:border-pink-300 focus:ring-4 focus:ring-pink-100 ${err ? "border-red-300" : "border-gray-200"}`;

function Labeled({ label, srLabel, err, children }: { label?: string; srLabel?: string; err?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      {label ? (
        <span className="mb-1.5 block text-sm font-semibold text-gray-700">{label}<span className="text-brand-pink">*</span></span>
      ) : (
        <span className="sr-only">{srLabel}</span>
      )}
      {children}
      {err && err !== "Required" && <p className="mt-1.5 text-[13px] text-red-500">{err}</p>}
    </div>
  );
}

function FieldSkeleton() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center rounded-xl bg-white px-4" aria-hidden>
      <span className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-gray-500" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M10 2a4 4 0 0 0-4 4v2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1V6a4 4 0 0 0-4-4zm2 6V6a2 2 0 1 0-4 0v2h4z" clipRule="evenodd" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="currentColor" d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8C6.9 7.4 5.4 8.3 4.6 9.8c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.4 3 2.4 1.2 0 1.6-.8 3.1-.8s1.8.8 3.1.8 2.1-1.2 2.9-2.4c.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.8-1-2.8-4.1zM14.1 5.6c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3z" />
    </svg>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-7.9z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}
