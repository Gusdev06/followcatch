// Cache e contadores do FollowCatch, no Postgres (schema followcatch). A interface é o
// que o resto do server enxerga.
import type { Gender } from "../src/lib/types.js";
import { one, q } from "./db.js";

export const TTL = {
  profile: 24 * 3600_000,
  list: 6 * 3600_000,
  negative: 3600_000,
} as const;

// ---- cache genérico (JSON) -------------------------------------------------

export async function cacheGet<T>(key: string): Promise<T | null> {
  const row = await one<{ value: T }>("SELECT value FROM followcatch.kv WHERE key = $1 AND expires_at > now()", [key]);
  return row ? row.value : null;
}

export async function cacheSet(key: string, value: unknown, ttlMs: number): Promise<void> {
  await q(
    `INSERT INTO followcatch.kv (key, value, expires_at) VALUES ($1, $2::jsonb, now() + ($3 || ' milliseconds')::interval)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
    [key, JSON.stringify(value), String(ttlMs)],
  );
}

// ---- gênero por username ---------------------------------------------------

export async function genderGetMany(usernames: string[]): Promise<Map<string, Gender>> {
  const out = new Map<string, Gender>();
  if (usernames.length === 0) return out;
  const rows = await q<{ username: string; gender: Gender }>(
    "SELECT username, gender FROM followcatch.gender WHERE username = ANY($1::text[])",
    [usernames],
  );
  for (const r of rows) out.set(r.username, r.gender);
  return out;
}

export async function genderSetMany(pairs: [string, Gender][]): Promise<void> {
  if (pairs.length === 0) return;
  await q(
    `INSERT INTO followcatch.gender (username, gender, at)
     SELECT u, g, now() FROM unnest($1::text[], $2::text[]) AS t(u, g)
     ON CONFLICT (username) DO UPDATE SET gender = EXCLUDED.gender, at = EXCLUDED.at`,
    [pairs.map((p) => p[0]), pairs.map((p) => p[1])],
  );
}

// ---- custo -----------------------------------------------------------------

export type Bucket = "visitor" | "subscriber";

export async function logRun(r: {
  actor: string; username: string; itens: number; custo: number; ms: number; ok: boolean;
  who?: string; bucket?: Bucket;
}) {
  await q(
    "INSERT INTO followcatch.runs (actor, username, itens, custo_est, ms, ok, who, bucket) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [r.actor, r.username, r.itens, r.custo, r.ms, r.ok, r.who ?? null, r.bucket ?? null],
  );
}

/** Gasto estimado de hoje (zera à meia-noite UTC). Sem `bucket` = total (o disjuntor global). */
export async function spentToday(bucket?: Bucket): Promise<{ usd: number; runs: number }> {
  const r = await one<{ usd: string; runs: string }>(
    `SELECT COALESCE(SUM(custo_est), 0) AS usd, COUNT(*) AS runs FROM followcatch.runs
      WHERE at >= (now() AT TIME ZONE 'UTC')::date AND ($1::text IS NULL OR bucket = $1)`,
    [bucket ?? null],
  );
  return { usd: Number(r?.usd ?? 0), runs: Number(r?.runs ?? 0) };
}

// ---- limite de buscas novas por dia e por semana ---------------------------

/**
 * Uma "busca" = um @ novo pra este `who` em um dia (who = "ip:<ip>" ou "user:<id>").
 * profile + following + followers do mesmo @ no mesmo dia caem na mesma linha, então contam como 1.
 * Repetir um @ já contado hoje é grátis ("ok"). "new" = esta chamada registrou o @ (e pode devolver
 * a cota com `releaseClaim` se a coleta falhar). Barrado: "daily" (limite do dia) ou "weekly"
 * (limite da semana, que começa na segunda 00:00 UTC; `weekly` null = sem limite semanal).
 */
export async function claimSearch(
  who: string,
  username: string,
  limits: { daily: number; weekly: number | null },
): Promise<"new" | "ok" | "daily" | "weekly"> {
  const ja = await one(
    "SELECT 1 FROM followcatch.searches WHERE who = $1 AND day = (now() AT TIME ZONE 'UTC')::date AND username = $2",
    [who, username],
  );
  if (ja) return "ok";
  if ((await searchesToday(who)) >= limits.daily) return "daily";
  if (limits.weekly !== null && (await searchesThisWeek(who)) >= limits.weekly) return "weekly";
  await q(
    `INSERT INTO followcatch.searches (who, day, username) VALUES ($1, (now() AT TIME ZONE 'UTC')::date, $2)
     ON CONFLICT DO NOTHING`,
    [who, username],
  );
  return "new";
}

/** Devolve a cota de uma busca registrada hoje: usado quando a coleta falhou por erro nosso ou do provedor. */
export async function releaseClaim(who: string, username: string): Promise<void> {
  await q("DELETE FROM followcatch.searches WHERE who = $1 AND day = (now() AT TIME ZONE 'UTC')::date AND username = $2", [who, username]);
}

/** Buscas (um @ por dia) desta semana UTC; a semana começa na segunda-feira. */
export async function searchesThisWeek(who: string): Promise<number> {
  const r = await one<{ n: string }>(
    "SELECT COUNT(*) AS n FROM followcatch.searches WHERE who = $1 AND day >= date_trunc('week', now() AT TIME ZONE 'UTC')::date",
    [who],
  );
  return Number(r?.n ?? 0);
}

export async function searchesToday(who: string): Promise<number> {
  const r = await one<{ n: string }>(
    "SELECT COUNT(*) AS n FROM followcatch.searches WHERE who = $1 AND day = (now() AT TIME ZONE 'UTC')::date",
    [who],
  );
  return Number(r?.n ?? 0);
}
