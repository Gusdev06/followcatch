import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { loadStripe, type Appearance, type Stripe, type StripeElementsOptions, type StripeExpressCheckoutElementClickEvent } from "@stripe/stripe-js";
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Footer, Header, PromoBar } from "../components/ui";
import { findPlan, parseCycle, priceOf } from "../components/funnel/plan";
import { Check, money, Sparkles, Spinner } from "../components/funnel/shared";
import { site } from "../config/site";
import { api, ApiFail, isValidUsername, normalizeUsername, type StripeCheckout } from "../lib/api";
import { isActive, useMe, writePending } from "../lib/session";
import type { Cycle, Me, PlanId } from "../lib/types";

// Checkout embutido com Stripe direto (Payment Element). Backend: POST /api/checkout/embedded
// cria a assinatura `incomplete` e devolve o client_secret da 1ª fatura; confirmPayment cobra
// e volta em /welcome?ref=<ref>. O checkout antigo (PaymentKit.js) só carrega com
// VITE_PAYMENT_PROVIDER=paymentkit.

const CheckoutPaymentKit = lazy(() => import("./CheckoutPaymentKit"));
const USE_PAYMENTKIT = import.meta.env.VITE_PAYMENT_PROVIDER === "paymentkit";

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
  if (!key) return Promise.resolve(null);
  stripePromise ??= loadStripe(key);
  return stripePromise;
};

const appearance: Appearance = {
  theme: "stripe",
  variables: {
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    fontSizeBase: "16px",
    borderRadius: "12px",
    colorPrimary: "#ff2d55",
    colorText: "#111827",
    colorTextSecondary: "#4b5563",
    colorTextPlaceholder: "#9ca3af",
    colorDanger: "#ef4444",
    colorBackground: "#ffffff",
    spacingUnit: "4px",
    gridRowSpacing: "14px",
    gridColumnSpacing: "12px",
  },
  rules: {
    ".Label": { fontWeight: "600", fontSize: "14px", color: "#374151", marginBottom: "6px" },
    ".Input": { border: "2px solid #e5e7eb", boxShadow: "none", padding: "12px 14px" },
    ".Input:focus": { border: "2px solid #f9a8d4", boxShadow: "0 0 0 4px #fce7f3" },
    ".Input--invalid": { border: "2px solid #fca5a5", boxShadow: "none" },
    ".Error": { fontSize: "13px" },
    ".Tab": { border: "2px solid #e5e7eb", boxShadow: "none" },
    ".Tab--selected": { border: "2px solid #ff2d55", boxShadow: "0 0 0 3px #ffe4ea" },
  },
};
const FONTS: StripeElementsOptions["fonts"] = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" }];

export default function Checkout() {
  if (USE_PAYMENTKIT) {
    return (
      <Suspense fallback={<Shell><div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div></Shell>}>
        <CheckoutPaymentKit />
      </Suspense>
    );
  }
  return <CheckoutStripe />;
}

function CheckoutStripe() {
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

  const [session, setSession] = useState<StripeCheckout | null>(null);
  const [sessionErr, setSessionErr] = useState(false);

  const [couponOpen, setCouponOpen] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponErr, setCouponErr] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    document.title = "Checkout | FollowCatch";
    void getStripe(); // aquece o Stripe.js enquanto a assinatura é criada no backend
  }, []);

  const ready = !!me && !isActive(me);

  const openSession = useCallback(async (promo?: string) => {
    const s = await api.checkoutStripe(planId, cycle, username || undefined, promo);
    setSession(s);
    return s;
  }, [planId, cycle, username]);

  useEffect(() => {
    if (!ready) return;
    writePending({ plan: planId, cycle, username, email: me?.email });
    openSession().catch(() => setSessionErr(true));
  }, [ready, openSession, planId, cycle, username, me?.email]);

  // cupom de 100%: a assinatura já nasce ativa
  useEffect(() => {
    if (session?.paid) nav(`/welcome?ref=${encodeURIComponent(session.ref)}`, { replace: true });
  }, [session, nav]);

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
    try { await openSession(); setCoupon(""); } catch { setCouponErr("Couldn't remove the code. Refresh the page."); } finally { setCouponBusy(false); }
  };

  const totalToday = session ? session.total / 100 : pr.total;
  const renewal = session ? session.renewal / 100 : pr.total;
  const cadence = cycle === "weekly" ? "week" : "3 months";

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

  const options = useMemo<StripeElementsOptions | null>(
    () => (session?.clientSecret ? { clientSecret: session.clientSecret, appearance, fonts: FONTS, loader: "never" } : null),
    [session?.clientSecret],
  );

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

  if (sessionErr || (session && !session.clientSecret && !session.paid)) {
    return (
      <Shell>
        {header}
        <div className="py-6 text-center" role="alert">
          <p className="text-[15px] text-gray-700">We couldn't start the secure checkout. Please try again in a moment.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-cta px-4 py-3.5 font-bold text-white">Try again</button>
          <p className="mt-4 text-xs text-gray-500">Still stuck? <a href={`mailto:${site.supportEmail}`} className="underline">{site.supportEmail}</a></p>
        </div>
      </Shell>
    );
  }

  const couponBlock = (
    <>
      <div className="mt-4">
        {session?.promo ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm">
            <span className="min-w-0 text-emerald-800"><b className="font-mono">{session.promo.code}</b> · {session.promo.label}</span>
            <button type="button" onClick={() => void removeCoupon()} disabled={couponBusy || paying} className="shrink-0 font-semibold text-emerald-800 underline disabled:opacity-60">Remove</button>
          </div>
        ) : couponOpen ? (
          <div>
            <div className="flex gap-2">
              <input value={coupon} onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setCouponErr(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void applyCoupon(); } }} placeholder="Coupon code" autoComplete="off" autoCapitalize="characters" aria-label="Coupon code" className={`${inputCls(!!couponErr)} min-w-0 flex-1 font-mono uppercase`} />
              <button type="button" onClick={() => void applyCoupon()} disabled={couponBusy || paying} className="shrink-0 rounded-xl border-2 border-pink-200 bg-white px-4 text-sm font-bold text-brand-magenta transition hover:border-pink-300 disabled:opacity-60">
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
    </>
  );

  const fine = (
    <p className="mt-3 text-center text-xs leading-relaxed text-gray-500">
      You'll be charged {money(totalToday)} today, then {money(renewal)} every {cadence} until you cancel.
      {" "}By subscribing you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/refund-policy" className="underline">Refund Policy</Link>.
    </p>
  );

  return (
    <Shell>
      {header}
      {options && session ? (
        <Elements key={session.clientSecret} stripe={getStripe()} options={options}>
          <PayForm
            me={me}
            session={session}
            planName={plan.name}
            cycle={cycle}
            couponBlock={couponBlock}
            fine={fine}
            onPaying={setPaying}
            couponBusy={couponBusy}
          />
        </Elements>
      ) : (
        <div className="pt-5">
          <FormSkeleton />
          {couponBlock}
          <Encrypted />
          <button type="button" disabled className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-cta text-[17px] font-bold text-white opacity-70">
            <Spinner className="h-5 w-5 !text-white" /> Loading secure checkout…
          </button>
          {fine}
        </div>
      )}
      <p className="mt-4 text-center text-xs text-gray-500">Signed in as {me.email} · <a href={`mailto:${site.supportEmail}`} className="underline">Help</a></p>
    </Shell>
  );
}

function PayForm({
  me, session, planName, cycle, couponBlock, fine, onPaying, couponBusy,
}: {
  me: Me; session: StripeCheckout; planName: string; cycle: Cycle; couponBlock: ReactNode; fine: ReactNode;
  onPaying: (b: boolean) => void; couponBusy: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const nav = useNavigate();
  const [elReady, setElReady] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const [wallets, setWallets] = useState(false);
  const [name, setName] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [rootErr, setRootErr] = useState("");
  const [busy, setBusy] = useState(false);

  const returnUrl = `${window.location.origin}/welcome?ref=${encodeURIComponent(session.ref)}`;
  const setPaying = (b: boolean) => { setBusy(b); onPaying(b); };

  const finish = (status: string | undefined) => {
    if (status === "succeeded" || status === "processing" || status === "requires_capture") {
      nav(`/welcome?ref=${encodeURIComponent(session.ref)}`, { replace: true });
      return true;
    }
    return false;
  };

  const pay = async () => {
    if (!stripe || !elements || busy) return;
    setRootErr("");
    const n = name.trim();
    if (n.length < 2) {
      setNameErr("Enter your name as it appears on the card.");
      return;
    }
    setPaying(true);
    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setPaying(false);
      return; // o Element já mostra o erro no campo
    }
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
        payment_method_data: { billing_details: { name: n, email: me.email } },
      },
      redirect: "if_required",
    });
    if (!error && finish(paymentIntent?.status)) return;
    setRootErr(
      error
        ? error.type === "card_error" || error.type === "validation_error"
          ? error.message ?? "Your card was declined."
          : "Payment failed. Check your details or try another card."
        : "Payment needs another step. Please try again.",
    );
    setPaying(false);
  };

  const onExpressClick = (ev: StripeExpressCheckoutElementClickEvent) => {
    const quarterly = cycle === "quarterly";
    ev.resolve({
      applePay: {
        recurringPaymentRequest: {
          paymentDescription: `FollowCatch ${planName}`,
          managementURL: `${window.location.origin}/app`,
          regularBilling: {
            amount: session.renewal,
            label: `FollowCatch ${planName}`,
            recurringPaymentIntervalUnit: quarterly ? "month" : "day",
            recurringPaymentIntervalCount: quarterly ? 3 : 7,
          },
        },
      },
    });
  };

  const onExpressConfirm = async () => {
    if (!stripe || !elements) return;
    setRootErr("");
    setPaying(true);
    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setRootErr(submitErr.message ?? "Payment failed.");
      setPaying(false);
      return;
    }
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl, payment_method_data: { billing_details: { email: me.email } } },
      redirect: "if_required",
    });
    if (!error && finish(paymentIntent?.status)) return;
    setRootErr(error?.message ?? "Payment failed. Try another method.");
    setPaying(false);
  };

  const disabled = !stripe || !elReady || busy || couponBusy;

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); void pay(); }} className="pt-5" aria-busy={busy}>
      {/* Apple Pay / Google Pay: só aparecem quando o aparelho suporta */}
      <div className={wallets ? "mb-5" : "hidden"}>
        <ExpressCheckoutElement
          onReady={(e) => setWallets(!!e.availablePaymentMethods && Object.values(e.availablePaymentMethods).some(Boolean))}
          onClick={onExpressClick}
          onConfirm={() => void onExpressConfirm()}
          options={{
            buttonHeight: 48,
            buttonType: { applePay: "subscribe", googlePay: "subscribe" },
            paymentMethods: { applePay: "auto", googlePay: "auto", link: "never", amazonPay: "never", paypal: "never", klarna: "never" },
            layout: { maxColumns: 1, maxRows: 2 },
          }}
        />
        <div className="relative mt-5 text-center">
          <span className="absolute inset-x-0 top-1/2 h-px bg-gray-200" />
          <span className="relative bg-white px-3 text-[13px] font-medium text-gray-500">or pay with card</span>
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-gray-700">Name on card<span className="text-brand-pink">*</span></span>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setNameErr(""); }}
          autoComplete="cc-name"
          placeholder="Full name"
          className={inputCls(!!nameErr)}
        />
      </label>
      {nameErr && <p className="mt-1.5 text-[13px] text-red-500">{nameErr}</p>}

      <div className="relative mt-4 min-h-[190px]">
        {!elReady && !loadErr && <div className="absolute inset-0"><FormSkeleton compact /></div>}
        <div className={elReady ? "" : "opacity-0"}>
          <PaymentElement
            onReady={() => setElReady(true)}
            onLoadError={() => setLoadErr(true)}
            options={{
              layout: { type: "tabs" },
              wallets: { applePay: "never", googlePay: "never" },
              fields: { billingDetails: { email: "never", name: "never" } },
              business: { name: "FollowCatch" },
            }}
          />
        </div>
        {loadErr && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900" role="alert">
            The secure card form didn't load. <button type="button" className="font-semibold underline" onClick={() => window.location.reload()}>Reload the page</button>
          </div>
        )}
      </div>

      {couponBlock}
      <Encrypted />

      {rootErr && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{rootErr}</div>
      )}

      <button
        type="submit"
        disabled={disabled}
        aria-busy={busy}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-cta text-[17px] font-bold text-white shadow-[0_14px_30px_-12px_rgba(255,45,85,0.75)] transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {busy ? <><Spinner className="h-5 w-5 !text-white" /> Processing…</> : elReady ? "Get Started" : <><Spinner className="h-5 w-5 !text-white" /> Loading secure checkout…</>}
      </button>
      {fine}
    </form>
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

function Encrypted() {
  return (
    <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3 text-[13px] font-medium text-gray-600">
      <LockIcon /> Your payment information is encrypted and secure
    </div>
  );
}

function FormSkeleton({ compact = false }: { compact?: boolean }) {
  const bar = (w: string) => <span className={`block h-[50px] ${w} animate-pulse rounded-xl border-2 border-gray-100 bg-gray-50`} />;
  return (
    <div className="space-y-3" aria-hidden>
      {!compact && <><span className="block h-4 w-28 animate-pulse rounded bg-gray-100" />{bar("w-full")}</>}
      <span className="block h-4 w-32 animate-pulse rounded bg-gray-100" />
      {bar("w-full")}
      <div className="grid grid-cols-2 gap-3">{bar("w-full")}{bar("w-full")}</div>
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
