import { useEffect, useState } from "react";
import { site } from "../../config/site";

function left(endsAt: string) {
  const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60, done: ms === 0 };
}

function Box({ v, l }: { v: number; l: string }) {
  return (
    <div className="flex w-10 flex-col items-center rounded-md bg-white py-0.5 sm:w-12 sm:py-1">
      <span className="text-sm font-bold leading-tight text-brand-magenta sm:text-lg">{String(v).padStart(2, "0")}</span>
      <span className="text-[9px] font-medium uppercase text-gray-500 sm:text-[10px]">{l}</span>
    </div>
  );
}

/** Barra de promoção. Com promo.endsAt conta até a data real (não reinicia por sessão); sem endsAt mostra só o label. */
export function PromoBar() {
  const { label, endsAt } = site.promo;
  const [t, setT] = useState(() => (endsAt ? left(endsAt) : null));
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setT(left(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!label) return null;
  if (t?.done) return null; // promoção acabou: some
  const [first, ...rest] = label.split("·").map((x) => x.trim());
  return (
    <div className="bg-gradient-to-r from-[#e1306c] via-[#e8336f] to-[#d62976] text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-center sm:py-3">
        <span className="rounded-full bg-cta px-3 py-1 text-xs font-bold shadow sm:text-sm">{first}</span>
        {rest.length > 0 && <span className="text-sm font-semibold sm:text-base">{rest.join(" · ")}</span>}
        {t && (
          <div className="flex gap-1.5">
            {t.d > 0 && <Box v={t.d} l="days" />}
            <Box v={t.h} l="hrs" />
            <Box v={t.m} l="min" />
            <Box v={t.s} l="sec" />
          </div>
        )}
      </div>
    </div>
  );
}
export default PromoBar;
