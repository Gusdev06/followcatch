import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type Props = {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "cta" | "outline" | "ghost";
  className?: string;
  type?: "button" | "submit" | "reset";
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/50 disabled:opacity-60 whitespace-nowrap";
const variants = {
  cta: "bg-cta text-white shadow-[0_6px_18px_-6px_rgba(255,45,85,0.55)] hover:brightness-105 px-5 py-2.5",
  outline: "border-2 border-brand-magenta text-brand-magenta bg-white hover:bg-pink-50 px-5 py-2",
  ghost: "text-ink hover:bg-black/5 px-4 py-2",
};

export function Button({ children, onClick, href, variant = "cta", className = "", type = "button" }: Props) {
  const cls = `${base} ${variants[variant]} ${className}`;
  if (href) {
    if (/^(https?:|mailto:|tel:)/.test(href)) return <a href={href} onClick={onClick} className={cls}>{children}</a>;
    return <Link to={href} onClick={onClick} className={cls}>{children}</Link>;
  }
  return <button type={type} onClick={onClick} className={cls}>{children}</button>;
}
export default Button;
