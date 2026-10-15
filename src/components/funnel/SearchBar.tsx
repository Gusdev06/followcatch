import { forwardRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isValidUsername, normalizeUsername } from "../../lib/api";
import { IgGlyph } from "./shared";
import { isMock } from "./mock";

/** Link de busca preservando o modo mock (só em dev/teste). */
export const searchHref = (u: string) => `/search?u=${encodeURIComponent(u)}${isMock() ? "&mock=1" : ""}`;

export const SearchBar = forwardRef<HTMLInputElement, { initial?: string }>(function SearchBar({ initial = "" }, ref) {
  const [v, setV] = useState(initial);
  const [bad, setBad] = useState(false);
  const nav = useNavigate();
  return (
    <form
      className="mx-auto w-full max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        const u = normalizeUsername(v);
        if (!isValidUsername(u)) return setBad(true);
        nav(searchHref(u));
      }}
    >
      <div className={`flex items-center gap-2 rounded-2xl border bg-white p-2 pl-3 shadow-[0_8px_30px_-12px_rgba(17,24,39,0.18)] ${bad ? "border-red-300" : "border-line"}`}>
        <IgGlyph className="h-6 w-6 shrink-0" />
        <span className="h-6 w-px bg-line" />
        <input
          ref={ref}
          value={v}
          onChange={(e) => { setV(e.target.value); setBad(false); }}
          placeholder="Instagram username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent px-1 text-base font-medium text-ink outline-none placeholder:text-gray-400"
        />
        <button type="submit" className="shrink-0 rounded-xl bg-cta px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_18px_-6px_rgba(255,45,85,0.55)] hover:brightness-105 sm:px-5">
          Search
        </button>
      </div>
      {bad && <p className="mt-2 text-center text-sm text-red-500">Use letters, numbers, dots or underscores (max 30).</p>}
    </form>
  );
});
