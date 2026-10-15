// Cache e contadores do FollowCatch. SQLite hoje; a interface é o que o resto do
// server enxerga, pra trocar por Postgres sem mexer em rota nenhuma.
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Gender } from "../src/lib/types";

export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "data");
mkdirSync(join(DATA_DIR, "img"), { recursive: true });

const db = new Database(join(DATA_DIR, "cache.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS gender (
    username TEXT PRIMARY KEY, gender TEXT NOT NULL, at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, username TEXT NOT NULL,
    itens INTEGER NOT NULL, custo_est REAL NOT NULL, ms INTEGER NOT NULL, ok INTEGER NOT NULL DEFAULT 1,
    at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS runs_at ON runs(at);
  CREATE TABLE IF NOT EXISTS searches (
    ip TEXT NOT NULL, day TEXT NOT NULL, username TEXT NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (ip, day, username)
  );
`);

export const TTL = {
  profile: 24 * 3600_000,
  list: 6 * 3600_000,
  negative: 3600_000,
} as const;

// ---- cache genérico (JSON) -------------------------------------------------

const stGet = db.prepare<[string, number], { value: string }>(
  "SELECT value FROM kv WHERE key = ? AND expires_at > ?",
);
const stSet = db.prepare("INSERT OR REPLACE INTO kv (key, value, expires_at) VALUES (?, ?, ?)");

export function cacheGet<T>(key: string): T | null {
  const row = stGet.get(key, Date.now());
  return row ? (JSON.parse(row.value) as T) : null;
}

export function cacheSet(key: string, value: unknown, ttlMs: number): void {
  stSet.run(key, JSON.stringify(value), Date.now() + ttlMs);
}

// ---- gênero por username ---------------------------------------------------

export function genderGetMany(usernames: string[]): Map<string, Gender> {
  const out = new Map<string, Gender>();
  if (usernames.length === 0) return out;
  const rows = db
    .prepare(`SELECT username, gender FROM gender WHERE username IN (${usernames.map(() => "?").join(",")})`)
    .all(...usernames) as { username: string; gender: Gender }[];
  for (const r of rows) out.set(r.username, r.gender);
  return out;
}

const stGender = db.prepare("INSERT OR REPLACE INTO gender (username, gender, at) VALUES (?, ?, ?)");
export const genderSetMany = db.transaction((pairs: [string, Gender][]) => {
  const now = Date.now();
  for (const [u, g] of pairs) stGender.run(u, g, now);
});

// ---- custo -----------------------------------------------------------------

const stRun = db.prepare(
  "INSERT INTO runs (actor, username, itens, custo_est, ms, ok, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
);
export function logRun(r: { actor: string; username: string; itens: number; custo: number; ms: number; ok: boolean }) {
  stRun.run(r.actor, r.username, r.itens, r.custo, r.ms, r.ok ? 1 : 0, Date.now());
}

/** Início do dia em UTC: o teto diário zera à meia-noite UTC. */
function dayStart(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
const today = () => new Date().toISOString().slice(0, 10);

export function spentToday(): { usd: number; runs: number } {
  const r = db
    .prepare("SELECT COALESCE(SUM(custo_est), 0) AS usd, COUNT(*) AS runs FROM runs WHERE at >= ?")
    .get(dayStart()) as { usd: number; runs: number };
  return r;
}

// ---- rate limit por IP -----------------------------------------------------

/**
 * Uma "busca" = um @ novo pra este IP hoje. profile + following + followers do mesmo @
 * caem na mesma linha (PK ip,day,username), então contam como 1.
 * Devolve false se o IP já gastou as buscas do dia com outros @.
 */
export function claimSearch(ip: string, username: string, limit: number): boolean {
  const day = today();
  const ja = db.prepare("SELECT 1 FROM searches WHERE ip = ? AND day = ? AND username = ?").get(ip, day, username);
  if (ja) return true;
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM searches WHERE ip = ? AND day = ?").get(ip, day) as { n: number };
  if (n >= limit) return false;
  db.prepare("INSERT OR IGNORE INTO searches (ip, day, username, at) VALUES (?, ?, ?, ?)").run(ip, day, username, Date.now());
  return true;
}

export function searchesToday(ip: string): number {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM searches WHERE ip = ? AND day = ?").get(ip, today()) as { n: number };
  return n;
}
