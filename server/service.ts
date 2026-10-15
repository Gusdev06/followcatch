// Regras de negócio da busca: cache, dedup de requisição em voo, rate limit, teto de gasto.
import type { ApiErrorCode, FollowList, MiniAccount, Profile } from "../src/lib/types";
import { TTL, cacheGet, cacheSet, claimSearch, logRun, spentToday } from "./cache";
import { classify } from "./gender";
import { ACTORS, ProviderError, runActor, toList, toProfile, type Kind } from "./providers/apify";

export class ApiErr extends Error {
  constructor(public code: ApiErrorCode, public status: 400 | 403 | 404 | 429 | 502, message: string) {
    super(message);
  }
}

const FREE = () => Number(process.env.FREE_SEARCHES_PER_IP || 5);
const MAX_USD = () => Number(process.env.MAX_DAILY_USD || 3);

// custo previsto no pior caso, pra checar o teto ANTES de gastar
const PREVISTO: Record<Kind, number> = { profile: ACTORS.profile.cost(1), following: 50 * 0.0014, followers: 50 * 0.0014 };

export function normalizeUsername(raw: string | undefined): string {
  const u = (raw ?? "")
    .trim()
    .replace(/^@+/, "")
    .replace(/.*instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(u)) throw new ApiErr("invalid", 400, "Invalid Instagram username.");
  return u;
}

// ---- dedup -----------------------------------------------------------------
const inflight = new Map<string, Promise<unknown>>();
function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const ja = inflight.get(key) as Promise<T> | undefined;
  if (ja) return ja;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Porta de gasto: teto diário global + buscas novas por IP. Só roda em cache miss. */
function gate(kind: Kind, username: string, ip: string) {
  const { usd } = spentToday();
  if (usd + PREVISTO[kind] > MAX_USD()) {
    throw new ApiErr("rate_limited", 429, "We're at capacity for today. Please try again tomorrow.");
  }
  if (!claimSearch(ip, username, FREE())) {
    throw new ApiErr("rate_limited", 429, `Free search limit reached (${FREE()} per day). Try again tomorrow.`);
  }
}

async function run(kind: Kind, username: string) {
  try {
    const r = await runActor(kind, username);
    logRun({ actor: r.actor, username, itens: r.items.length, custo: r.cost, ms: r.ms, ok: true });
    console.log(`[run] ${kind} @${username}: ${r.items.length} itens, ${r.ms} ms, ~US$${r.cost.toFixed(4)}`);
    return r;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[run] ${kind} @${username} falhou: ${msg}`);
    // run com erro pode ter cobrado a partida; registra com custo 0 pra auditoria
    logRun({ actor: ACTORS[kind].slug, username, itens: 0, custo: 0, ms: 0, ok: false });
    throw new ApiErr("provider_error", 502, e instanceof ProviderError ? "Data provider failed. Please try again." : msg);
  }
}

// ---- perfil ----------------------------------------------------------------
type ProfileEntry = { status: "ok"; profile: Profile } | { status: "not_found" };

async function loadProfile(username: string, ip: string): Promise<ProfileEntry> {
  const key = `profile:${username}`;
  const hit = cacheGet<ProfileEntry>(key);
  if (hit) return hit;
  return once(key, async () => {
    const again = cacheGet<ProfileEntry>(key);
    if (again) return again;
    gate("profile", username, ip);
    const r = await run("profile", username);
    const p = toProfile(r.items, username);
    if (!p) {
      const neg: ProfileEntry = { status: "not_found" };
      cacheSet(key, neg, TTL.negative);
      return neg;
    }
    const entry: ProfileEntry = { status: "ok", profile: { ...p, fetchedAt: new Date().toISOString() } };
    // privado = cache negativo (1 h): pode abrir a conta a qualquer momento
    cacheSet(key, entry, p.private ? TTL.negative : TTL.profile);
    return entry;
  });
}

/** Perfil privado volta 200 com private:true (o card aparece); só as listas dão 403. */
export async function getProfile(username: string, ip: string): Promise<Profile> {
  const e = await loadProfile(username, ip);
  if (e.status === "not_found") throw new ApiErr("not_found", 404, `@${username} doesn't exist on Instagram.`);
  return e.profile;
}

/** Só pra ler o nome sem disparar run (usado em /api/gender). */
export function cachedProfile(username: string): Profile | null {
  const e = cacheGet<ProfileEntry>(`profile:${username}`);
  return e?.status === "ok" ? e.profile : null;
}

// ---- listas ----------------------------------------------------------------
type ListEntry = { items: MiniAccount[]; fetchedAt: string };

export async function getList(kind: "following" | "followers", username: string, ip: string): Promise<FollowList> {
  const key = `${kind}:${username}`;
  let entry = cacheGet<ListEntry>(key);
  if (!entry) {
    // Checa o perfil primeiro: privado/inexistente não gasta run de lista.
    const p = await getProfile(username, ip);
    if (p.private) throw new ApiErr("private", 403, `@${username} is a private account.`);
    entry = await once(key, async () => {
      const again = cacheGet<ListEntry>(key);
      if (again) return again;
      gate(kind, username, ip);
      const r = await run(kind, username);
      const e: ListEntry = { items: toList(r.items, username), fetchedAt: new Date().toISOString() };
      // vazio não entra no cache: run vazio do datadoping custa 0, e pode ter sido soluço do provedor
      if (e.items.length > 0) cacheSet(key, e, TTL.list);
      return e;
    });
  }
  const genders = await classify(entry.items.map((m) => ({ username: m.username, fullName: m.fullName })));
  return {
    username,
    kind,
    fetchedAt: entry.fetchedAt,
    items: entry.items.map((m, rank) => ({ ...m, gender: genders.get(m.username) ?? "other", rank })),
  };
}
