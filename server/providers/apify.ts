// Único lugar do server que fala com a Apify. Registro de actors: trocar de fornecedor
// é mudar uma entrada de ACTORS, não as rotas.
//
// Formatos conferidos em datasets reais:
//  - perfil (apify~instagram-profile-scraper, 15/10/2026): camelCase, followersCount, relatedProfiles (snake_case dentro)
//  - following/followers (scraping_solutions~*-no-cookies, 04/11/2026): snake_case + username_scrape.
//    Ordem do following conferida contra o app ("Date followed: latest"): idêntica. O datadoping,
//    usado antes, NÃO devolvia em ordem de recência. Detalhes e custos: docs/providers.md.
//
// Custos = preço da faixa FREE da Apify (plano atual). Ao assinar um plano, trocar pelos da faixa.

import type { MiniAccount } from "../../src/lib/types.js";

export type Kind = "profile" | "following" | "followers";

type ActorDef = {
  slug: string; // forma da API: dono~nome
  input: (username: string) => Record<string, unknown>;
  /** US$ estimado de um run que entregou `itens` itens */
  cost: (itens: number) => number;
  /** teto que vai em maxTotalChargeUsd: a própria Apify aborta antes de passar disso */
  maxChargeUsd: number;
};

const LIST_ACTOR = "scraping_solutions~instagram-scraper-followers-following-no-cookies";
/** Itens por lista. Custo é linear: subir isso sobe o custo de toda consulta nova. */
export const LIST_SIZE = 25;

export const ACTORS: Record<Kind, ActorDef> = {
  profile: {
    slug: "apify~instagram-profile-scraper",
    input: (u) => ({ usernames: [u] }),
    cost: (n) => Math.max(1, n) * 0.0026,
    maxChargeUsd: 0.02,
  },
  // resultsLimit mínimo é 25 no schema do actor. Cobrança por item entregue
  // (FREE 0,00085 · BRONZE 0,0007 · SILVER 0,00065 · GOLD 0,0006).
  following: {
    slug: LIST_ACTOR,
    input: (u) => ({ Account: [u], resultsLimit: LIST_SIZE, dataToScrape: "Followings" }),
    cost: (n) => n * 0.00085,
    maxChargeUsd: 0.05,
  },
  followers: {
    slug: LIST_ACTOR,
    input: (u) => ({ Account: [u], resultsLimit: LIST_SIZE, dataToScrape: "Followers" }),
    cost: (n) => n * 0.00085,
    maxChargeUsd: 0.05,
  },
};

export class ProviderError extends Error {}

export type RunResult = { items: Record<string, unknown>[]; actor: string; ms: number; cost: number };

export async function runActor(kind: Kind, username: string): Promise<RunResult> {
  const a = ACTORS[kind];
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new ProviderError("APIFY_TOKEN não configurado no server.");

  const url =
    `https://api.apify.com/v2/acts/${a.slug}/run-sync-get-dataset-items` +
    `?token=${encodeURIComponent(token)}&timeout=110&maxTotalChargeUsd=${a.maxChargeUsd}`;
  const t0 = Date.now();
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(a.input(username)),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    const n = e instanceof Error ? e.name : "";
    throw new ProviderError(
      n === "TimeoutError" || n === "AbortError" ? `Provedor não respondeu em 120 s (${kind}).` : `Falha de rede no provedor (${kind}).`,
    );
  }
  const raw = await resp.text();
  const ms = Date.now() - t0;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ProviderError(`Resposta não-JSON da Apify (HTTP ${resp.status}): ${raw.slice(0, 200)}`);
  }
  // sucesso = array de itens; erro = objeto {error:{message}}
  if (!Array.isArray(data)) {
    const msg = (data as { error?: { message?: string } })?.error?.message || raw.slice(0, 200);
    throw new ProviderError(`Actor ${a.slug} recusou o run (HTTP ${resp.status}): ${msg}`);
  }
  const items = data.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
  // Cobrança é por item entregue (antes de qualquer descarte nosso).
  return { items, actor: a.slug, ms, cost: a.cost(items.length) };
}

// ---- normalização ----------------------------------------------------------

/** Os actors variam o nome dos campos. Procura em todas as grafias. */
function campo(d: Record<string, unknown>, ...nomes: string[]): unknown {
  for (const n of nomes) {
    const v = d[n];
    if (v !== null && v !== undefined && v !== "") return v;
  }
  return undefined;
}
const str = (d: Record<string, unknown>, ...n: string[]) => {
  const v = campo(d, ...n);
  return v === undefined ? "" : String(v).trim();
};
const bool = (d: Record<string, unknown>, ...n: string[]) => {
  const v = campo(d, ...n);
  return v === true || v === "true" || v === 1 || v === "1";
};
/** contagens às vezes vêm como string ("1,234", "104368329") */
const num = (d: Record<string, unknown>, ...n: string[]) => {
  const v = campo(d, ...n);
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const x = Number(v.replace(/[,\s]/g, ""));
    return Number.isFinite(x) ? x : 0;
  }
  return 0;
};
const user = (s: string) => s.trim().replace(/^@+/, "").toLowerCase();

export function toMini(d: Record<string, unknown>): MiniAccount | null {
  const username = user(str(d, "username", "user_name", "userName"));
  if (!username) return null;
  return {
    username,
    fullName: str(d, "full_name", "fullName", "name"),
    picUrl: str(d, "profile_pic_url", "profilePicUrl", "profile_pic_url_hd", "profilePicUrlHD"),
    verified: bool(d, "is_verified", "isVerified", "verified"),
    private: bool(d, "is_private", "isPrivate", "private"),
  };
}

export type RawProfile = {
  username: string; fullName: string; bio: string; picUrl: string; verified: boolean; private: boolean;
  posts: number; followers: number; following: number; similar: MiniAccount[];
};

/**
 * null = o actor não trouxe o perfil (inexistente). O profile-scraper devolve item
 * com `error`/sem `username`/sem `id` quando o @ não existe, ou dataset vazio.
 */
export function toProfile(items: Record<string, unknown>[], wanted: string): RawProfile | null {
  const d =
    items.find((x) => user(str(x, "username")) === wanted && !campo(x, "error")) ??
    items.find((x) => !campo(x, "error") && str(x, "username"));
  if (!d || !str(d, "id", "pk")) return null;
  const similar: MiniAccount[] = [];
  const rel = campo(d, "relatedProfiles", "related_profiles");
  if (Array.isArray(rel)) {
    for (const r of rel) if (r && typeof r === "object") {
      const m = toMini(r as Record<string, unknown>);
      if (m) similar.push(m);
    }
  }
  return {
    username: user(str(d, "username")) || wanted,
    fullName: str(d, "fullName", "full_name"),
    bio: str(d, "biography", "bio"),
    picUrl: str(d, "profilePicUrlHD", "profilePicUrl", "profile_pic_url_hd", "profile_pic_url"),
    verified: bool(d, "verified", "is_verified"),
    private: bool(d, "private", "is_private"),
    posts: num(d, "postsCount", "posts_count", "mediaCount"),
    followers: num(d, "followersCount", "follower_count", "followers"),
    following: num(d, "followsCount", "following_count", "followingCount"),
    similar,
  };
}

/** Lista na ordem do dataset (= recência), sem duplicata, só itens do @ pedido. */
export function toList(items: Record<string, unknown>[], wanted: string): MiniAccount[] {
  const seen = new Set<string>();
  const out: MiniAccount[] = [];
  for (const d of items) {
    const src = user(str(d, "username_scrape", "following_of", "follower_of", "sourceUsername", "source_username"));
    if (src && src !== wanted) continue;
    const m = toMini(d);
    if (!m || seen.has(m.username) || m.username === wanted) continue;
    seen.add(m.username);
    out.push(m);
  }
  return out;
}
