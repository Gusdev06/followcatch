import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Footer, Header } from "../components/ui";
import { ErrorCard } from "../components/funnel/ErrorCard";
import { isMock, mockApi } from "../components/funnel/mock";
import { LABEL, ProfileBlock, Similar } from "../components/funnel/Preview";
import { Avatar, fmt, IgGlyph, Spinner, VerifiedBadge } from "../components/funnel/shared";
import { useSearch, type Slot } from "../components/funnel/useSearch";
import { site } from "../config/site";
import { api, isValidUsername, normalizeUsername, type RecentSearch } from "../lib/api";
import { isActive, useMe } from "../lib/session";
import { isLocked, type FollowItem, type FollowList, type Gender, type Me } from "../lib/types";

const mockQ = () => (isMock() ? "&mock=1" : "");
const appHref = (u: string) => `/app?u=${encodeURIComponent(u)}${mockQ()}`;
const PAGE = 60;

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!isFinite(s) || s < 0) return "";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
const dateFmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

/* ---------- plano + portal ---------- */
function PlanBar({ me }: { me: Me }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const plan = site.plans.find((p) => p.id === me.plan);
  const pill = me.status === "active"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-amber-50 text-amber-700 border-amber-200";
  const portal = async () => {
    setBusy(true); setErr(false);
    try {
      if (isMock()) throw new Error("mock");
      const { url } = await api.billingPortal();
      window.location.href = url;
    } catch { setBusy(false); setErr(true); }
  };
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-white p-4 shadow-[0_12px_32px_-24px_rgba(17,24,39,0.3)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold text-ink">{plan ? `${plan.name} plan` : "Your plan"}{me.cycle ? ` · ${me.cycle === "weekly" ? "Weekly" : "Quarterly"}` : ""}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${pill}`}>{me.status.replace("_", " ")}</span>
        </div>
        <div className="mt-0.5 truncate text-[13px] text-gray-500">
          {me.email}{me.renewsAt ? ` · renews ${dateFmt(me.renewsAt)}` : ""}
        </div>
      </div>
      <div className="flex flex-col items-stretch gap-1 sm:items-end">
        <Button variant="outline" onClick={() => void portal()} className="!rounded-xl !py-2 text-sm">
          {busy ? <><Spinner className="h-4 w-4" /> Opening…</> : "Manage subscription"}
        </Button>
        {err && <span className="text-center text-xs text-red-500 sm:text-right">Couldn't open billing. Try again in a moment.</span>}
      </div>
    </div>
  );
}

/* ---------- busca ---------- */
function DashSearch({ initial, inputRef }: { initial: string; inputRef: React.RefObject<HTMLInputElement> }) {
  const [v, setV] = useState(initial);
  const [bad, setBad] = useState(false);
  const nav = useNavigate();
  useEffect(() => setV(initial), [initial]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const u = normalizeUsername(v);
        if (!isValidUsername(u)) return setBad(true);
        nav(appHref(u));
      }}
    >
      <div className={`flex items-center gap-2 rounded-2xl border bg-white p-2 pl-3 shadow-[0_8px_30px_-12px_rgba(17,24,39,0.18)] ${bad ? "border-red-300" : "border-line"}`}>
        <IgGlyph className="h-6 w-6 shrink-0" />
        <span className="h-6 w-px bg-line" />
        <input
          ref={inputRef}
          value={v}
          onChange={(e) => { setV(e.target.value); setBad(false); }}
          placeholder="Search any public username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Instagram username"
          className="min-w-0 flex-1 bg-transparent px-1 text-base font-medium text-ink outline-none placeholder:text-gray-400"
        />
        <button type="submit" className="shrink-0 rounded-xl bg-cta px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_18px_-6px_rgba(255,45,85,0.55)] hover:brightness-105 sm:px-5">
          Search
        </button>
      </div>
      {bad && <p className="mt-2 text-sm text-red-500">Use letters, numbers, dots or underscores (max 30).</p>}
    </form>
  );
}

function Recent({ current }: { current: string }) {
  const [items, setItems] = useState<RecentSearch[] | null>(null);
  useEffect(() => {
    let alive = true;
    (isMock() ? mockApi.searches() : api.searches()).then(
      (r) => alive && setItems(r.items),
      () => alive && setItems([]),
    );
    return () => { alive = false; };
  }, [current]);
  // a busca atual entra na hora, mesmo antes do servidor registrar
  const list = useMemo(() => {
    const base = items ?? [];
    const merged = current && !base.some((i) => i.username === current) ? [{ username: current, at: new Date().toISOString() }, ...base] : base;
    return merged.slice(0, 12);
  }, [items, current]);
  if (items === null) return <div className="h-9" aria-hidden />;
  if (!list.length) return <p className="text-sm text-gray-500">Your searches will show up here.</p>;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
      {list.map((r) => (
        <Link
          key={r.username}
          to={appHref(r.username)}
          aria-current={r.username === current ? "page" : undefined}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition ${r.username === current ? "border-pink-300 bg-pink-50 font-semibold text-brand-magenta" : "border-line bg-white text-gray-700 hover:border-pink-200"}`}
        >
          @{r.username}
          <span className="text-[11px] font-normal text-gray-400">{ago(r.at)}</span>
        </Link>
      ))}
    </div>
  );
}

/* ---------- lista completa ---------- */
type Filter = "all" | Gender;
const FILTERS: [Filter, string][] = [["all", "All"], ["female", "Girls"], ["male", "Boys"], ["other", "Others"]];

function Row({ a, newest }: { a: FollowItem; newest: boolean }) {
  return (
    <li>
      <a
        href={`https://www.instagram.com/${a.username}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-pink-50/60 sm:px-3"
      >
        <Avatar url={a.picUrl} name={a.username} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-ink">@{a.username}</span>
            {a.verified && <VerifiedBadge className="h-4 w-4" />}
            {newest && <span className="shrink-0 rounded-full bg-cta px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">newest</span>}
          </div>
          <div className="truncate text-[13px] text-gray-500">{a.fullName || " "}{a.private ? " · private" : ""}</div>
        </div>
        <span className="shrink-0 text-base" title={LABEL[a.gender].word} aria-hidden>{LABEL[a.gender].emoji}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2" aria-label="Open on Instagram">
          <path d="M8 4h8v8M16 4l-9 9M13 16H4V7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </li>
  );
}

function FullList({ slot, kind, target }: { slot: Slot<FollowList>; kind: "following" | "followers"; target: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  useEffect(() => { setShown(PAGE); }, [filter, kind]);
  const all = useMemo(
    () => (slot.data?.items ?? []).filter((i): i is FollowItem => !isLocked(i)).sort((a, b) => a.rank - b.rank),
    [slot.data],
  );
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: all.length, female: 0, male: 0, other: 0 };
    all.forEach((i) => { c[i.gender]++; });
    return c;
  }, [all]);

  if (slot.status === "loading" || slot.status === "idle")
    return <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-gray-500"><Spinner className="h-7 w-7" />Loading {kind}…</div>;
  if (slot.status === "error")
    return (
      <div className="rounded-card border border-dashed border-line bg-[#fafbfc] px-4 py-8 text-center text-sm text-gray-600">
        {slot.error === "private" ? `@${target} is private, so this list isn't public.` : `We couldn't load the ${kind} list right now. Refresh in a minute.`}
      </div>
    );
  if (slot.data?.locked)
    return (
      <div className="rounded-card border border-dashed border-pink-200 bg-pink-50/50 px-4 py-8 text-center text-sm text-gray-700">
        Your plan isn't active right now, so this list is locked. <Link to="/plans" className="font-semibold text-brand-magenta underline">See plans</Link>
      </div>
    );

  const items = filter === "all" ? all : all.filter((i) => i.gender === filter);
  const newestRank = all[0]?.rank;
  return (
    <div>
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter by gender">
        {FILTERS.map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${filter === f ? "border-transparent bg-ink text-white" : "border-line bg-white text-gray-700 hover:border-gray-300"}`}
          >
            {label} <span className={filter === f ? "text-white/70" : "text-gray-400"}>{fmt(counts[f])}</span>
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="px-2 py-8 text-center text-sm text-gray-500">No {filter === "all" ? kind : `${LABEL[filter as Gender].word} in ${kind}`} to show for @{target}.</p>
      ) : (
        <>
          <p className="mb-1 px-2 text-xs text-gray-400 sm:px-3">Newest first{slot.data && slot.data.total > all.length ? ` · showing ${fmt(all.length)} of ${fmt(slot.data.total)}` : ""}</p>
          <ul className="divide-y divide-line">
            {items.slice(0, shown).map((a) => <Row key={a.username} a={a} newest={a.rank === newestRank} />)}
          </ul>
          {items.length > shown && (
            <div className="mt-3 text-center">
              <Button variant="outline" onClick={() => setShown(shown + PAGE)} className="!rounded-xl !py-2 text-sm">Show more ({fmt(items.length - shown)})</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Result({ raw, inputRef }: { raw: string; inputRef: React.RefObject<HTMLInputElement> }) {
  const s = useSearch(raw);
  const [tab, setTab] = useState<"following" | "followers">("following");
  useEffect(() => { document.title = `@${s.username} · Dashboard | FollowCatch`; }, [s.username]);

  if (s.profile.status === "error")
    return (
      <ErrorCard
        code={s.profile.error ?? "provider_error"}
        username={s.username}
        subscriber
        onRetry={() => { inputRef.current?.select(); inputRef.current?.focus(); }}
      />
    );
  if (!s.profile.data)
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-line bg-white py-16 text-sm text-gray-500">
        <Spinner className="h-8 w-8" />
        Loading @{s.username}…
      </div>
    );
  const p = s.profile.data;
  const count = (k: "following" | "followers") => {
    const d = s[k].data;
    return d ? d.total : k === "following" ? p.following : p.followers;
  };
  return (
    <div className="overflow-hidden rounded-card border border-line bg-white shadow-[0_20px_50px_-28px_rgba(17,24,39,0.25)]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <span className="truncate text-[13px] font-medium text-gray-500">Updated {dateFmt(p.fetchedAt) || "just now"}</span>
        <a href={`https://www.instagram.com/${p.username}/`} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-brand-magenta hover:underline">
          <IgGlyph className="h-4 w-4" /> Open on Instagram
        </a>
      </div>
      <Similar items={p.similar} hrefFor={appHref} />
      <ProfileBlock p={p} />
      <div className="px-4 pb-5 pt-5 sm:px-5">
        <div className="mb-4 grid grid-cols-2 border-b border-line" role="tablist">
          {(["following", "followers"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 py-3 text-[15px] capitalize transition ${tab === k ? "border-brand-magenta font-semibold text-brand-magenta" : "border-transparent text-gray-600 hover:text-ink"}`}
            >
              {k} <span className="text-[13px] font-normal text-gray-400">{fmt(count(k))}</span>
            </button>
          ))}
        </div>
        <FullList key={tab} slot={s[tab]} kind={tab} target={p.username} />
      </div>
    </div>
  );
}

function Stories() {
  return (
    <div className="flex items-center gap-4 rounded-card border border-line bg-gradient-to-r from-[#fff4f7] to-[#f7f3ff] p-4 sm:p-5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ig p-[3px]">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-xl" aria-hidden>👀</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold text-ink">Anonymous stories</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-magenta shadow-sm">Coming soon</span>
        </div>
        <p className="mt-0.5 text-[13px] text-gray-600">Watch public stories without showing up in the viewer list. It's on the way for your plan.</p>
      </div>
    </div>
  );
}

/* ---------- página ---------- */
export default function Dashboard() {
  const { me, loading } = useMe();
  const [params] = useSearchParams();
  const raw = normalizeUsername(params.get("u") ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!raw) document.title = "Dashboard | FollowCatch"; }, [raw]);

  if (loading)
    return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>;
  if (!me) return <Navigate to={`/login${raw ? `?username=${encodeURIComponent(raw)}` : ""}`} replace />;
  if (me.status === "none" || me.status === "canceled") return <Navigate to={`/plans${raw ? `?username=${encodeURIComponent(raw)}` : ""}`} replace />;

  return (
    <div className="flex min-h-screen flex-col bg-[#fbfbfd]">
      <Header />
      <main className="flex-1 px-4 pb-16 pt-6 sm:pt-8">
        <div className="mx-auto w-full max-w-3xl space-y-5">
          <div>
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-ink sm:text-[32px]">Dashboard</h1>
            <p className="mt-1 text-[15px] text-gray-600">Full lists, newest first. Nothing is blurred on your plan.</p>
          </div>
          <PlanBar me={me} />
          {isActive(me) ? (
            <>
              <DashSearch initial={raw} inputRef={inputRef} />
              <section aria-label="Recent searches">
                <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-gray-500">Recent searches</h2>
                <Recent current={isValidUsername(raw) ? raw : ""} />
              </section>
              {raw ? (
                <Result key={raw} raw={raw} inputRef={inputRef} />
              ) : (
                <div className="rounded-card border border-dashed border-line bg-white px-6 py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-pink-50"><IgGlyph className="h-7 w-7" /></div>
                  <h2 className="mt-4 text-lg font-bold text-ink">Search an account to get started</h2>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-gray-600">Type any public Instagram username above to see everyone they recently followed and who recently followed them.</p>
                </div>
              )}
              <Stories />
            </>
          ) : (
            <div className="rounded-card border border-amber-200 bg-amber-50 px-5 py-6 text-center">
              <h2 className="text-lg font-bold text-ink">Your last payment didn't go through</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-700">Update your card under “Manage subscription” above to unlock your lists again.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
