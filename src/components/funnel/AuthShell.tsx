import type { ReactNode } from "react";
import { Footer, Header } from "../ui";
import { Arrow, GoogleIcon, Sparkles } from "./shared";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="relative isolate flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <Sparkles />
        <div className="w-full max-w-[448px] rounded-[22px] border border-pink-200 bg-gradient-to-br from-[#f6efff] via-[#fff0f5] to-[#fff6ec] p-6 shadow-[0_30px_70px_-35px_rgba(225,48,108,0.45)] sm:p-8">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function GoogleButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-pink-200 bg-white px-4 py-3.5 text-[15px] font-semibold text-gray-800 shadow-[0_6px_18px_-10px_rgba(225,48,108,0.5)] transition hover:border-pink-300"
    >
      <GoogleIcon /> {label} <Arrow className="h-4 w-4 text-gray-500" />
    </button>
  );
}

export function OrDivider() {
  return (
    <div className="relative my-6 text-center">
      <span className="absolute inset-x-0 top-1/2 h-px bg-pink-200/70" />
      <span className="relative rounded bg-white px-3 py-0.5 text-[13px] font-medium text-gray-500">or continue with email</span>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-700">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border-2 border-pink-100 bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-gray-400 focus:border-pink-300";

export function SubmitButton({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button type="submit" disabled={disabled} aria-busy={disabled} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cta px-4 py-3.5 text-base font-bold text-white shadow-[0_10px_24px_-10px_rgba(255,45,85,0.7)] transition hover:brightness-105 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70">
      {children} {!disabled && <Arrow />}
    </button>
  );
}

/** Aviso honesto enquanto não há auth/pagamento. */
export function ComingSoon({ title, body, onBack }: { title: string; body: ReactNode; onBack: () => void }) {
  return (
    <div className="text-center" role="status">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-sm" aria-hidden>🚧</div>
      <h2 className="mt-4 text-xl font-bold text-ink">{title}</h2>
      <div className="mt-2 text-[15px] text-gray-600">{body}</div>
      <button onClick={onBack} className="mt-6 text-sm font-semibold text-brand-magenta hover:underline">← Back</button>
    </div>
  );
}
