import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { isValidUsername, normalizeUsername } from "../../lib/api";
import { InstagramIcon } from "./InstagramIcon";

type Props = {
  id?: string;
  buttonLabel?: string;
  placeholder?: string;
  className?: string;
  /** Sem onSubmit, navega para /search?u=<username>. */
  onSubmit?: (username: string) => void;
};

export function UsernameForm({ id = "username-search", buttonLabel = "Try It Free ✨", placeholder = "@username", className = "", onSubmit }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function submit(e: FormEvent) {
    e.preventDefault();
    const u = normalizeUsername(value);
    if (!u) return setError("Enter an Instagram username to continue.");
    if (!isValidUsername(u)) return setError("That doesn't look like a valid Instagram username. Use letters, numbers, periods or underscores (max 30).");
    setError("");
    if (onSubmit) onSubmit(u);
    else navigate(`/search?u=${encodeURIComponent(u)}`);
  }

  return (
    <form onSubmit={submit} className={`w-full ${className}`} noValidate>
      <div
        className={`flex items-center gap-2 rounded-2xl border bg-white p-1.5 pl-3 shadow-[0_8px_30px_-12px_rgba(17,24,39,0.18)] transition sm:gap-3 sm:pl-4 ${
          error ? "border-red-300 ring-2 ring-red-100" : "border-line focus-within:border-brand-pink/40 focus-within:ring-2 focus-within:ring-brand-pink/15"
        }`}
      >
        <InstagramIcon size={24} />
        <span className="hidden h-6 w-px bg-line sm:block" />
        <label htmlFor={id} className="sr-only">Instagram username</label>
        <input
          id={id}
          value={value}
          onChange={(e) => { setValue(e.target.value); if (error) setError(""); }}
          placeholder={placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-ink placeholder:text-gray-400 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-cta px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_18px_-6px_rgba(255,45,85,0.6)] transition hover:brightness-105 active:scale-[0.98] sm:px-5 sm:text-base"
        >
          {buttonLabel}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 px-1 text-left text-sm font-medium text-red-600">{error}</p>}
    </form>
  );
}
export default UsernameForm;
