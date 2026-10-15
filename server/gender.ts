// Classificação de gênero por nome/username: 1 chamada à Anthropic por lista.
// Nunca segura a resposta mais que 4 s: o que não chegou vira "other" AGORA, mas a
// chamada segue em segundo plano e grava no cache — a próxima leitura já vem certa.
import type { Gender } from "../src/lib/types.js";
import { genderGetMany, genderSetMany } from "./cache.js";

const MODEL = "claude-haiku-5-5";
const WAIT_MS = 4_000;
const HARD_TIMEOUT_MS = 30_000;

type Who = { username: string; fullName: string };

const inflight = new Map<string, Promise<void>>();

async function callClaude(people: Who[]): Promise<Map<string, Gender>> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ausente");
  const lines = people.map((p, i) => `${i}\t${p.username}\t${p.fullName || "-"}`).join("\n");
  const prompt =
    `Classify the likely gender of each Instagram account below from its username and display name.\n` +
    `Use "f" (female person), "m" (male person) or "o" (brand, page, group, couple, or genuinely unclear).\n` +
    `Reply with ONLY a JSON object mapping each index to its letter, e.g. {"0":"f","1":"o"}. No prose.\n\n` +
    `index\tusername\tname\n${lines}`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      // Thinking vem ligado por padrão no Haiku 5.5 e come o max_tokens (resposta vazia).
      thinking: { type: "disabled" },
      max_tokens: Math.min(4096, 128 + people.length * 12),
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(HARD_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`Anthropic HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { content?: { type: string; text?: string }[] };
  const text = (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`Resposta sem JSON (stop=${(j as { stop_reason?: string }).stop_reason}): ${text.slice(0, 120)}`);
  // Chave = índice, não posição: array posicional desalinhou na prática (50 pedidos, 52
  // devolvidos, gênero deslocado). Índice que faltar fica fora do cache e vira "other".
  const obj = JSON.parse(m[0]) as Record<string, unknown>;
  const out = new Map<string, Gender>();
  people.forEach((p, i) => {
    const v = obj[String(i)];
    if (typeof v !== "string") return;
    const g = v.toLowerCase();
    out.set(p.username, g.startsWith("f") ? "female" : g.startsWith("m") ? "male" : "other");
  });
  return out;
}

function classifyInBackground(people: Who[]): Promise<void> {
  const k = people.map((p) => p.username).join(",");
  const ja = inflight.get(k);
  if (ja) return ja;
  const p = callClaude(people)
    .then((res) => genderSetMany([...res.entries()]))
    .catch((e) => console.warn("[gender]", e instanceof Error ? e.message : e))
    .finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

/** Gênero de cada pessoa. Cache primeiro; o resto em 1 chamada com espera máxima de 4 s. */
export async function classify(people: Who[]): Promise<Map<string, Gender>> {
  const names = people.map((p) => p.username);
  let known = await genderGetMany(names);
  const missing = people.filter((p) => !known.has(p.username));
  if (missing.length > 0) {
    await Promise.race([classifyInBackground(missing), new Promise((r) => setTimeout(r, WAIT_MS))]);
    known = await genderGetMany(names);
  }
  const out = new Map<string, Gender>();
  for (const u of names) out.set(u, known.get(u) ?? "other");
  return out;
}
