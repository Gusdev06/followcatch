import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { Avatar, Check, IgGlyph } from "./shared";

export type Stage = "finding" | "complete" | "found";

/** Card do loading: anel gradiente do IG, texto do estágio e barra de progresso. */
export function LoadingCard({ stage, progress, picUrl, username, slow = false }: { stage: Stage; progress: number; picUrl?: string; username: string; slow?: boolean }) {
  const fired = useRef(false);
  useEffect(() => {
    if (stage !== "found" || fired.current) return;
    fired.current = true;
    const colors = ["#ff7a3d", "#ff2d55", "#e1306c", "#feda75", "#962fbf", "#4f5bd5", "#34d399"];
    confetti({ particleCount: 140, spread: 100, startVelocity: 42, origin: { y: 0.5 }, colors, disableForReducedMotion: true });
    setTimeout(() => confetti({ particleCount: 80, spread: 140, startVelocity: 30, origin: { y: 0.4 }, colors, disableForReducedMotion: true }), 250);
  }, [stage]);

  return (
    <div className="mx-auto w-full max-w-3xl rounded-[18px] bg-gradient-to-r from-[#962fbf] via-[#ff2d55] to-[#fa7e1e] p-[1.5px] shadow-[0_20px_50px_-24px_rgba(225,48,108,0.45)]">
      <div className="flex min-h-[230px] flex-col items-center justify-center rounded-[16.5px] bg-white px-5 py-8 sm:px-6" aria-live="polite">
        {stage === "found" ? (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
              <Check className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-ink">Profile Found!</h2>
            <p className="mt-1 text-center text-[15px] text-gray-600">We located <span className="font-semibold text-ink">@{username}</span> on Instagram.</p>
          </>
        ) : (
          <>
            <div className="relative h-[84px] w-[84px]">
              <svg viewBox="0 0 84 84" className={`absolute inset-0 h-full w-full ${stage === "finding" ? "animate-spin [animation-duration:1.4s]" : ""}`} aria-hidden>
                <defs>
                  <linearGradient id="ring" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0" stopColor="#feda75" /><stop offset=".35" stopColor="#fa7e1e" />
                    <stop offset=".65" stopColor="#d62976" /><stop offset="1" stopColor="#962fbf" />
                  </linearGradient>
                </defs>
                <circle cx="42" cy="42" r="38" fill="none" stroke="#f3f4f6" strokeWidth="5" />
                <circle cx="42" cy="42" r="38" fill="none" stroke="url(#ring)" strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={stage === "finding" ? "170 240" : "240 0"} />
              </svg>
              <div className="absolute inset-[10px] flex items-center justify-center overflow-hidden rounded-full bg-white">
                {picUrl ? <Avatar url={picUrl} name={username} size={64} /> : <IgGlyph className="h-9 w-9" />}
              </div>
            </div>
            <p className="mt-5 text-[15px] font-medium text-gray-700">
              {stage === "finding" ? "Finding profile" : "Loading complete"}
              <span className="inline-block w-5 text-left">{stage === "finding" ? <Dots /> : "."}</span>
            </p>
            {slow && <p className="mt-1 text-center text-[13px] text-gray-500">Instagram is taking longer than usual. Hang tight, still searching.</p>}
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#962fbf] via-[#d62976] to-[#ff2d55] transition-[width] duration-300 ease-out"
                style={{ width: `${Math.round(progress)}%` }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Dots() {
  return (
    <span aria-hidden>
      <span className="animate-pulse">.</span>
      <span className="animate-pulse [animation-delay:.2s]">.</span>
      <span className="animate-pulse [animation-delay:.4s]">.</span>
    </span>
  );
}
