// placeholder: o agente BACKEND substitui
import { serve } from "@hono/node-server";
import { Hono } from "hono";
const app = new Hono();
app.get("/api/health", (c) => c.json({ ok: true }));
serve({ fetch: app.fetch, port: 8787 });
