import { useState } from "react";
import { site } from "../config/site";
import { Button, ChatBubble, Decor, Faq, Footer, Header, PromoBar, UsernameForm, type FaqItem } from "../components/ui";

const INPUT_ID = "story-username";

const features = [
  { icon: "👁️", title: "Anonymous Viewing", text: "Watch public stories without showing up in the viewer list" },
  { icon: "🔒", title: "No Login Required", text: "No Instagram login and no app to sign in to" },
  { icon: "⚡", title: "Fast and Simple", text: "Enter a username and see their active public stories" },
  { icon: "🕵️", title: "100% Private", text: "Your searches are never shared with the account you check" },
];

const steps = [
  { title: "Enter a username", text: "Type the handle of any public Instagram account." },
  { title: "We check for active stories", text: "We look for public stories the account has posted in the last 24 hours." },
  { title: "Watch them privately", text: "View the stories without appearing in their viewer list." },
];

type Cell = boolean | string;
const premium = site.plans.find((p) => p.id === "premium");
const starter = site.plans.find((p) => p.id === "starter");
const tiers = [
  { name: "Free", price: "$0" },
  { name: starter?.name ?? "Starter", price: starter ? `$${starter.weekly}/week` : "" },
  { name: premium?.name ?? "Premium", price: premium ? `$${premium.weekly}/week` : "", highlight: true },
];
const rows: [string, Cell, Cell, Cell][] = [
  ["Search any public account", true, true, true],
  ["Profile preview", true, true, true],
  ["Recent following & followers", "Preview", "Up to 2 accounts", "Unlimited"],
  ["Unfollow alerts", false, true, true],
  ["Instagram story viewer", false, false, "Coming soon"],
  ["Support", false, "Email", "Priority"],
];

function CellView({ v }: { v: Cell }) {
  if (v === true) return <span className="font-bold text-emerald-600" aria-label="Included">✓</span>;
  if (v === false) return <span className="text-gray-300" aria-label="Not included">✕</span>;
  return <span className="text-[13px] font-semibold text-ink">{v}</span>;
}

const faq: FaqItem[] = [
  { q: "Will they know I watched their story?", a: "No. When stories become available, you'll view them through FollowCatch, so your name never appears in the account's story viewer list." },
  { q: "Can I watch stories from private accounts?", a: "No. We only work with public accounts and public content." },
  { q: "When will the story viewer be available?", a: "The story viewer is launching soon and will be included in the Premium plan. You can already use our follower tracker today." },
  { q: "Do I need an Instagram account?", a: "No. You don't need to log in to Instagram or even have an account." },
];

export default function StoryViewer() {
  const [searched, setSearched] = useState<string | null>(null);

  function onSubmit(u: string) {
    setSearched(u);
    setTimeout(() => document.getElementById("story-result")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  function backToSearch() {
    const el = document.getElementById(INPUT_ID) as HTMLInputElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => el?.focus({ preventScroll: true }), 450);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fffafa]">
      <PromoBar />
      <Header />

      <section className="relative bg-gradient-to-b from-[#fff1f4] via-[#fff6f5] to-[#fff8f4]">
        <Decor />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-10 text-center sm:pt-14">
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink/80 bg-white px-4 py-1.5 text-sm font-semibold text-ink shadow-[0_6px_16px_-8px_rgba(0,0,0,0.25)] sm:text-[15px]">
            <span aria-hidden>👁️</span> Anonymous Instagram Story Viewer
          </span>
          <h1 className="mx-auto mt-6 max-w-4xl text-[34px] font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-[56px]">
            Instagram Story Viewer: Watch Public Stories Without Being Seen
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-[17px] text-gray-600 sm:text-xl">
            Keep up with the people and brands you care about, privately. The {site.name} Story Viewer lets you watch public Instagram stories
            without your name ever showing up in their viewer list.
          </p>

          <div className="mx-auto mt-8 max-w-[520px]">
            <UsernameForm id={INPUT_ID} placeholder="@nasa" buttonLabel="View Stories 👁️" onSubmit={onSubmit} />
          </div>

          {searched && (
            <div id="story-result" className="mx-auto mt-6 max-w-[520px] rounded-card border border-pink-200 bg-white p-6 text-left shadow-[0_14px_36px_-18px_rgba(225,48,108,0.5)]">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ig p-[2.5px]">
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-xl">⏳</span>
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-500">@{searched}</p>
                  <h2 className="mt-0.5 text-lg font-bold leading-snug text-ink">Story viewer is launching soon</h2>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-gray-600">
                    Stories will be included in the Premium plan. Meanwhile, you can already see who @{searched} recently followed.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                <Button href={`/search?u=${encodeURIComponent(searched)}`} className="flex-1">Track their follows</Button>
                <Button href={`/plans?username=${encodeURIComponent(searched)}`} variant="outline" className="flex-1">See Premium</Button>
              </div>
            </div>
          )}

          <p className="mx-auto mt-7 max-w-3xl text-[15px] leading-relaxed text-gray-500 sm:text-base">
            Watch stories without leaving a trace. No login, no app installs, no browser extensions and no spammy redirects: just a fast,
            simple and private way to view public stories.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-card border border-line bg-white px-3 py-5 shadow-[0_6px_20px_-12px_rgba(17,24,39,0.18)]">
                <div className="text-3xl" aria-hidden>{f.icon}</div>
                <h3 className="mt-2 text-[15px] font-semibold text-ink">{f.title}</h3>
                <p className="mt-1 text-[13px] leading-snug text-gray-500">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-b from-[#fff8f4] to-[#fdf5fa] py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <h2 className="text-[28px] font-extrabold tracking-tight text-ink sm:text-4xl">How the Story Viewer Works</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className="rounded-card border border-line bg-white px-6 py-8 shadow-[0_10px_30px_-16px_rgba(17,24,39,0.25)]">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#e1306c] to-[#9b3fbf] font-bold text-white">{i + 1}</span>
                <h3 className="mt-4 text-lg font-bold text-ink">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-gray-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center text-[28px] font-extrabold tracking-tight text-ink sm:text-4xl">Compare Plans</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-gray-600">Stories will be part of Premium, together with everything in the follower tracker.</p>
          <div className="mt-10 overflow-x-auto rounded-card border border-pink-100 bg-white shadow-[0_12px_32px_-18px_rgba(225,48,108,0.45)]">
            <table className="w-full min-w-[340px] text-sm">
              <thead>
                <tr className="bg-cta text-white">
                  <th className="px-3 py-3.5 text-left text-xs font-bold sm:px-5 sm:text-sm">Feature</th>
                  {tiers.map((t) => (
                    <th key={t.name} className="px-2 py-3 text-center sm:px-4">
                      <div className="text-xs font-bold sm:text-sm">{t.name}</div>
                      <div className="text-[11px] font-medium opacity-90">{t.price}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, ...cells], i) => (
                  <tr key={label} className={`border-t border-line ${i % 2 ? "bg-[#fafbfc]" : ""}`}>
                    <td className="px-3 py-3.5 text-[13px] font-semibold text-ink sm:px-5 sm:text-sm">{label}</td>
                    {cells.map((c, ci) => (
                      <td key={ci} className={`px-2 py-3.5 text-center sm:px-4 ${tiers[ci].highlight ? "bg-pink-50/60" : ""}`}><CellView v={c} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-10 flex justify-center">
            <Button onClick={backToSearch} className="!px-8 !py-3.5 text-base sm:text-lg">View Stories</Button>
          </div>
        </div>
      </section>

      <section className="bg-[#f8f9fc] py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-[28px] font-extrabold tracking-tight text-ink sm:text-4xl">Story Viewer FAQ</h2>
          <div className="mt-10"><Faq items={faq} /></div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-[28px] font-extrabold tracking-tight text-ink sm:text-4xl">See Who They Recently Followed</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-gray-600">
            Our Instagram Follower Tracker is available now: check any public account's recent following, new followers and unfollows,
            sorted newest first.
          </p>
          <div className="mt-8 flex justify-center">
            <Button href="/" className="!px-8 !py-3.5 text-base sm:text-lg">Instagram Follower Tracker</Button>
          </div>
        </div>
      </section>

      <Footer />
      <ChatBubble />
    </div>
  );
}
