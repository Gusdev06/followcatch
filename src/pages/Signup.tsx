import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { paymentLinks } from "../config/paymentkit";
import { AuthShell, Field, GoogleButton, inputCls, OrDivider, SubmitButton } from "../components/funnel/AuthShell";
import { findPlan, parseCycle, priceOf } from "../components/funnel/plan";
import { money } from "../components/funnel/shared";
import { isValidUsername, normalizeUsername } from "../lib/api";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Signup() {
  const [params] = useSearchParams();
  const plan = findPlan(params.get("plan"));
  const cycle = parseCycle(params.get("cycle"));
  const rawU = normalizeUsername(params.get("username") ?? "");
  const username = isValidUsername(rawU) ? rawU : "";
  const pr = priceOf(plan, cycle);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { document.title = "Join FollowCatch"; }, []);

  const finish = () => {
    // Ainda sem conta no servidor: guarda a escolha neste navegador e manda pro checkout hospedado da PaymentKit.
    try { localStorage.setItem("fc_pending_plan", JSON.stringify({ plan: plan.id, cycle, username, email: email.trim() })); } catch { /* sem storage */ }
    const id = plan.id === "starter" ? "starter" : "premium";
    window.location.href = paymentLinks[id][cycle === "quarterly" ? "quarterly" : "weekly"];
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

  return (
    <AuthShell>
      {(
        <>
          <div className="text-center">
            <h1 className="text-[28px] font-extrabold tracking-tight text-ink">Join FollowCatch</h1>
            <p className="mx-auto mt-2 max-w-xs text-[15px] text-gray-600">Create your account to start tracking Instagram activity.</p>
          </div>
          <div className="mt-6">{summary}</div>
          <GoogleButton label="Continue with Google" onClick={finish} />
          <OrDivider />
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!EMAIL.test(email.trim())) return setErr("Enter a valid email address.");
              finish();
            }}
            className="space-y-4"
          >
            <Field label="Email address">
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="you@email.com" autoComplete="email" className={inputCls} />
            </Field>
            {err && <p className="-mt-2 text-sm text-red-500">{err}</p>}
            <SubmitButton>Continue with Email</SubmitButton>
          </form>
          <p className="mt-5 text-center text-[15px] text-gray-600">
            Already have an account? <Link to="/login" className="font-semibold text-brand-magenta hover:underline">Sign in</Link>
          </p>
          <p className="mt-4 text-center text-xs text-gray-500">
            By continuing you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.
          </p>
        </>
      )}
    </AuthShell>
  );
}
