import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell, Field, inputCls, SubmitButton } from "../components/funnel/AuthShell";
import { api, ApiFail } from "../lib/api";
import { isActive, useMe } from "../lib/session";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const nav = useNavigate();
  const { setMe } = useMe();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | string>(null);

  useEffect(() => { document.title = "Set a new password | FollowCatch"; }, []);

  const submit = async () => {
    if (pw.length < 8) return setErr("Password must be at least 8 characters.");
    if (pw !== pw2) return setErr("Passwords don't match.");
    setBusy(true);
    try {
      const m = await api.resetPassword(token, pw);
      setMe(m);
      setDone(isActive(m) ? "/app" : "/plans");
    } catch (e) {
      setErr(e instanceof ApiFail && e.code === "invalid" ? e.message : "We couldn't reset your password right now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthShell>
        <div className="text-center" role="alert">
          <h1 className="text-xl font-bold text-ink">This reset link is invalid</h1>
          <p className="mt-2 text-[15px] text-gray-600">Ask for a new link and use it within 1 hour.</p>
          <Link to="/forgot-password" className="mt-6 inline-block text-sm font-semibold text-brand-magenta hover:underline">Send a new link</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {done ? (
        <div className="text-center" role="status">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-sm" aria-hidden>✅</div>
          <h1 className="mt-4 text-xl font-bold text-ink">Password updated</h1>
          <p className="mt-2 text-[15px] text-gray-600">You're signed in. Other devices were signed out.</p>
          <button onClick={() => nav(done, { replace: true })} className="mt-6 w-full rounded-xl bg-cta px-4 py-3.5 text-base font-bold text-white shadow-[0_10px_24px_-10px_rgba(255,45,85,0.7)] transition hover:brightness-105">
            {done === "/app" ? "Open dashboard" : "Choose a plan"}
          </button>
        </div>
      ) : (
        <>
          <div className="text-center">
            <h1 className="text-[28px] font-extrabold tracking-tight text-ink">Set a new password</h1>
            <p className="mx-auto mt-2 max-w-xs text-[15px] text-gray-600">Use at least 8 characters.</p>
          </div>
          <form noValidate onSubmit={(e) => { e.preventDefault(); if (!busy) void submit(); }} className="mt-7 space-y-4">
            <Field label="New password">
              <div className="relative">
                <input type={show ? "text" : "password"} value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder="New password" autoComplete="new-password" className={`${inputCls} pr-16`} />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-brand-magenta/80 hover:text-brand-magenta">
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </Field>
            <Field label="Confirm password">
              <input type={show ? "text" : "password"} value={pw2} onChange={(e) => { setPw2(e.target.value); setErr(""); }} placeholder="Repeat the new password" autoComplete="new-password" className={inputCls} />
            </Field>
            {err && <p className="-mt-1 text-sm text-red-500" role="alert">{err}</p>}
            <SubmitButton disabled={busy}>{busy ? "Saving…" : "Save new password"}</SubmitButton>
          </form>
        </>
      )}
    </AuthShell>
  );
}
