import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { paymentLinks } from "../config/paymentkit";
import { AuthShell, Field, GoogleButton, inputCls, OrDivider, SubmitButton } from "../components/funnel/AuthShell";
import { findPlan, parseCycle, priceOf } from "../components/funnel/plan";
import { money, Spinner } from "../components/funnel/shared";
import { api, ApiFail, isValidUsername, normalizeUsername } from "../lib/api";
import { isActive, useMe, writePending } from "../lib/session";
import type { PlanId } from "../lib/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Signup() {
  const [params] = useSearchParams();
  const plan = findPlan(params.get("plan"));
  const planId: PlanId = plan.id === "starter" ? "starter" : "premium";
  const cycle = parseCycle(params.get("cycle"));
  const rawU = normalizeUsername(params.get("username") ?? "");
  const username = isValidUsername(rawU) ? rawU : "";
  const pr = priceOf(plan, cycle);
  const { me, setMe } = useMe();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<"" | "email" | "pw" | "taken" | "generic">("");
  const [busy, setBusy] = useState(false);
  const [googleNote, setGoogleNote] = useState(false);

  useEffect(() => { document.title = "Join FollowCatch"; }, []);

  const keep = `plan=${planId}&cycle=${cycle}${username ? `&username=${encodeURIComponent(username)}` : ""}`;

  /** Conta já existe/logada: cria a sessão de checkout; se a API falhar, cai no payment link. */
  const goCheckout = async (mail: string) => {
    writePending({ plan: planId, cycle, username, email: mail });
    try {
      const { url } = await api.checkout(planId, cycle, username || undefined);
      if (!url) throw new Error("no url");
      window.location.href = url;
    } catch {
      window.location.href = paymentLinks[planId][cycle];
    }
  };

  const submit = async () => {
    const mail = email.trim().toLowerCase();
    if (!EMAIL.test(mail)) return setErr("email");
    if (pw.length < 8) return setErr("pw");
    setBusy(true);
    try {
      const m = await api.signup(mail, pw);
      setMe(m);
      await goCheckout(mail);
    } catch (e) {
      setBusy(false);
      setErr(e instanceof ApiFail && e.code === "email_taken" ? "taken" : "generic");
    }
  };

  const summary = (
    <div className="mb-6 rounded-xl border border-pink-200 bg-white/80 px-4 py-3 text-left">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-ink">{plan.name} · {cycle === "weekly" ? "Weekly" : "Quarterly"}</span>
        <Link to={`/plans?cycle=${cycle}${username ? `&username=${username}` : ""}`} className="text-xs font-semibold text-brand-magenta hover:underline">Change</Link>
      </div>
      <div className="mt-0.5 text-[13px] text-gray-600">
        {money(pr.perWeek)}/week · {pr.billed}
      </div>
      {username && <div className="mt-1 text-[13px] text-gray-600">Unlocks <span className="font-semibold text-ink">@{username}</span>'s full lists</div>}
    </div>
  );

  // Já logado (ex.: veio do /login sem assinatura): só falta pagar.
  if (me && !isActive(me)) {
    return (
      <AuthShell>
        <div className="text-center">
          <h1 className="text-[28px] font-extrabold tracking-tight text-ink">Almost there</h1>
          <p className="mx-auto mt-2 max-w-xs text-[15px] text-gray-600">Signed in as <b className="text-ink">{me.email}</b>. Finish checkout to unlock the full lists.</p>
        </div>
        <div className="mt-6">{summary}</div>
        <button
          onClick={() => { setBusy(true); void goCheckout(me.email); }}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-cta px-4 py-3.5 text-base font-bold text-white shadow-[0_10px_24px_-10px_rgba(255,45,85,0.7)] transition hover:brightness-105 disabled:opacity-70"
        >
          {busy ? <><Spinner className="h-5 w-5 !text-white" /> Opening secure checkout…</> : "Continue to checkout"}
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="text-center">
        <h1 className="text-[28px] font-extrabold tracking-tight text-ink">Join FollowCatch</h1>
        <p className="mx-auto mt-2 max-w-xs text-[15px] text-gray-600">Create your account to start tracking Instagram activity.</p>
      </div>
      <div className="mt-6">{summary}</div>
      {isActive(me) && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          You already have an active plan. <Link to="/app" className="font-semibold underline">Open your dashboard</Link>
        </div>
      )}
      <GoogleButton label="Continue with Google" onClick={() => setGoogleNote(true)} />
      {googleNote && <p className="mt-2 text-center text-[13px] text-gray-600">Google sign-in is coming soon. Use your email below for now.</p>}
      <OrDivider />
      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); if (!busy) void submit(); }}
        className="space-y-4"
      >
        <Field label="Email address">
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="you@email.com" autoComplete="email" className={inputCls} />
        </Field>
        <Field label="Password">
          <div className="relative">
            <input type={show ? "text" : "password"} value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder="At least 8 characters" autoComplete="new-password" className={`${inputCls} pr-16`} />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-brand-magenta/80 hover:text-brand-magenta">
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </Field>
        {err && (
          <p className="-mt-1 text-sm text-red-500" role="alert">
            {err === "email" && "Enter a valid email address."}
            {err === "pw" && "Use at least 8 characters for your password."}
            {err === "taken" && <>That email already has an account. <Link to={`/login?${keep}`} className="font-semibold text-brand-magenta underline">Log in instead</Link></>}
            {err === "generic" && "Something went wrong creating your account. Try again in a moment."}
          </p>
        )}
        <SubmitButton disabled={busy}>{busy ? "Creating your account…" : "Create account & continue"}</SubmitButton>
      </form>
      <p className="mt-5 text-center text-[15px] text-gray-600">
        Already have an account? <Link to={`/login?${keep}`} className="font-semibold text-brand-magenta hover:underline">Log in</Link>
      </p>
      <p className="mt-4 text-center text-xs text-gray-500">
        By continuing you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </AuthShell>
  );
}
