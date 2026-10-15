import type { ApiErrorCode } from "../../lib/types";
import { Button } from "../ui";

const COPY: Record<ApiErrorCode, { emoji: string; title: (u: string) => string; body: string }> = {
  invalid: { emoji: "✏️", title: () => "That doesn't look like a username", body: "Instagram usernames use only letters, numbers, dots and underscores, up to 30 characters." },
  not_found: { emoji: "🔍", title: (u) => `We couldn't find @${u}`, body: "Double-check the spelling. The account may have been renamed or deleted." },
  private: { emoji: "🔒", title: (u) => `@${u} is private`, body: "We only work with public data, so private accounts can't be checked." },
  rate_limited: { emoji: "⏳", title: () => "You've used today's free searches", body: "Free searches reset every 24 hours. A plan unlocks unlimited lookups." },
  provider_error: { emoji: "📡", title: () => "Instagram is slow to answer right now", body: "This is on our side, not yours. Give it a minute and try again." },
  unauthorized: { emoji: "🔑", title: () => "Please log in again", body: "Your session ended. Log in to keep searching." },
  email_taken: { emoji: "✉️", title: () => "That email already has an account", body: "Log in with it instead." },
  bad_credentials: { emoji: "🔑", title: () => "Wrong email or password", body: "Check your details and try again." },
  payment_error: { emoji: "💳", title: () => "We couldn't confirm your payment", body: "Give it a minute and refresh. If it keeps happening, contact support." },
};

export function ErrorCard({ code, username, onRetry, subscriber = false }: { code: ApiErrorCode; username: string; onRetry: () => void; subscriber?: boolean }) {
  const base = COPY[code] ?? COPY.provider_error;
  // Assinante não tem limite por IP, mas tem teto diário anti-abuso.
  const c = subscriber && code === "rate_limited"
    ? { ...base, title: () => "You've hit today's lookup limit", body: "Your plan includes 50 new lookups a day, and the count resets every 24 hours." }
    : base;
  return (
    <div className="mx-auto w-full max-w-3xl rounded-card border border-line bg-white px-6 py-10 text-center shadow-[0_20px_50px_-28px_rgba(17,24,39,0.25)]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pink-50 text-3xl" aria-hidden>{c.emoji}</div>
      <h2 className="mt-4 text-xl font-bold text-ink">{c.title(username)}</h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-gray-600">{c.body}</p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button onClick={onRetry} className="w-full sm:w-auto">Try another username</Button>
        {code === "rate_limited" && !subscriber && <Button href={`/plans?username=${encodeURIComponent(username)}`} variant="outline" className="w-full sm:w-auto">See plans</Button>}
        {code === "unauthorized" && <Button href="/login" variant="outline" className="w-full sm:w-auto">Log in</Button>}
        {code === "provider_error" && <Button onClick={() => window.location.reload()} variant="outline" className="w-full sm:w-auto">Retry @{username}</Button>}
      </div>
    </div>
  );
}
