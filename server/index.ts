// Server local do FollowCatch (npm run dev). Em produção quem serve é api/index.ts.
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env"), quiet: true });

const { serve } = await import("@hono/node-server");
const { app } = await import("./app.js");

const port = Number(process.env.PORT || 8787);
serve({ fetch: app.fetch, port });
console.log(`[followcatch] API em http://localhost:${port}`);
