import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell, Field, inputCls, SubmitButton } from "../components/funnel/AuthShell";
import { api, ApiFail } from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Reset password | FollowCatch"; }, []);

  const submit = async () => {
    const mail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return setErr("Enter a valid email.");
    setBusy(true);
    try {
      await api.forgot(mail);
      setSent(true);
    } catch (e) {
      setErr(e instanceof ApiFail && e.code === "invalid" ? "Enter a valid email." : "We couldn't send the link right now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      {sent ? (
        <div className="text-center" role="status">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-sm" aria-hidden>📬</div>
          <h1 className="mt-4 text-xl font-bold text-ink">Check your inbox</h1>
          <p className="mt-2 text-[15px] text-gray-600">
            If an account exists for <span className="font-semibold text-ink">{email.trim().toLowerCase()}</span>, we've sent a reset link. It expires in 1 hour.
          </p>
          <p className="mt-2 text-sm text-gray-500">Didn't get it? Check spam, or try again in a few minutes.</p>
          <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-brand-magenta hover:underline">← Back to sign in</Link>
        </div>
      ) : (
        <>
          <div className="text-center">
            <h1 className="text-[28px] font-extrabold tracking-tight text-ink">Forgot your password?</h1>
            <p className="mx-auto mt-2 max-w-xs text-[15px] text-gray-600">Enter your account email and we'll send you a link to set a new one.</p>
          </div>
          <form noValidate onSubmit={(e) => { e.preventDefault(); if (!busy) void submit(); }} className="mt-7 space-y-4">
            <Field label="Email address">
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="you@email.com" autoComplete="email" className={inputCls} />
            </Field>
            {err && <p className="-mt-1 text-sm text-red-500" role="alert">{err}</p>}
            <SubmitButton disabled={busy}>{busy ? "Sending…" : "Send reset link"}</SubmitButton>
          </form>
          <p className="mt-5 text-center text-[15px] text-gray-600">
            Remembered it? <Link to="/login" className="font-semibold text-brand-magenta hover:underline">Sign in</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
