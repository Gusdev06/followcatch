// API do FollowCatch (Hono, porta 8787). Contrato em ../CONTRATO.md e src/lib/types.ts.
import { config } from "dotenv";
import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono, type Context } from "hono";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIR, searchesToday, spentToday } from "./cache";
import { classify } from "./gender";
import { ApiErr, cachedProfile, getList, getProfile, normalizeUsername } from "./service";

config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env") });


const app = new Hono();

/** IP do cliente: 1º item do x-forwarded-for (atrás de proxy), senão o socket. */
function ipOf(c: Context): string {
  const xff = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  try {
    return getConnInfo(c).remote.address || "unknown";
  } catch {
    return "unknown";
  }
}

function fail(c: Context, e: unknown) {
  if (e instanceof ApiErr) return c.json({ error: e.code, message: e.message }, e.status);
  console.error(e);
  return c.json({ error: "provider_error", message: "Unexpected server error." }, 502);
}

app.get("/api/health", (c) => {
  const s = spentToday();
  return c.json({
    ok: true,
    spentTodayUsd: Number(s.usd.toFixed(4)),
    runsToday: s.runs,
    maxDailyUsd: Number(process.env.MAX_DAILY_USD || 3),
    searchesTodayForYou: searchesToday(ipOf(c)),
    freeSearchesPerIp: Number(process.env.FREE_SEARCHES_PER_IP || 5),
  });
});

app.get("/api/profile", async (c) => {
  try {
    return c.json(await getProfile(normalizeUsername(c.req.query("u")), ipOf(c)));
  } catch (e) {
    return fail(c, e);
  }
});

for (const kind of ["following", "followers"] as const) {
  app.get(`/api/${kind}`, async (c) => {
    try {
      return c.json(await getList(kind, normalizeUsername(c.req.query("u")), ipOf(c)));
    } catch (e) {
      return fail(c, e);
    }
  });
}

/** Gênero do próprio perfil pesquisado (o front decide "gênero oposto"). Não roda Apify. */
app.get("/api/gender", async (c) => {
  try {
    const u = normalizeUsername(c.req.query("u"));
    const p = cachedProfile(u);
    const g = await classify([{ username: u, fullName: p?.fullName ?? "" }]);
    return c.json({ username: u, gender: g.get(u) ?? "other" });
  } catch (e) {
    return fail(c, e);
  }
});

app.get("/api/stories", (c) => c.json({ status: "unavailable" }));

// ---- proxy de imagem -------------------------------------------------------
const IMG_HOST = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;

app.get("/api/img", async (c) => {
  const raw = c.req.query("url") ?? "";
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return c.json({ error: "invalid", message: "Invalid image URL." }, 400);
  }
  if (u.protocol !== "https:" || !IMG_HOST.test(u.hostname)) {
    return c.json({ error: "invalid", message: "Image host not allowed." }, 400);
  }
  const h = createHash("sha256").update(u.toString()).digest("hex");
  const file = join(DATA_DIR, "img", h);
  const headers = { "cache-control": "public, max-age=604800, immutable" };
  if (existsSync(file) && existsSync(`${file}.type`)) {
    return c.body(readFileSync(file), 200, { ...headers, "content-type": readFileSync(`${file}.type`, "utf8"), "x-cache": "hit" });
  }
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(15_000), headers: { "user-agent": "Mozilla/5.0" } });
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !type.startsWith("image/")) {
      return c.json({ error: "provider_error", message: `Image fetch failed (HTTP ${r.status}).` }, 502);
    }
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(file, buf);
    writeFileSync(`${file}.type`, type);
    return c.body(buf, 200, { ...headers, "content-type": type, "x-cache": "miss" });
  } catch {
    return c.json({ error: "provider_error", message: "Image fetch failed." }, 502);
  }
});

app.notFound((c) => c.json({ error: "not_found", message: "Route not found." }, 404));

const port = Number(process.env.PORT || 8787);
serve({ fetch: app.fetch, port });
console.log(`[followcatch] API em http://localhost:${port}`);
