import { randomUUID } from "node:crypto";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { q } from "./db.js";

const COOKIE = "fc_visitor";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Identificador aleatório do navegador; não é autenticação nem identidade pessoal. */
export function visitorId(c: Context): string {
  const existing = getCookie(c, COOKIE);
  if (existing && UUID.test(existing)) return existing;
  const id = randomUUID();
  setCookie(c, COOKIE, id, {
    httpOnly: true, sameSite: "Lax", path: "/", maxAge: 365 * 24 * 3600,
    secure: !!process.env.VERCEL || (process.env.APP_URL ?? "").startsWith("https://"),
  });
  return id;
}

/** A falha no registro nunca derruba a busca. Await evita perder eventos no serverless. */
export async function startSearch(c: Context, userId: string | null, username: string): Promise<string | null> {
  const visitor = visitorId(c);
  const id = randomUUID();
  try {
    await q(
      "INSERT INTO followcatch.search_events (id, visitor_id, user_id, username) VALUES ($1, $2, $3, $4)",
      [id, visitor, userId, username],
    );
    return id;
  } catch (e) {
    console.warn("[search_activity] start failed", e instanceof Error ? e.message : "unknown error");
    return null;
  }
}

export async function finishSearch(id: string | null, outcome: string): Promise<void> {
  if (!id) return;
  await q("UPDATE followcatch.search_events SET outcome = $2 WHERE id = $1", [id, outcome])
    .catch((e) => console.warn("[search_activity] finish failed", e instanceof Error ? e.message : "unknown error"));
}
