import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell, ComingSoon, Field, GoogleButton, inputCls, OrDivider, SubmitButton } from "../components/funnel/AuthShell";
import { api, ApiFail, isValidUsername, normalizeUsername } from "../lib/api";
import { isActive, readPending, useMe } from "../lib/session";
import type { Me } from "../lib/types";

type Notice = null | "google";

/** Pra onde vai depois de logar: assinante → /app; sem assinatura → checkout do plano escolhido ou /plans. */
export function afterLoginPath(me: Me, params: URLSearchParams): string {
  const pending = readPending();
  const rawU = normalizeUsername(params.get("username") ?? pending.username ?? "");
  const u = isValidUsername(rawU) ? rawU : "";
  if (isActive(me)) return u ? `/app?u=${encodeURIComponent(u)}` : "/app";
  const plan = params.get("plan");
  const cycle = params.get("cycle") ?? pending.cycle;
  const q = new URLSearchParams();
  if (plan) q.set("plan", plan);
  if (cycle === "weekly" || cycle === "quarterly") q.set("cycle", cycle);
  if (u) q.set("username", u);
  const qs = q.toString();
  // Veio do "Log in instead" do signup: já tem plano escolhido, segue pro checkout.
  return plan ? `/checkout?${qs}` : `/plans${qs ? `?${qs}` : ""}`;
}

export default function Login() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { me, loading, setMe } = useMe();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Sign in | FollowCatch"; }, []);

  // Já logado: não mostra o formulário à toa.
  useEffect(() => {
    if (!loading && me && !busy) nav(afterLoginPath(me, params), { replace: true });
  }, [loading, me, busy, nav, params]);

  const submit = async () => {
    const mail = email.trim().toLowerCase();
    if (!mail || !pw) return setErr("Enter your email and password.");
    setBusy(true);
    try {
      const m = await api.login(mail, pw);
      setMe(m);
      nav(afterLoginPath(m, params), { replace: true });
    } catch (e) {
      setBusy(false);
      setErr(e instanceof ApiFail && (e.code === "bad_credentials" || e.status === 401)
        ? "Wrong email or password."
        : "We couldn't sign you in right now. Try again in a moment.");
    }
  };

  return (
    <AuthShell>
      {notice ? (
        <ComingSoon
          title="Google sign-in is coming soon"
          body="For now, sign in with the email and password you used when you joined."
          onBack={() => setNotice(null)}
        />
      ) : (
        <>
          <div className="text-center">
            <h1 className="text-[28px] font-extrabold tracking-tight text-ink">Welcome back</h1>
            <p className="mx-auto mt-2 max-w-xs text-[15px] text-gray-600">Sign in to keep following the accounts you track.</p>
          </div>
          <div className="mt-7"><GoogleButton label="Sign in with Google" onClick={() => setNotice("google")} /></div>
          <OrDivider />
          <form noValidate onSubmit={(e) => { e.preventDefault(); if (!busy) void submit(); }} className="space-y-4">
            <Field label="Email address">
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="you@email.com" autoComplete="email" className={inputCls} />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input type={show ? "text" : "password"} value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder="Your password" autoComplete="current-password" className={`${inputCls} pr-16`} />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-brand-magenta/80 hover:text-brand-magenta">
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </Field>
            {err && <p className="-mt-1 text-sm text-red-500" role="alert">{err}</p>}
            <div className="text-right">
              <Link to="/forgot-password" className="text-sm font-semibold text-brand-magenta hover:underline">Forgot password?</Link>
            </div>
            <SubmitButton disabled={busy}>{busy ? "Signing in…" : "Sign in"}</SubmitButton>
          </form>
          <p className="mt-5 text-center text-[15px] text-gray-600">
            Don't have an account? <Link to="/plans" className="font-semibold text-brand-magenta hover:underline">Sign up</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
