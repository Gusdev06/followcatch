import { useState } from "react";
import { img } from "../../lib/api";
import { isMock } from "./mock";

// Produção: sempre pelo proxy. Mock (?mock=1, só dev): CDN direto, porque o proxy é do backend.
const photo = (url: string) => (isMock() ? url : img(url));

export const fmt = (n: number) => n.toLocaleString("en-US");
export const money = (n: number) => `$${n.toFixed(2)}`;

/** Foto do IG sempre pelo proxy; se falhar, inicial num círculo gradiente. */
export function Avatar({ url, name, size = 40, className = "", blur = false, ring = false }: {
  url: string; name: string; size?: number; className?: string; blur?: boolean; ring?: boolean;
}) {
  const [broken, setBroken] = useState(!url);
  const inner = broken ? (
    <div
      className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#ffb199] via-[#ff6f91] to-[#c86dd7] font-semibold text-white ${blur ? "blur-[3px]" : ""}`}
      style={{ fontSize: size * 0.4 }}
      aria-hidden
    >
      {blur ? "" : (name.replace(/[^a-z0-9]/gi, "")[0] ?? "?").toUpperCase()}
    </div>
  ) : (
    <img
      src={photo(url)}
      alt={blur ? "" : name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`h-full w-full rounded-full object-cover ${blur ? "blur-[3px] scale-110" : ""}`}
    />
  );
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-full ${ring ? "bg-ig p-[3px]" : "bg-[#f3f4f6]"} ${className}`}
      style={{ width: size, height: size }}
    >
      {ring ? <div className="h-full w-full overflow-hidden rounded-full bg-white p-[2px]">{inner}</div> : inner}
    </div>
  );
}

export function VerifiedBadge({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0 text-[#3897f0]`} aria-label="Verified">
      <path fill="currentColor" d="M12 1.5l2.6 1.9 3.2-.2 1 3.1 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3.1-3.2-.2L12 22.5l-2.6-1.9-3.2.2-1-3.1-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3.1 3.2.2z" />
      <path fill="#fff" d="M10.6 15.6l-3.2-3.2 1.3-1.3 1.9 1.9 4.8-4.8 1.3 1.3z" />
    </svg>
  );
}

export function IgGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="igg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#feda75" /><stop offset=".3" stopColor="#fa7e1e" />
          <stop offset=".6" stopColor="#d62976" /><stop offset="1" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="none" stroke="url(#igg)" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="4.4" fill="none" stroke="url(#igg)" strokeWidth="2.2" />
      <circle cx="17.4" cy="6.6" r="1.3" fill="url(#igg)" />
    </svg>
  );
}

export function Arrow({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Check({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Spinner({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} animate-spin text-brand-pink`} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Fundo com losangos suaves, como no FollowSpy. */
export function Sparkles() {
  const dots = [
    ["4%", "18%", "#f9a8d4", 14], ["92%", "12%", "#fdba74", 12], ["7%", "62%", "#fcd34d", 10],
    ["95%", "55%", "#c4b5fd", 12], ["88%", "86%", "#fda4af", 10], ["3%", "90%", "#c4b5fd", 8],
  ] as const;
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      {dots.map(([l, t, c, s], i) => (
        <span key={i} className="absolute rotate-45 rounded-[2px] opacity-70" style={{ left: l, top: t, width: s, height: s, background: c }} />
      ))}
    </div>
  );
}
