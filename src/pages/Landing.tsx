import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { site } from "../config/site";
import { Button, ChatBubble, Decor, Faq, Footer, Header, PromoBar, UsernameForm, type FaqItem } from "../components/ui";

/* ---------- helpers ---------- */

const HERO_INPUT = "hero-username";

/** CTAs do meio da página voltam pro campo do hero (igual à referência). */
function focusHeroSearch() {
  const el = document.getElementById(HERO_INPUT) as HTMLInputElement | null;
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => el.focus({ preventScroll: true }), 450);
}

function CheckCta({ label = "Check an Account Now", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <Button onClick={focusHeroSearch} className="!px-8 !py-3.5 text-base sm:text-lg">
        {label} <span aria-hidden>→</span>
      </Button>
    </div>
  );
}

function H2({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-center text-[28px] font-extrabold leading-tight tracking-tight text-ink sm:text-4xl ${className}`}>{children}</h2>;
}

function Underline() {
  return <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-cta" />;
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-200 bg-pink-50/70 px-3 py-1 text-sm font-medium text-brand-magenta">{children}</span>;
}

function IconTile({ children }: { children: ReactNode }) {
  return <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-cta text-white shadow-[0_8px_20px_-8px_rgba(225,48,108,0.7)]">{children}</span>;
}

const svg = (d: string) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

/* ---------- content ---------- */

const features = [
  { icon: "👥", title: "New Following", text: "See the accounts someone just started following" },
  { icon: "🔔", title: "New Followers", text: "Find out who recently followed an account" },
  { icon: "👋", title: "Unfollowers", text: "Spot who stopped following an account" },
  { icon: "🕒", title: "Chronological Order", text: "Follows and followers listed newest first" },
  { icon: "👁️", title: "Story Viewer", text: "Watch public stories without being seen" },
];

const steps = [
  { title: "Type an Instagram username", text: "Enter the handle of any public account in the search box. You don't need an Instagram account of your own.", icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 17-4.3-4.3" },
  { title: `${site.name} gathers the public data`, text: "We collect the account's public following and follower lists for you. No apps, no extensions, no redirects.", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10-3v6m3-3h-6" },
  { title: "Browse their latest connections", text: "See recent follows, new followers and unfollows, sorted newest first, so you know what changed lately.", icon: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9m4.3 13a1.94 1.94 0 0 0 3.4 0" },
];

const benefits = [
  { tag: "🕒 Chronological", title: "Follows and followers in the order they happened", text: `${site.name} lists an account's following and followers from newest to oldest, so you can tell who they followed lately instead of scrolling an endless list.` },
  { tag: "👋 Unfollows", title: "Know who unfollowed", text: "Instagram doesn't tell anyone when they lose a follower. Track an account and we flag the people who left, without you comparing long lists by hand." },
  { tag: "🛡️ Account Safety", title: "Zero risk to your own profile", text: "You never log in with Instagram, and you don't even need an account to search. Nothing is linked to your profile, so there's nothing to flag or restrict." },
  { tag: "🕵️ Anonymous", title: "Private, anonymous searches", text: "The account you look up is never notified. You don't follow them, visit their profile or interact with their posts.", extra: "Use it from any phone, tablet or computer: no app to install and no pop-ups." },
  { tag: "👁️ Story Viewer", title: "Two tools, one subscription", story: true, text: "" },
];

const safety = [
  { icon: svg("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4"), title: `${site.name} is safe`, text: "We never ask for your Instagram login and never connect to your account. There's nothing that could put your profile at risk." },
  { icon: svg("M12 3v18M5 7h14M5 7l-3 7a4 4 0 0 0 6 0L5 7Zm14 0-3 7a4 4 0 0 0 6 0l-3-7ZM8 21h8"), title: "It only uses public data", text: "We only show information an account has chosen to make public. Private accounts, messages and anything behind a login stay off-limits." },
  { icon: svg("M9.9 4.2A10 10 0 0 1 12 4c7 0 10 8 10 8a17 17 0 0 1-2.2 3.4M6.6 6.6C3.6 8.6 2 12 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6M2 2l20 20M14.1 14.1a3 3 0 0 1-4.2-4.2"), title: "Your searches stay private", text: "Looking at a profile on Instagram can leave traces. With us, the account you check never sees who searched for it." },
];

const audiences = [
  { title: "Creators and Influencers", text: "See who peers and competitors in your niche are following, find collaboration opportunities and learn what's working for accounts like yours." },
  { title: "Marketers and Agencies", text: "Research competitors and partners, source UGC creators, watch growth patterns and monitor campaigns without your brand showing up in anyone's activity." },
  { title: "Social Media Managers", text: "Keep an eye on follower churn for the accounts you run, find engagement gaps and discover new audiences worth reaching." },
  { title: "Journalists and Researchers", text: "Map public connections between accounts, understand how online communities link together and spot coordinated or fake profiles." },
];

const vsOthers: [string, string, string][] = [
  ["Fresh results", "Updated on every search", "Often stale snapshots"],
  ["Recent following", "Newest first", "Often unsorted"],
  ["Recent followers", "Newest first", "Often unsorted"],
  ["Unfollower detection", "Included on paid plans", "Often missing"],
  ["Anonymous searches", "Account is never notified", "May require following them"],
  ["No Instagram login", "Just a username", "Some ask for your password"],
];

const vsManual: { label: string; icon: string; us: string; them: string; neutral?: boolean }[] = [
  { label: "Spot unfollows", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 0h6", us: "Shown in their own list", them: "Instagram never tells you" },
  { label: "Following vs. followers", icon: "M7 16 3 12l4-4M3 12h18M17 8l4 4-4 4", us: "Compared in one search", them: "Two long lists, checked by hand" },
  { label: "Speed", icon: "M13 2 3 14h9l-1 8 10-12h-9l1-8Z", us: "One username, one search", them: "Minutes of scrolling per profile" },
  { label: "Safety", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", us: "Read-only, no interaction", them: "A stray like or follow leaves a trace" },
  { label: "No Instagram account needed", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", us: "No login, no account", them: "You have to be logged in" },
  { label: "Setup", icon: "M12 3v12m0 0-4-4m4 4 4-4M4 21h16", us: "Works in your browser", them: "Nothing to install", neutral: true },
  { label: "Accuracy", icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-6a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", us: "Pulled from current public data", them: "Easy to lose your place in a long list" },
  { label: "Support", icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-6a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.9 4.9l4.3 4.3m5.6 5.6 4.3 4.3m0-14.2-4.3 4.3m-5.6 5.6-4.3 4.3", us: "Email support from real people", them: "No one to ask" },
  { label: "Ease of use", icon: "M9 9l5 12 1.8-5.2L21 14 9 9Zm-2.8 5.7-1.4 1.4M4 9H2m3.2-3.8L3.8 3.8M9 4V2m3.8 3.2 1.4-1.4", us: "Type a username, that's it", them: "You'd need to remember the old list" },
];

const faq: FaqItem[] = [
  { q: "How can I see who someone recently followed on Instagram?", a: `Type their Instagram username into the ${site.name} search box. We gather the account's public following list and show it newest first, so the accounts they followed most recently are at the top. You can switch to their followers list the same way.` },
  { q: "Are follows and followers shown in chronological order?", a: "Yes. Lists are sorted from the most recent to the oldest, based on the order Instagram returns them. That's how you can tell who someone followed lately rather than who they've followed at some point." },
  { q: "Do I need to log in with my Instagram account?", a: `No. ${site.name} never asks for your Instagram login, and you don't need an Instagram account at all. Just enter the username you want to check.` },
  { q: `Is ${site.name} affiliated with Instagram?`, a: `No. ${site.name} is an independent service and is not affiliated with, endorsed by, or sponsored by Instagram or Meta Platforms, Inc.` },
  { q: "Can I see the followers of a private account?", a: "No. We only work with public information. If an account is private, its following and follower lists aren't available, and we'll tell you so." },
  { q: "Will the person know I searched for them?", a: "No. Your searches are anonymous. The account you check is never notified, and nothing about the search is linked to your own Instagram profile." },
  { q: "How often is the data updated?", a: "Every new search pulls the account's latest public data. To keep things fast, results for the same account can be reused for a few hours before they're refreshed again." },
];

/* ---------- page ---------- */

export default function Landing() {
  const { rating, usersThisMonth, testimonials } = site.socialProof;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fffafa]">
      <PromoBar />
      <Header />

      {/* Hero */}
      <section className="relative bg-gradient-to-b from-[#fff1f4] via-[#fff6f5] to-[#fff8f4]">
        <Decor />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-10 text-center sm:pt-14">
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink/80 bg-white px-4 py-1.5 text-sm font-semibold text-ink shadow-[0_6px_16px_-8px_rgba(0,0,0,0.25)] sm:text-[15px]">
            <span aria-hidden>🔒</span> No Instagram login required
          </span>
          <h1 className="mx-auto mt-6 max-w-4xl text-[34px] font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-[56px]">
            Instagram Follower Tracker: See Who Anyone Recently Followed
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] text-gray-600 sm:text-xl">
            Curious about an account's latest follow activity? Look it up with our Instagram Follower Tracker.
          </p>

          {rating && (
            <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-line bg-white px-5 py-2.5 shadow-sm">
              <span className="text-amber-400" aria-hidden>★★★★★</span>
              <span className="font-bold text-ink">{rating.score.toFixed(2)}/5</span>
              <span className="text-sm text-gray-500">from {rating.count.toLocaleString("en-US")} reviews</span>
            </div>
          )}

          <div className="mx-auto mt-8 max-w-[640px]">
            <UsernameForm id={HERO_INPUT} placeholder="@nasa" buttonLabel="Try It Free ✨" />
          </div>

          <p className="mx-auto mt-7 max-w-3xl text-[15px] leading-relaxed text-gray-500 sm:text-base">
            Check any public account's latest connections: who they started following, who followed them, and who unfollowed them. Just enter
            their Instagram username. No login and no Instagram account needed, and your searches stay anonymous. {site.name} only uses
            publicly available data and is safe for every account.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            {features.map((f, i) => (
              <div key={f.title} className={`rounded-card border border-line bg-white px-3 py-5 shadow-[0_6px_20px_-12px_rgba(17,24,39,0.18)] ${i === 4 ? "col-span-2 lg:col-span-1" : ""}`}>
                <div className="text-3xl" aria-hidden>{f.icon}</div>
                <h3 className="mt-2 text-[15px] font-semibold text-ink">{f.title}</h3>
                <p className="mt-1 text-[13px] leading-snug text-gray-500">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative bg-gradient-to-b from-[#fff8f4] to-[#fdf5fa] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          {usersThisMonth != null && (
            <span className="inline-flex rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm">
              🔥 {usersThisMonth.toLocaleString("en-US")} people started tracking an account this month
            </span>
          )}
          <h2 className="mx-auto mt-6 max-w-3xl bg-gradient-to-r from-[#9b3fbf] via-[#e1306c] to-[#ff2d55] bg-clip-text text-[32px] font-extrabold leading-[1.1] tracking-tight text-transparent sm:text-5xl">
            See Any Account's Recent Follows in 3 Simple Steps
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] text-gray-600 sm:text-xl">
            Tracking Instagram activity takes seconds: see who an account follows, who follows them, and what changed lately.
          </p>
          <div className="mt-10 grid gap-4 md:mt-12 md:grid-cols-3 md:gap-5">
            {steps.map((s, i) => (
              <div key={s.title} className="relative flex items-start gap-4 rounded-card border border-line bg-white/90 p-5 text-left shadow-[0_10px_30px_-16px_rgba(17,24,39,0.25)] md:block md:px-6 md:pb-8 md:pt-8 md:text-center">
                <span className="absolute right-5 top-5 hidden md:flex h-11 w-11 items-center justify-center rounded-full border border-pink-200 bg-pink-50 text-brand-magenta">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon} /></svg>
                </span>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#e1306c] to-[#9b3fbf] text-base font-bold text-white shadow-lg md:mx-auto md:h-14 md:w-14 md:text-lg">{i + 1}</span>
                <div>
                  <h3 className="text-lg font-bold text-ink md:mt-5 md:text-xl">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-gray-600 md:mt-3">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
          <CheckCta className="mt-12" />
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-gradient-to-br from-[#fdf2f8] via-[#fff7f7] to-[#fff4ec] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white px-5 py-2.5 font-semibold text-brand-magenta">🔓 Follow Activity</span>
            <H2 className="mx-auto mt-6 max-w-3xl">Get the Full Picture of Any Account's Follow Activity</H2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-6">
            {benefits.map((b, i) => (
              <div key={b.title} className={`rounded-card border border-pink-100 bg-white p-6 shadow-[0_10px_30px_-18px_rgba(225,48,108,0.45)] ${i < 3 ? "md:col-span-2" : "md:col-span-3"}`}>
                <Pill>{b.tag}</Pill>
                <h3 className="mt-4 text-lg font-bold text-ink">{b.title}</h3>
                {b.story ? (
                  <p className="mt-3 text-[15px] leading-relaxed text-gray-600">
                    {site.name} is more than a follower tracker. Premium also unlocks our{" "}
                    <Link to="/story-viewer" className="font-semibold text-brand-magenta hover:underline">Instagram Story Viewer</Link>, so you can check
                    who an account recently followed and watch their public stories in one place, without a second tool or a second bill.
                  </p>
                ) : (
                  <>
                    <p className="mt-3 text-[15px] leading-relaxed text-gray-600">{b.text}</p>
                    {b.extra && <p className="mt-3 text-[15px] leading-relaxed text-gray-600">{b.extra}</p>}
                  </>
                )}
              </div>
            ))}
          </div>
          <CheckCta className="mt-12" />
        </div>
      </section>

      {/* Safe & legal */}
      <section className="bg-[#f8f9fc] py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <H2>Is {site.name} Safe and Legal?</H2>
          <Underline />
          <div className="mt-10 grid gap-4 md:mt-12 md:grid-cols-3 md:gap-5">
            {safety.map((s) => (
              <div key={s.title} className="flex items-start gap-4 rounded-card border border-line bg-white p-5 shadow-[0_10px_30px_-18px_rgba(17,24,39,0.3)] md:block md:px-6 md:py-8 md:text-center">
                <div className="shrink-0"><IconTile>{s.icon}</IconTile></div>
                <div>
                  <h3 className="text-lg font-bold text-ink md:mt-5 md:text-xl">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-gray-600 md:mt-3">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who uses */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <H2>Who Uses {site.name}</H2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-[17px] text-gray-600">
            Our Instagram Follower Tracker is built for anyone who wants to follow public account activity discreetly, whether for competitor
            research, verifying a profile, or simply staying in the loop.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {audiences.map((a) => (
              <div key={a.title} className="rounded-card border border-line bg-white p-5 sm:p-6 shadow-[0_8px_24px_-16px_rgba(17,24,39,0.3)]">
                <h3 className="text-lg font-bold text-ink">{a.title}</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-gray-600">{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* vs Others */}
      <section className="bg-[#fdfafb] pb-8 pt-16 sm:pt-20">
        <div className="mx-auto max-w-4xl px-4">
          <H2 className="mx-auto max-w-2xl">How {site.name} Compares to Other Instagram Trackers</H2>
          <div className="mt-10 overflow-hidden rounded-card border border-pink-100 bg-white shadow-[0_12px_32px_-18px_rgba(225,48,108,0.45)]">
            <div className="grid grid-cols-[1.1fr_1fr_1fr] bg-cta px-4 py-3.5 text-xs font-bold text-white sm:px-6 sm:text-sm">
              <span>Feature</span>
              <span className="text-center">{site.name}</span>
              <span className="text-center">Others</span>
            </div>
            {vsOthers.map(([feat, us, them], i) => (
              <div key={feat} className={`grid grid-cols-[1.1fr_1fr_1fr] items-center gap-2 border-t border-line px-4 py-3.5 text-[13px] sm:px-6 sm:text-sm ${i % 2 ? "bg-[#fafbfc]" : ""}`}>
                <span className="font-semibold text-ink">{feat}</span>
                <span className="text-center font-semibold leading-snug text-emerald-700"><span aria-hidden className="mr-1">✓</span>{us}</span>
                <span className="text-center leading-snug text-rose-600"><span aria-hidden className="mr-1">✕</span>{them}</span>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center gap-3">
            <Button onClick={focusHeroSearch} className="!px-8 !py-3.5 text-base sm:text-lg">Start Tracking Now</Button>
            <p className="text-center text-[15px] text-gray-500">Enter any public username and see their latest follows in seconds.</p>
          </div>
        </div>
      </section>

      {/* vs Manual */}
      <section className="bg-[#fdfafb] pb-16 pt-12 sm:pb-20">
        <div className="mx-auto max-w-5xl px-4">
          <H2>Using {site.name} vs. Checking Instagram Manually</H2>
          <Underline />

          {/* desktop: 3 colunas com a do meio em destaque */}
          <div className="relative mt-12 hidden md:block">
            <div className="grid grid-cols-[1fr_1.25fr_1fr] rounded-card border border-line bg-white shadow-[0_12px_32px_-20px_rgba(17,24,39,0.35)]">
              <div>
                <div className="h-[72px]" />
                {vsManual.map((r) => (
                  <div key={r.label} className="flex h-[72px] items-center gap-3 border-t border-line px-6">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-pink-200 bg-pink-50 text-brand-magenta">
                      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={r.icon} /></svg>
                    </span>
                    <span className="text-sm font-semibold text-ink">{r.label}</span>
                  </div>
                ))}
              </div>
              <div className="relative -my-3 rounded-card border border-pink-200 bg-[#fff7fa] shadow-[0_18px_40px_-18px_rgba(225,48,108,0.5)]">
                <div className="h-1.5 rounded-t-card bg-cta" />
                <div className="flex h-[78px] items-center justify-center">
                  <span className="bg-gradient-to-r from-[#9b3fbf] to-[#e1306c] bg-clip-text text-xl font-extrabold text-transparent">{site.name}</span>
                </div>
                {vsManual.map((r) => (
                  <div key={r.label} className="flex h-[72px] items-center gap-3 border-t border-pink-100 px-7 text-[15px] font-semibold text-ink">
                    <span className="text-emerald-600" aria-hidden>✓</span>{r.us}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex h-[72px] items-center justify-center">
                  <span className="rounded-full bg-gray-100 px-4 py-1.5 text-sm font-semibold text-gray-600">Manually in Instagram</span>
                </div>
                {vsManual.map((r) => (
                  <div key={r.label} className="flex h-[72px] items-center gap-3 border-t border-line px-6 text-[15px] text-gray-600">
                    <span className={r.neutral ? "text-gray-400" : "text-rose-500"} aria-hidden>{r.neutral ? "—" : "✕"}</span>{r.them}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* mobile: uma linha por item */}
          <div className="mt-10 space-y-3 md:hidden">
            {vsManual.map((r) => (
              <div key={r.label} className="rounded-card border border-line bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-pink-200 bg-pink-50 text-brand-magenta">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={r.icon} /></svg>
                  </span>
                  <span className="font-semibold text-ink">{r.label}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
                  <div className="rounded-lg bg-[#fff4f8] p-2.5">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-brand-magenta">{site.name}</div>
                    <div className="mt-1 font-semibold text-ink">✓ {r.us}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2.5">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Manually</div>
                    <div className="mt-1 text-gray-600">{r.neutral ? "—" : "✕"} {r.them}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <H2>Frequently Asked Questions</H2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[17px] text-gray-600">
            Everything you need to know about tracking Instagram follow activity with {site.name}.
          </p>
          <div className="mt-10">
            <Faq items={faq} />
          </div>
          <CheckCta className="mt-12" />
        </div>
      </section>

      {/* Testimonials: só com depoimentos reais em site.ts */}
      {testimonials.length > 0 && (
        <section className="bg-white pb-16 sm:pb-20">
          <div className="mx-auto max-w-6xl px-4">
            <H2 className="mx-auto max-w-3xl">What People Say About {site.name}</H2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t) => (
                <div key={t.name + t.text.slice(0, 20)} className="rounded-card border border-line bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cta text-sm font-bold text-white">{t.name[0]}</span>
                    <div>
                      <div className="text-sm font-semibold text-ink">{t.name}</div>
                      <div className="text-xs text-gray-500">{t.source}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-[15px] leading-relaxed text-gray-600">{t.text}</p>
                </div>
              ))}
            </div>
            <CheckCta className="mt-10" />
          </div>
        </section>
      )}

      {/* Cross-sell Story Viewer */}
      <section className="bg-[#f8f9fc] py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <H2>Go Beyond Follower Tracking</H2>
          <p className="mt-5 text-[17px] leading-relaxed text-gray-600">
            Follows, followers and unfollows are only part of the story. With the {site.name} Instagram Story Viewer you'll be able to watch
            public stories anonymously and keep up with friends, family or colleagues without them seeing your name in their viewer list. It
            works on any device, with no login and no Instagram account required.
          </p>
          <div className="mt-8 flex justify-center">
            <Button href="/story-viewer" className="!px-8 !py-3.5 text-base sm:text-lg">Instagram Story Viewer</Button>
          </div>
        </div>
      </section>

      <Footer />
      <ChatBubble />
    </div>
  );
}
