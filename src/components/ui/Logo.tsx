import { Link } from "react-router-dom";
import { site } from "../../config/site";

/** Ícone próprio: lupa com uma pupila dentro, sobre o gradiente da marca. */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-xl bg-cta shadow-sm" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <circle cx="10.5" cy="10.5" r="2.4" fill="white" stroke="none" />
        <path d="M15.5 15.5 20 20" />
      </svg>
    </span>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex shrink-0 items-center gap-2 ${className}`} aria-label={`${site.name} home`}>
      <LogoMark size={36} />
      <span className="text-[18px] font-extrabold sm:text-[20px] tracking-tight text-ink">
        Follow<span className="bg-cta bg-clip-text text-transparent">Catch</span>
      </span>
    </Link>
  );
}
export default Logo;
