import { Link } from "react-router-dom";
import { Button } from "./Button";
import { Logo } from "./Logo";

export function Header({ showPricing = false }: { showPricing?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:h-[68px]">
        <Logo />
        <nav className="flex items-center gap-1.5 sm:gap-3">
          {showPricing && (
            <Link to="/plans" className="hidden px-2 text-sm font-semibold text-ink hover:text-brand-magenta sm:inline">
              Pricing
            </Link>
          )}
          <Button href="/login" variant="outline" className="!px-3 !py-1.5 text-sm sm:!px-5 sm:!py-2 sm:text-base">Login</Button>
          <Button href="/plans?signup=true" className="!px-3 !py-2 text-sm sm:!px-5 sm:!py-2.5 sm:text-base">Get Started</Button>
        </nav>
      </div>
    </header>
  );
}
export default Header;
