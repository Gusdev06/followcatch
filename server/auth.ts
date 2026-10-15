// Contas e sessão. Senha em scrypt (mesmo formato do insta-radar), sessão no banco:
// o cookie leva um token aleatório; o banco guarda só HMAC(SESSION_SECRET, token).
import { createHash, createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Cycle, Me, PlanId } from "../src/lib/types.js";
import { one, q } from "./db.js";
import { ApiErr } from "./service.js";

const derive = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const COOKIE = "fc_session";
const MAX_AGE = 30 * 24 * 3600; // 30 dias
const PW_MIN = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type User = { id: string; email: string; pk_customer_id: string | null };

export function normalizeEmail(raw: unknown): string | null {
  const e = String(raw ?? "").trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function checkPassword(pw: string, stored: string): Promise<boolean> {
  const parts = (stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const want = Buffer.from(parts[2], "hex");
  if (salt.length === 0 || want.length === 0) return false;
  const key = await derive(pw, salt, want.length);
  return key.length === want.length && timingSafeEqual(key, want);
}

/** Hash descartável quando o email não existe: login não vira sonda de "tem conta?". */
const DECOY = "scrypt$00000000000000000000000000000000$" + "0".repeat(128);

function tokenHash(token: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurado.");
  return createHmac("sha256", secret).update(token).digest("hex");
}

export async function createUser(emailRaw: unknown, pwRaw: unknown): Promise<User> {
  const email = normalizeEmail(emailRaw);
  if (!email) throw new ApiErr("invalid", 400, "Enter a valid email.");
  const pw = String(pwRaw ?? "");
  if (pw.length < PW_MIN) throw new ApiErr("invalid", 400, `Password must be at least ${PW_MIN} characters.`);
  if (pw.length > 200) throw new ApiErr("invalid", 400, "Password is too long.");
  const hash = await hashPassword(pw);
  try {
    const u = await one<User>(
      "INSERT INTO followcatch.users (id, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email, pk_customer_id",
      [randomUUID(), email, hash],
    );
    if (!u) throw new Error("insert sem retorno");
    return u;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      throw new ApiErr("email_taken", 409, "This email already has an account. Log in instead.");
    }
    throw e;
  }
}

export async function authenticate(emailRaw: unknown, pwRaw: unknown): Promise<User | null> {
  const email = normalizeEmail(emailRaw);
  const pw = String(pwRaw ?? "");
  if (!email || !pw) return null;
  const row = await one<User & { password_hash: string }>(
    "SELECT id, email, pk_customer_id, password_hash FROM followcatch.users WHERE email = $1",
    [email],
  );
  const ok = await checkPassword(pw, row ? row.password_hash : DECOY);
  return row && ok ? { id: row.id, email: row.email, pk_customer_id: row.pk_customer_id } : null;
}

const secureCookie = () => (process.env.APP_URL ?? "").startsWith("https://") || !!process.env.VERCEL;

export async function openSession(c: Context, userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await q(
    "INSERT INTO followcatch.sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '30 days')",
    [tokenHash(token), userId],
  );
  setCookie(c, COOKIE, token, { httpOnly: true, secure: secureCookie(), sameSite: "Lax", path: "/", maxAge: MAX_AGE });
}

export async function closeSession(c: Context): Promise<void> {
  const token = getCookie(c, COOKIE);
  if (token) await q("DELETE FROM followcatch.sessions WHERE token_hash = $1", [tokenHash(token)]).catch(() => []);
  deleteCookie(c, COOKIE, { path: "/", secure: secureCookie() });
}

export async function currentUser(c: Context): Promise<User | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const u = await one<User>(
    `SELECT u.id, u.email, u.pk_customer_id FROM followcatch.sessions s
       JOIN followcatch.users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash(token)],
  );
  // 1 requisição em 50 faz a faxina das sessões vencidas.
  if (Math.random() < 0.02) void q("DELETE FROM followcatch.sessions WHERE expires_at < now()").catch(() => []);
  return u;
}

export async function requireUser(c: Context): Promise<User> {
  const u = await currentUser(c);
  if (!u) throw new ApiErr("unauthorized", 401, "Please log in.");
  return u;
}

// ---- assinatura ------------------------------------------------------------

type SubRow = { plan: PlanId | null; cycle: Cycle | null; status: Me["status"]; renews_at: Date | null };

/** Folga depois do fim do período, pra renovação atrasada (webhook lento) não trancar ninguém. */
const GRACE_MS = 2 * 24 * 3600_000;

export async function getMe(user: Pick<User, "id" | "email">): Promise<Me> {
  const s = await one<SubRow>("SELECT plan, cycle, status, renews_at FROM followcatch.subscriptions WHERE user_id = $1", [user.id]);
  return {
    email: user.email,
    plan: s?.plan ?? null,
    cycle: s?.cycle ?? null,
    status: s?.status ?? "none",
    renewsAt: s?.renews_at ? new Date(s.renews_at).toISOString() : null,
  };
}

/** Assinante = status active e período não vencido (com folga). */
export function hasAccess(me: Me): boolean {
  if (me.status !== "active") return false;
  if (!me.renewsAt) return true;
  return new Date(me.renewsAt).getTime() + GRACE_MS > Date.now();
}

// ---- reset de senha por email (Resend) --------------------------------------

const RESET_PER_HOUR = 3;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Sempre termina igual pra quem chama (não revela se o email tem conta). Limite de
 * 3 pedidos por email/hora; o token cru só existe no link do email, o banco guarda o sha256.
 */
export async function requestPasswordReset(emailRaw: unknown): Promise<void> {
  const email = normalizeEmail(emailRaw);
  if (!email) throw new ApiErr("invalid", 400, "Enter a valid email.");
  const recent = await one<{ n: string }>(
    "SELECT COUNT(*) AS n FROM followcatch.password_resets WHERE email = $1 AND created_at > now() - interval '1 hour'",
    [email],
  );
  if (Number(recent?.n ?? 0) >= RESET_PER_HOUR) return; // silencioso: mesma resposta
  const user = await one<{ id: string }>("SELECT id FROM followcatch.users WHERE email = $1", [email]);
  const token = randomBytes(32).toString("base64url");
  await q(
    "INSERT INTO followcatch.password_resets (token_hash, user_id, email, expires_at) VALUES ($1, $2, $3, now() + interval '1 hour')",
    [sha256(token), user?.id ?? null, email],
  );
  if (!user) return;
  const link = `${(process.env.APP_URL || "https://followcatch.vercel.app").replace(/\/+$/, "")}/reset-password?token=${token}`;
  await sendResetEmail(email, link);
}

async function sendResetEmail(to: string, link: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[reset] RESEND_API_KEY ausente");
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "FollowCatch <onboarding@resend.dev>",
      to: [to],
      subject: "Reset your FollowCatch password",
      text: `Someone asked to reset the password for your FollowCatch account.\n\nSet a new password here (valid for 1 hour):\n${link}\n\nIf it wasn't you, ignore this email.`,
      html:
        `<div style="font-family:Inter,Arial,sans-serif;color:#111827;max-width:480px">` +
        `<h2 style="margin:0 0 12px">Reset your password</h2>` +
        `<p>Someone asked to reset the password for your FollowCatch account. The link is valid for 1 hour.</p>` +
        `<p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:999px;color:#fff;text-decoration:none;background:linear-gradient(90deg,#ff7a3d,#ff2d55,#e1306c)">Set a new password</a></p>` +
        `<p style="color:#6b7280;font-size:13px">If it wasn't you, ignore this email.</p></div>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const txt = await r.text();
  if (!r.ok) console.error(`[reset] Resend HTTP ${r.status}: ${txt.slice(0, 300)}`);
  else console.log(`[reset] email enviado (Resend ${txt.slice(0, 80)})`);
}

/** Troca a senha, queima o token e derruba todas as sessões do usuário. */
export async function resetPassword(tokenRaw: unknown, pwRaw: unknown): Promise<User> {
  const token = String(tokenRaw ?? "");
  const pw = String(pwRaw ?? "");
  if (pw.length < PW_MIN) throw new ApiErr("invalid", 400, `Password must be at least ${PW_MIN} characters.`);
  if (pw.length > 200) throw new ApiErr("invalid", 400, "Password is too long.");
  if (!token) throw new ApiErr("invalid", 400, "This reset link is invalid or has expired.");
  // UPDATE com as condições no WHERE: dois cliques simultâneos não usam o mesmo token.
  const r = await one<{ user_id: string }>(
    `UPDATE followcatch.password_resets SET used_at = now()
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() AND user_id IS NOT NULL
      RETURNING user_id`,
    [sha256(token)],
  );
  if (!r) throw new ApiErr("invalid", 400, "This reset link is invalid or has expired.");
  const u = await one<User>(
    "UPDATE followcatch.users SET password_hash = $1 WHERE id = $2 RETURNING id, email, pk_customer_id",
    [await hashPassword(pw), r.user_id],
  );
  if (!u) throw new ApiErr("invalid", 400, "This reset link is invalid or has expired.");
  await q("DELETE FROM followcatch.sessions WHERE user_id = $1", [u.id]);
  await q("UPDATE followcatch.password_resets SET used_at = COALESCE(used_at, now()) WHERE user_id = $1", [u.id]);
  return u;
}
