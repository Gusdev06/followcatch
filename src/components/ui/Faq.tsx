import { useState } from "react";

export type FaqItem = { q: string; a: string };

/** Acordeão em 2 colunas (1 no mobile), primeira pergunta aberta. */
export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const half = Math.ceil(items.length / 2);
  const cols = [items.slice(0, half), items.slice(half)];
  return (
    <div className="grid items-start gap-4 md:grid-cols-2">
      {cols.map((col, ci) => (
        <div key={ci} className="space-y-4">
          {col.map((it, i) => {
            const idx = ci * half + i;
            const isOpen = open === idx;
            return (
              <div key={it.q} className="rounded-card border border-line bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                >
                  <span className="text-[15px] font-semibold text-ink sm:text-base">{it.q}</span>
                  <svg viewBox="0 0 20 20" width="18" height="18" className={`shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180 text-brand-magenta" : ""}`} fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 8 5 5 5-5" /></svg>
                </button>
                {isOpen && <div className="border-t border-line px-5 pb-5 pt-4 text-[15px] leading-relaxed text-gray-600 sm:px-6">{it.a}</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
export default Faq;
