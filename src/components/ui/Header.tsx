import { Link, useNavigate } from "react-router-dom";
import { useMe } from "../../lib/session";
import { Button } from "./Button";
import { Logo } from "./Logo";

const sm = "!px-3 !py-1.5 text-sm sm:!px-5 sm:!py-2 sm:text-base";

export function Header({ showPricing = false }: { showPricing?: boolean }) {
  const { me, loading, logout } = useMe();
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:h-[68px]">
        <Logo />
        <nav className={`flex items-center gap-1.5 transition-opacity sm:gap-3 ${loading ? "opacity-0" : "opacity-100"}`}>
          {showPricing && !me && (
            <Link to="/plans" className="hidden px-2 text-sm font-semibold text-ink hover:text-brand-magenta sm:inline">
              Pricing
            </Link>
          )}
          {me ? (
            <>
              <Button
                variant="ghost"
                className={`${sm} !text-gray-600`}
                onClick={async () => { await logout(); nav("/"); }}
              >
                Log out
              </Button>
              <Button href="/app" className="!px-3 !py-2 text-sm sm:!px-5 sm:!py-2.5 sm:text-base">Dashboard</Button>
            </>
          ) : (
            <>
              <Button href="/login" variant="outline" className={sm}>Login</Button>
              <Button href="/plans?signup=true" className="!px-3 !py-2 text-sm sm:!px-5 sm:!py-2.5 sm:text-base">Get Started</Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
export default Header;
