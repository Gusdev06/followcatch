import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { isLocked, type FollowItem, type FollowList, type Gender, type LockedItem, type Profile } from "../../lib/types";
import { Button } from "../ui";
import type { Slot } from "./useSearch";
import { searchHref } from "./SearchBar";
import { Arrow, Avatar, fmt, IgGlyph, Spinner, VerifiedBadge } from "./shared";

const plansHref = (u: string) => `/plans?username=${encodeURIComponent(u)}`;

/* ---------- topo: @ + Reveal ---------- */
function TopRow({ username }: { username: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-50"><IgGlyph className="h-5 w-5" /></span>
        <span className="truncate font-semibold text-ink">{username}</span>
      </div>
      <Button href={plansHref(username)} className="!rounded-lg !px-3.5 !py-2 text-sm">Reveal Full Profile</Button>
    </div>
  );
}

/* ---------- Similar accounts ---------- */
export function Similar({ items, hrefFor = searchHref }: { items: Profile["similar"]; hrefFor?: (u: string) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  if (!items.length) return null;
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * 280, behavior: "smooth" });
  return (
    <div className="border-b border-line px-4 py-3 sm:px-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-medium text-gray-500">Similar accounts</span>
        <div className="hidden gap-1 sm:flex">
          <button onClick={() => scroll(-1)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-ink" aria-label="Scroll left"><Arrow className="h-4 w-4 rotate-180" /></button>
          <button onClick={() => scroll(1)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-ink" aria-label="Scroll right"><Arrow className="h-4 w-4" /></button>
        </div>
      </div>
      <div ref={ref} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 [&::-webkit-scrollbar]:hidden">
        {items.map((a) => (
          <Link
            key={a.username}
            to={hrefFor(a.username)}
            className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-[#fafbfc] py-1 pl-1 pr-3.5 transition hover:border-pink-200 hover:bg-pink-50/60"
          >
            <Avatar url={a.picUrl} name={a.username} size={32} />
            <span className="leading-tight">
              <span className="flex items-center gap-1 text-[13px] font-semibold text-ink">@{a.username}{a.verified && <VerifiedBadge className="h-3.5 w-3.5" />}</span>
              <span className="block max-w-[150px] truncate text-[11px] text-gray-500">{a.fullName || " "}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------- card do perfil ---------- */
export function ProfileBlock({ p }: { p: Profile }) {
  const stats = [[p.posts, "Posts"], [p.followers, "Followers"], [p.following, "Following"]] as const;
  return (
    <div className="px-4 pt-5 sm:px-5">
      <div className="flex items-center gap-4 sm:gap-6">
        <Avatar url={p.picUrl} name={p.username} size={84} ring className="sm:!h-[88px] sm:!w-[88px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate text-lg font-bold text-ink">{p.username}</h1>
            {p.verified && <VerifiedBadge className="h-[18px] w-[18px]" />}
            {p.private && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">Private</span>}
          </div>
          <div className="mt-2 flex gap-5 sm:gap-8">
            {stats.map(([n, l]) => (
              <div key={l} className="text-center sm:text-left">
                <div className="text-[15px] font-bold leading-tight text-ink sm:text-base">{fmt(n)}</div>
                <div className="text-xs text-gray-500">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {(p.fullName || p.bio) && (
        <div className="mt-4">
          {p.fullName && <div className="font-semibold text-ink">{p.fullName}</div>}
          {p.bio && <p className="mt-0.5 whitespace-pre-line text-sm text-gray-700">{p.bio}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------- cards por gênero ---------- */
export const LABEL: Record<Gender, { word: string; emoji: string }> = {
  female: { word: "girls", emoji: "👧" },
  male: { word: "boys", emoji: "👦" },
  other: { word: "others", emoji: "👤" },
};
const RECENCY = ["most recent", "recent", "earlier"];
// Placeholders fixos: o @ real dos borrados nunca entra no DOM.
const FAKE = ["hidden.handle", "locked_user", "xxxxxxxx.xx", "private.acc", "blurred__name", "xxxxx_xxxxx"];

/** Ordem do contrato: gênero oposto ao do perfil primeiro; desconhecido → girls primeiro; others por último. */
export function genderOrder(g: Gender | null): Gender[] {
  return g === "female" ? ["male", "female", "other"] : ["female", "male", "other"];
}

type Item = FollowItem | LockedItem;
type Group = { gender: Gender; items: Item[]; count: number; recency: string };

/** Teaser do contrato F2: os itens locked ocupam lugar e contam, mas não têm @/foto. `total` manda na contagem. */
function groupItems(list: FollowList, target: Gender | null): Group[] {
  const n = list.items.length;
  const scale = n > 0 && list.total > n ? list.total / n : 1;
  const groups = genderOrder(target)
    .map((gender) => {
      const items = list.items.filter((i) => i.gender === gender).sort((a, b) => a.rank - b.rank);
      return { gender, items, count: Math.max(items.length, Math.round(items.length * scale)), recency: "" };
    })
    .filter((g) => g.items.length > 0);
  // rótulo de tempo honesto: só a ordem relativa do item mais novo de cada grupo
  [...groups].sort((a, b) => a.items[0].rank - b.items[0].rank).forEach((g, i) => { g.recency = RECENCY[i] ?? "earlier"; });
  return groups;
}

const Handle = ({ children }: { children: ReactNode }) => <span className="font-medium text-[#2563eb]">{children}</span>;
const Hidden = ({ i }: { i: number }) => (
  <span className="select-none font-medium text-[#2563eb] blur-[4px]" aria-label="hidden account">@{FAKE[i % FAKE.length]}</span>
);

function GroupCard({ g, target, kind, idx }: { g: Group; target: string; kind: "following" | "followers"; idx: number }) {
  const first = g.items.find((i): i is FollowItem => !isLocked(i));
  const restLen = g.count - (first ? 1 : 0);
  const blurred = Math.min(first ? 2 : 3, restLen);
  const others = restLen - blurred;
  const names: ReactNode[] = [
    ...(first ? [<Handle key="f">@{first.username}</Handle>] : []),
    ...Array.from({ length: blurred }, (_, i) => <Hidden key={i} i={idx * 3 + i} />),
  ];
  const list = names.map((n, i) => (
    <span key={i}>
      {n}
      {i < names.length - 1 ? (i === names.length - 2 && others === 0 ? " and " : ", ") : null}
    </span>
  ));
  const tail = others > 0 ? <> and {fmt(others)} {others === 1 ? "other" : "others"}</> : null;
  const l = LABEL[g.gender];
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5 rounded-card border border-line bg-white p-3.5 sm:grid-cols-[auto_1fr_auto] sm:gap-x-4 sm:p-4">
      <div className="order-1 flex shrink-0 items-center">
        {first && <Avatar url={first.picUrl} name={first.username} size={40} className="relative z-30 ring-2 ring-white" />}
        {Array.from({ length: Math.min(first ? 2 : 3, blurred) }, (_, i) => (
          <Avatar key={i} url="" name="" size={40} blur className={`relative ring-2 ring-white ${first || i > 0 ? "-ml-3" : ""} ${i === 0 ? "z-20" : "z-10"}`} />
        ))}
      </div>
      <div className="order-2 flex items-center justify-end gap-2 sm:order-3">
        <span className="whitespace-nowrap rounded-full border border-line bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm">
          {kind === "following" ? `followed ${l.word}` : `new ${l.word}`} {l.emoji}
        </span>
        <span className="whitespace-nowrap text-xs text-gray-400">{g.recency}</span>
      </div>
      <p className="order-3 col-span-2 min-w-0 text-[14px] leading-snug text-gray-700 sm:order-2 sm:col-span-1">
        {kind === "following" ? (
          <><Handle>@{target}</Handle> followed {list}{tail}</>
        ) : (
          <>{list}{tail} started following <Handle>@{target}</Handle></>
        )}
      </p>
    </div>
  );
}

function ListPanel({ slot, kind, target, gender }: { slot: Slot<FollowList>; kind: "following" | "followers"; target: string; gender: Gender | null }) {
  if (slot.status === "loading" || slot.status === "idle")
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-gray-500">
        <Spinner className="h-7 w-7" />
        Loading {kind}…
      </div>
    );
  if (slot.status === "error")
    return (
      <div className="rounded-card border border-dashed border-line bg-[#fafbfc] px-4 py-8 text-center text-sm text-gray-600">
        {slot.error === "private"
          ? `@${target} is private, so this list isn't public.`
          : slot.error === "rate_limited"
            ? "You've reached today's free lookups. Lists unlock with a plan."
            : `We couldn't load the ${kind} list right now. Refresh in a minute.`}
      </div>
    );
  const groups = slot.data ? groupItems(slot.data, gender) : [];
  if (!groups.length)
    return <div className="px-4 py-8 text-center text-sm text-gray-500">No {kind} to show for @{target} yet.</div>;
  return (
    <div className="space-y-3">
      {groups.map((g, i) => <GroupCard key={g.gender} g={g} target={target} kind={kind} idx={i} />)}
    </div>
  );
}

/* ---------- prévia completa ---------- */
export function Preview({ profile, following, followers, gender }: {
  profile: Profile; following: Slot<FollowList>; followers: Slot<FollowList>; gender: Gender | null;
}) {
  const [tab, setTab] = useState<"following" | "followers">("following");
  const u = profile.username;
  const tabs = [["followers", "Recent Followers"], ["following", "Recent Following"]] as const;
  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-card border border-line bg-white shadow-[0_20px_50px_-28px_rgba(17,24,39,0.25)]">
      <TopRow username={u} />
      <Similar items={profile.similar} />
      <ProfileBlock p={profile} />

      <div className="px-4 pb-5 pt-5 sm:px-5">
        <div className="mb-4 grid grid-cols-2 border-b border-line" role="tablist">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 py-3 text-[15px] transition ${tab === k ? "border-brand-magenta font-semibold text-brand-magenta" : "border-transparent text-gray-600 hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <ListPanel slot={tab === "following" ? following : followers} kind={tab} target={u} gender={gender} />
      </div>

      <div className="bg-gradient-to-b from-[#fff4f7] to-[#f7f3ff] px-5 py-10 text-center sm:px-10">
        <h2 className="text-2xl font-extrabold leading-tight text-ink sm:text-[32px]">Sign up &amp; see everything @{u} followed</h2>
        <p className="mx-auto mt-3 max-w-lg text-[15px] text-gray-600">
          Full following and follower lists, newest first, plus unfollow alerts and anonymous story viewing.
        </p>
        <Button href={plansHref(u)} className="mt-6 !px-8 !py-3.5 text-base">🚀 Reveal Full Profile</Button>
      </div>
    </div>
  );
}

/** Barra fixa no rodapé da prévia. */
export function StickyUnlock({ username }: { username: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-r from-[#ff9a3d] via-[#ff2d55] to-[#d62976] shadow-[0_-8px_24px_-12px_rgba(225,48,108,0.6)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:py-3.5">
        <span className="text-[15px] font-bold text-white sm:text-lg">Unlock the full list</span>
        <Link
          to={plansHref(username)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-white px-4 py-2 text-[15px] font-bold text-brand-magenta shadow hover:bg-pink-50 sm:px-5 sm:py-2.5"
        >
          🔥 Get Started <Arrow />
        </Link>
      </div>
    </div>
  );
}
