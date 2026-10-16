import type { ReactNode } from "react";
import { Footer, Header } from "../ui";
import { Arrow, Sparkles } from "./shared";

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
