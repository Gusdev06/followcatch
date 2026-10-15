import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Footer, Header } from "../components/ui";
import { isMock, mockApi } from "../components/funnel/mock";
import { Sparkles, Spinner } from "../components/funnel/shared";
import { site } from "../config/site";
import { api } from "../lib/api";
import { isActive, readPending, useMe } from "../lib/session";
import type { Me } from "../lib/types";

type State = { s: "loading" } | { s: "ok"; me: Me } | { s: "error" } | { s: "failed" };

const planName = (me: Me) => site.plans.find((p) => p.id === me.plan)?.name ?? "FollowCatch";

// Volta do checkout (Stripe: ?ref=ck_…&payment_intent=…&redirect_status=…; PaymentKit: ?session=…):
// confere no provedor na hora (não espera o webhook).
export default function Welcome() {
  const [params] = useSearchParams();
  const session = params.get("ref") ?? params.get("session") ?? params.get("session_id") ?? "";
  const failed = params.get("redirect_status") === "failed";
  const { setMe } = useMe();
  const [state, setState] = useState<State>({ s: "loading" });
  const pendingU = readPending().username ?? "";

  const check = useCallback(async () => {
    if (failed) return setState({ s: "failed" });
    setState({ s: "loading" });
    try {
      let me: Me | null;
      if (isMock()) me = await mockApi.welcome(session);
      else if (session) me = await api.welcome(session);
      else me = await api.me(); // payment link antigo volta sem session: confia no webhook
      if (!me || !isActive(me)) throw new Error("not active yet");
      setMe(me);
      setState({ s: "ok", me });
    } catch {
      setState({ s: "error" });
    }
  }, [session, setMe, failed]);

  useEffect(() => { document.title = "Welcome to FollowCatch"; void check(); }, [check]);

  const pend = readPending();
  const retry = `/checkout?plan=${pend.plan ?? "premium"}&cycle=${pend.cycle ?? "weekly"}${pendingU ? `&username=${encodeURIComponent(pendingU)}` : ""}`;
  const dash = `/app${pendingU ? `?u=${encodeURIComponent(pendingU)}` : ""}${isMock() ? `${pendingU ? "&" : "?"}mock=1` : ""}`;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="relative isolate flex flex-1 items-start justify-center px-4 py-12 sm:py-16">
        <Sparkles />
        <div className="w-full max-w-[448px] rounded-[22px] border border-pink-200 bg-gradient-to-br from-[#f6efff] via-[#fff0f5] to-[#fff6ec] p-6 text-center shadow-[0_30px_70px_-35px_rgba(225,48,108,0.45)] sm:p-8" role="status" aria-live="polite">
          {state.s === "loading" && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm"><Spinner className="h-8 w-8" /></div>
              <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">Confirming your payment…</h1>
              <p className="mt-2 text-[15px] text-gray-600">This usually takes a few seconds. Please keep this page open.</p>
            </>
          )}
          {state.s === "ok" && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cta text-3xl text-white shadow-lg" aria-hidden>✓</div>
              <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-ink">You're in!</h1>
              <p className="mt-3 text-[15px] text-gray-600">
                Your <b className="text-ink">{planName(state.me)}</b>{state.me.cycle ? ` (${state.me.cycle})` : ""} plan is active for <b className="text-ink">{state.me.email}</b>.
              </p>
              <p className="mt-1 text-[15px] text-gray-600">
                {pendingU ? <>Full lists for <b className="text-ink">@{pendingU}</b> are ready.</> : "Full following and follower lists are unlocked."}
              </p>
              <Button href={dash} className="mt-7 w-full !rounded-xl !py-3.5 text-base">Open dashboard</Button>
            </>
          )}
          {state.s === "failed" && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-sm" aria-hidden>!</div>
              <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">Payment didn't go through</h1>
              <p className="mt-2 text-[15px] text-gray-600">You weren't charged. Try again or use another payment method.</p>
              <Button href={retry} className="mt-7 w-full !rounded-xl !py-3.5 text-base">Try again</Button>
            </>
          )}
          {state.s === "error" && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-sm" aria-hidden>⏳</div>
              <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">We're confirming your payment</h1>
              <p className="mt-2 text-[15px] text-gray-600">Refresh in a minute. If you were charged, your plan will turn on automatically.</p>
              <Button onClick={() => void check()} className="mt-7 w-full !rounded-xl !py-3.5 text-base">Refresh</Button>
              <p className="mt-5 text-xs text-gray-500">Still stuck after a few minutes? <a className="underline" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a></p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
