import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { site } from "../config/site";
import { Button, Footer, Header, PromoBar } from "../components/ui";
import { normalizeUsername, isValidUsername } from "../lib/api";
import { parseCycle, PLAN_BLURB, priceOf, type Cycle, type Plan } from "../components/funnel/plan";
import { Check, money, Sparkles } from "../components/funnel/shared";

const FAQ = [
  ["Will the person know I looked them up?", "No. We read only what Instagram already shows publicly, and nothing is sent to the account you check."],
  ["Do I need to log in to Instagram?", "No. You never connect your Instagram account or share a password with us."],
  ["Does it work on private accounts?", "No. FollowCatch only covers public profiles. If an account is private, its lists aren't available to anyone outside it."],
  ["How fresh is the data?", "Every lookup pulls the latest public lists, sorted newest first, so you see the most recent follows at the top."],
  ["Can I cancel anytime?", "Yes. Cancel whenever you want. Your access lasts until the end of the period you already paid for."],
  ["What if it doesn't work for me?", "New subscriptions come with a 7-day money-back guarantee. Email us and we'll refund you in full."],
] as const;

function ApplePay() {
  return <span className="inline-flex items-center gap-0.5 rounded-md border border-line bg-white px-2 py-0.5 text-[12px] font-semibold text-black"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden><path fill="currentColor" d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8C6.9 7.4 5.4 8.3 4.6 9.8c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.4 3 2.4 1.2 0 1.6-.8 3.1-.8s1.8.8 3.1.8 2.1-1.2 2.9-2.4c.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.8-1-2.8-4.1zM14.1 5.6c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3z" /></svg>Pay</span>;
}
function GooglePay() {
  return <span className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-0.5 text-[12px] font-semibold text-gray-800"><span className="font-bold"><span className="text-[#4285F4]">G</span></span>Pay</span>;
}

function PlanCard({ plan, cycle, username, featured }: { plan: Plan; cycle: Cycle; username: string; featured: boolean }) {
  const pr = priceOf(plan, cycle);
  const href = `/signup?plan=${plan.id}&cycle=${cycle}${username ? `&username=${encodeURIComponent(username)}` : ""}`;
  return (
    <div className={`relative flex flex-col rounded-[20px] border-2 bg-white p-6 sm:p-7 ${featured ? "border-pink-300 shadow-[0_24px_60px_-30px_rgba(225,48,108,0.55)]" : "border-orange-100 shadow-[0_20px_50px_-34px_rgba(17,24,39,0.3)]"}`}>
      {featured && <span className="absolute -top-3 left-6 rounded-full bg-cta px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">Everything included</span>}
      <h3 className="text-[22px] font-bold text-ink">{plan.name} Plan</h3>
      <p className="mt-1 text-sm text-gray-600">{PLAN_BLURB[plan.id] ?? ""}</p>
      <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[34px] font-extrabold leading-none tracking-tight text-ink sm:text-[38px]">{money(pr.perWeek)}</span>
        <span className="text-base font-semibold text-gray-400 line-through">{money(pr.anchor)}</span>
        <span className="text-[15px] text-gray-600">/week</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-600">
          {pr.anchorOff}% OFF{cycle === "quarterly" ? ` + ${Math.round(site.quarterlyDiscount * 100)}% OFF` : ""}
        </span>
        <span className="text-[13px] text-gray-600">{pr.billed}</span>
      </div>
      <Button href={href} className="mt-6 w-full !rounded-xl !py-3.5 text-base">Get Started</Button>
      <ul className="mt-6 space-y-3">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-[15px] text-gray-700">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Plans() {
  const [params] = useSearchParams();
  const rawU = normalizeUsername(params.get("username") ?? "");
  const username = isValidUsername(rawU) ? rawU : "";
  const [cycle, setCycle] = useState<Cycle>(parseCycle(params.get("cycle")));
  const [open, setOpen] = useState<number | null>(0);
  const { testimonials, recentSubscriptions } = site.socialProof;

  useEffect(() => { document.title = "Plans & pricing | FollowCatch"; }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <PromoBar />
      <Header />
      <main className="relative isolate flex-1 px-4 pb-16 pt-10 sm:pt-14">
        <Sparkles />
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
            {username ? <>Unlock everything <span className="bg-cta bg-clip-text text-transparent">@{username}</span> follows</> : "Choose your plan"}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-gray-600 sm:text-lg">
            Pick a plan and start right away: recent following and followers, unfollow alerts and anonymous story viewing.
          </p>

          <div className="mx-auto mt-7 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-pink-100 bg-pink-50/70 px-4 py-2 text-[13px] text-gray-700">
            One-tap checkout with <ApplePay /> <GooglePay /> or card
          </div>

          <div className="mt-7 flex items-center justify-center gap-3">
            <div className="inline-flex rounded-full border border-line bg-white p-1 shadow-sm" role="tablist">
              {(["weekly", "quarterly"] as const).map((c) => (
                <button
                  key={c}
                  role="tab"
                  aria-selected={cycle === c}
                  onClick={() => setCycle(c)}
                  className={`rounded-full px-4 py-2 text-[13px] font-bold uppercase tracking-wide transition sm:px-5 ${cycle === c ? "bg-cta text-white shadow" : "text-gray-600 hover:text-ink"}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <span className="rounded-full bg-cta px-3 py-1.5 text-xs font-bold text-white shadow-[0_6px_18px_-6px_rgba(255,45,85,0.6)]">🎉 30% OFF</span>
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
          {site.plans.map((p, i) => <PlanCard key={p.id} plan={p} cycle={cycle} username={username} featured={i === 0} />)}
        </div>

        {/* garantia */}
        <div className="mx-auto mt-10 flex max-w-4xl flex-col items-center gap-4 rounded-card border border-emerald-100 bg-emerald-50/60 p-6 text-center sm:flex-row sm:text-left">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-sm" aria-hidden>🛡️</div>
          <div>
            <h2 className="text-lg font-bold text-ink">7-day money-back guarantee</h2>
            <p className="mt-1 text-sm text-gray-600">Not what you expected? Email {site.supportEmail} within 7 days of your first payment and we'll refund you in full.</p>
          </div>
        </div>

        {/* prova social: só quando for real (site.ts) */}
        {recentSubscriptions.length > 0 && (
          <div className="mx-auto mt-10 max-w-4xl space-y-2">
            {recentSubscriptions.slice(0, 6).map((r, i) => (
              <div key={i} className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-gray-700">
                <b>{r.name}</b> subscribed to {r.plan} · {r.at}
              </div>
            ))}
          </div>
        )}
        {testimonials.length > 0 && (
          <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
            {testimonials.map((t, i) => (
              <figure key={i} className="rounded-card border border-line bg-white p-5">
                <blockquote className="text-[15px] text-gray-700">“{t.text}”</blockquote>
                <figcaption className="mt-3 text-sm font-semibold text-ink">{t.name} <span className="font-normal text-gray-400">· {t.source}</span></figcaption>
              </figure>
            ))}
          </div>
        )}

        {/* FAQ */}
        <div className="mx-auto mt-14 max-w-3xl">
          <h2 className="text-center text-2xl font-extrabold text-ink sm:text-3xl">Questions, answered</h2>
          <div className="mt-6 divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
            {FAQ.map(([q, a], i) => (
              <div key={q}>
                <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-ink hover:bg-gray-50" aria-expanded={open === i}>
                  {q}
                  <span className={`text-xl leading-none text-gray-400 transition ${open === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {open === i && <p className="px-5 pb-4 text-[15px] text-gray-600">{a}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <Button href={`/signup?plan=${site.plans[0].id}&cycle=${cycle}${username ? `&username=${encodeURIComponent(username)}` : ""}`} className="!px-8 !py-3.5 text-base">
            Get Started with {site.plans[0].name}
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
