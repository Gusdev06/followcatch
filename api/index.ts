// Função única da Vercel (Node): serve o app Hono inteiro. vercel.json reescreve /api/(.*) → /api.
import { handle } from "hono/vercel";
import { app } from "../server/app.js";

const h = handle(app);
export const GET = h;
export const POST = h;
export const PUT = h;
export const PATCH = h;
export const DELETE = h;
export const OPTIONS = h;
