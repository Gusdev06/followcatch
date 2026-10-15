import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell, ComingSoon, Field, GoogleButton, inputCls, OrDivider, SubmitButton } from "../components/funnel/AuthShell";

type Notice = null | "signin" | "forgot";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => { document.title = "Sign in | FollowCatch"; }, []);

  return (
    <AuthShell>
      {notice ? (
        <ComingSoon
          title={notice === "forgot" ? "Password reset is coming soon" : "Accounts are opening soon"}
          body={notice === "forgot"
            ? "We're launching sign-in shortly. Once it's live, you'll be able to reset your password from here."
            : "Sign-in isn't live yet, so there's no account to open. Check back soon."}
          onBack={() => setNotice(null)}
        />
      ) : (
        <>
          <div className="text-center">
            <h1 className="text-[28px] font-extrabold tracking-tight text-ink">Welcome back</h1>
            <p className="mx-auto mt-2 max-w-xs text-[15px] text-gray-600">Sign in to keep following the accounts you track.</p>
          </div>
          <div className="mt-7"><GoogleButton label="Sign in with Google" onClick={() => setNotice("signin")} /></div>
          <OrDivider />
          <form onSubmit={(e) => { e.preventDefault(); setNotice("signin"); }} className="space-y-4">
            <Field label="Email address">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" className={inputCls} />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input type={show ? "text" : "password"} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Your password" autoComplete="current-password" className={`${inputCls} pr-16`} />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-brand-magenta/80 hover:text-brand-magenta">
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </Field>
            <div className="text-right">
              <button type="button" onClick={() => setNotice("forgot")} className="text-sm font-semibold text-brand-magenta hover:underline">Forgot password?</button>
            </div>
            <SubmitButton>Sign in</SubmitButton>
          </form>
          <p className="mt-5 text-center text-[15px] text-gray-600">
            Don't have an account? <Link to="/plans" className="font-semibold text-brand-magenta hover:underline">Sign up</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
