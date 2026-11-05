// Regras de negócio da busca: cache, dedup de requisição em voo, rate limit, teto de gasto.
import type { ApiErrorCode, FollowItem, FollowList, LockedItem, MiniAccount, PlanId, Profile } from "../src/lib/types.js";
import { TTL, cacheGet, cacheSet, claimSearch, logRun, releaseClaim, spentToday, type Bucket } from "./cache.js";
import { classify } from "./gender.js";
import { ACTORS, LIST_SIZE, ProviderError, runActor, toList, toProfile, type Kind } from "./providers/apify.js";

export class ApiErr extends Error {
  constructor(public code: ApiErrorCode, public status: 400 | 401 | 403 | 404 | 409 | 429 | 502, message: string) {
    super(message);
  }
}

// ---- limites e orçamentos --------------------------------------------------
// Três camadas (docs/cost-strategy.md, seção 3):
//  1. Assinante: cota por dia e por semana (por plano). Só conta @ novo; cache hit não gasta.
//  2. Visitante: cota por IP + balde diário de gasto próprio (é o orçamento de marketing).
//  3. Disjuntor global: teto de gasto do dia para tudo junto, contra bug ou ataque.
// O balde dos visitantes é sempre menor que o disjuntor, então visitante sozinho nunca
// bloqueia assinante.
const FREE = () => Number(process.env.FREE_SEARCHES_PER_IP || 5);
const SUB_DAILY = () => Number(process.env.SUBSCRIBER_SEARCHES_PER_DAY || 10);
/** Consultas novas por semana (segunda 00:00 UTC), por plano. Derivadas de ~15% do líquido semanal. */
export const weeklyLimit = (plan: PlanId | null): number =>
  plan === "premium" ? Number(process.env.SUBSCRIBER_WEEKLY_PREMIUM || 40) : Number(process.env.SUBSCRIBER_WEEKLY_STARTER || 27);
const GLOBAL_USD = () => Number(process.env.MAX_DAILY_USD || 10);
const VISITOR_USD = () => Math.min(Number(process.env.VISITOR_DAILY_USD || 2), GLOBAL_USD());
export const budgets = () => ({ globalUsd: GLOBAL_USD(), visitorUsd: VISITOR_USD() });

/** Quem está buscando: visitante (limite por IP) ou assinante (limite por conta e por plano). */
export type Who = { ip: string; subscriberId: string | null; plan?: PlanId | null };
const whoKey = (w: Who) => (w.subscriberId ? `user:${w.subscriberId}` : `ip:${w.ip}`);
const bucketOf = (w: Who): Bucket => (w.subscriberId ? "subscriber" : "visitor");

// custo previsto no pior caso, pra checar o teto ANTES de gastar
const PREVISTO: Record<Kind, number> = {
  profile: ACTORS.profile.cost(1),
  following: ACTORS.following.cost(LIST_SIZE),
  followers: ACTORS.followers.cost(LIST_SIZE),
};

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

let breakerAlertedOn = "";
/** Avisa no log (uma vez por dia por instância) que o disjuntor global desarmou. */
function alertBreaker(usd: number) {
  const day = new Date().toISOString().slice(0, 10);
  if (breakerAlertedOn === day) return;
  breakerAlertedOn = day;
  console.error(`[ALERTA] disjuntor global: gasto estimado de hoje US$ ${usd.toFixed(2)} passou de US$ ${GLOBAL_USD()}. Novas coletas bloqueadas até 00:00 UTC. Conferir se é tráfego real, bug ou ataque.`);
}

/** Cota registrada por esta chamada (null = o @ já estava contado hoje). Devolva-a se a coleta falhar. */
export type Claim = { who: string; username: string } | null;
const release = (c: Claim) => (c ? releaseClaim(c.who, c.username).catch(() => undefined) : Promise.resolve());

/** Porta de gasto. Só roda em cache miss, antes de qualquer chamada paga. */
export async function gate(kind: Kind, username: string, who: Who): Promise<Claim> {
  const previsto = PREVISTO[kind];
  const total = (await spentToday()).usd;
  if (total + previsto > GLOBAL_USD()) {
    alertBreaker(total);
    throw new ApiErr("rate_limited", 429, "We're at capacity for today. Please try again tomorrow.");
  }
  if (who.subscriberId) {
    const weekly = weeklyLimit(who.plan ?? null);
    const key = `user:${who.subscriberId}`;
    const r = await claimSearch(key, username, { daily: SUB_DAILY(), weekly });
    if (r === "daily") {
      throw new ApiErr("rate_limited", 429, `Daily search limit reached (${SUB_DAILY()} new profiles per day). It resets at 00:00 UTC.`);
    }
    if (r === "weekly") {
      throw new ApiErr("rate_limited", 429, `Weekly search limit reached (${weekly} new profiles per week on your plan). It resets Monday at 00:00 UTC.`);
    }
    return r === "new" ? { who: key, username } : null;
  }
  // Visitante: o balde de marketing do dia vem antes da cota por IP.
  if ((await spentToday("visitor")).usd + previsto > VISITOR_USD()) {
    throw new ApiErr("rate_limited", 429, "Free searches are at capacity for today. Please try again tomorrow, or get a plan.");
  }
  const key = `ip:${who.ip}`;
  const r = await claimSearch(key, username, { daily: FREE(), weekly: null });
  if (r === "daily" || r === "weekly") {
    throw new ApiErr("rate_limited", 429, `Free search limit reached (${FREE()} per day). Try again tomorrow.`);
  }
  return r === "new" ? { who: key, username } : null;
}

async function run(kind: Kind, username: string, who: Who, timeoutS?: number) {
  try {
    const r = await runActor(kind, username, timeoutS);
    await logRun({ actor: r.actor, username, itens: r.items.length, custo: r.cost, ms: r.ms, ok: true, who: whoKey(who), bucket: bucketOf(who) });
    console.log(`[run] ${kind} @${username}: ${r.items.length} itens, ${r.ms} ms, ~US$${r.cost.toFixed(4)}`);
    return r;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[run] ${kind} @${username} falhou: ${msg}`);
    // run com erro pode ter cobrado a partida; registra com custo 0 pra auditoria
    await logRun({ actor: ACTORS[kind].slug, username, itens: 0, custo: 0, ms: 0, ok: false, who: whoKey(who), bucket: bucketOf(who) }).catch(() => undefined);
    throw new ApiErr("provider_error", 502, e instanceof ProviderError ? "Data provider failed. Please try again." : msg);
  }
}

// ---- perfil ----------------------------------------------------------------
type ProfileEntry = { status: "ok"; profile: Profile } | { status: "not_found" };

/** `meta.cache` = 'hit' (não pagou: cache, ou pegou carona numa coleta em voo) ou 'miss' (esta chamada coletou). */
export type LookupMeta = { cache?: "hit" | "miss" };

async function loadProfile(username: string, who: Who, meta: LookupMeta): Promise<ProfileEntry> {
  const key = `profile:${username}`;
  const hit = await cacheGet<ProfileEntry>(key);
  if (hit) {
    meta.cache = "hit";
    return hit;
  }
  let paid = false;
  const entry = await once(key, async () => {
    const again = await cacheGet<ProfileEntry>(key);
    if (again) return again;
    const claim = await gate("profile", username, who);
    paid = true;
    let r;
    try {
      r = await run("profile", username, who);
    } catch (e) {
      await release(claim); // falha do provedor não consome a cota de ninguém
      throw e;
    }
    const p = toProfile(r.items, username);
    if (!p) {
      const neg: ProfileEntry = { status: "not_found" };
      await cacheSet(key, neg, TTL.negative);
      return neg;
    }
    const entry: ProfileEntry = { status: "ok", profile: { ...p, fetchedAt: new Date().toISOString() } };
    // privado = cache negativo (1 h): pode abrir a conta a qualquer momento
    await cacheSet(key, entry, p.private ? TTL.negative : TTL.profile);
    return entry;
  });
  meta.cache = paid ? "miss" : "hit";
  return entry;
}

/** Perfil privado volta 200 com private:true (o card aparece); só as listas dão 403. */
export async function getProfile(username: string, who: Who, meta: LookupMeta = {}): Promise<Profile> {
  const e = await loadProfile(username, who, meta);
  if (e.status === "not_found") throw new ApiErr("not_found", 404, `@${username} doesn't exist on Instagram.`);
  return e.profile;
}

/** Só pra ler o nome sem disparar run (usado em /api/gender). */
export async function cachedProfile(username: string): Promise<Profile | null> {
  const e = await cacheGet<ProfileEntry>(`profile:${username}`);
  return e?.status === "ok" ? e.profile : null;
}

// ---- listas ----------------------------------------------------------------
type ListEntry = { items: MiniAccount[]; fetchedAt: string };

/** Lista completa (o cache guarda tudo). O recorte de teaser é feito em `teaser()`. */
// O actor das listas falha de forma intermitente: o run bom leva de 3 a 27 s; o ruim gasta ~65 s e
// devolve 0 item, sem custo. Desistir cedo e repetir cabe no limite de 120 s da Vercel (3 x ~31 s).
const LIST_ATTEMPTS = 3;
const LIST_ATTEMPT_TIMEOUT_S = 30;

/** Lista do provedor, repetindo falha ou vazio de um perfil que tem gente. Só item entregue é cobrado. */
async function fetchListItems(kind: "following" | "followers", username: string, who: Who, expected: number) {
  for (let attempt = 1; ; attempt++) {
    try {
      const items = toList((await run(kind, username, who, LIST_ATTEMPT_TIMEOUT_S)).items, username);
      if (items.length > 0 || expected === 0) return items;
      // Vazio com gente no perfil é falha do provedor, não lista vazia de verdade.
      if (attempt >= LIST_ATTEMPTS) throw new ApiErr("provider_error", 502, "Data provider returned no results. Please try again.");
    } catch (e) {
      if (attempt >= LIST_ATTEMPTS) throw e;
    }
  }
}

export async function getList(kind: "following" | "followers", username: string, who: Who): Promise<FollowList> {
  const key = `${kind}:${username}`;
  let entry = await cacheGet<ListEntry>(key);
  if (!entry) {
    // Checa o perfil primeiro: privado/inexistente não gasta run de lista.
    const p = await getProfile(username, who);
    if (p.private) throw new ApiErr("private", 403, `@${username} is a private account.`);
    entry = await once(key, async () => {
      const again = await cacheGet<ListEntry>(key);
      if (again) return again;
      const claim = await gate(kind, username, who);
      try {
        const expected = kind === "following" ? p.following : p.followers;
        const e: ListEntry = { items: await fetchListItems(kind, username, who, expected), fetchedAt: new Date().toISOString() };
        if (e.items.length > 0) await cacheSet(key, e, TTL.list);
        return e;
      } catch (err) {
        await release(claim); // falha nossa ou do provedor não consome a cota
        throw err;
      }
    });
  }
  const genders = await classify(entry.items.map((m) => ({ username: m.username, fullName: m.fullName })));
  const items: FollowItem[] = entry.items.map((m, rank) => ({ ...m, gender: genders.get(m.username) ?? "other", rank }));
  return { username, kind, fetchedAt: entry.fetchedAt, items, locked: false, total: items.length };
}

/**
 * Prévia pra quem não assina: no máximo 1 item real por gênero (o mais recente de cada
 * grupo); o resto vira LockedItem, sem username/nome/foto — o dado nem sai do servidor.
 */
export function teaser(list: FollowList): FollowList {
  const shown = new Set<string>();
  const items = list.items.map((it): FollowItem | LockedItem => {
    if ("locked" in it) return it;
    if (!shown.has(it.gender)) {
      shown.add(it.gender);
      return it;
    }
    return { locked: true, gender: it.gender, rank: it.rank };
  });
  return { ...list, items, locked: true, total: list.items.length };
}
