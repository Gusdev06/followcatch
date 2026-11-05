// Abas Funil, Visitantes e Ao vivo do /admin, no molde do painel do The Kingdom of Love.
import { useEffect, useMemo, useState } from "react";

type Props = { adminKey: string; onUnauthorized: () => void };
type Range = "today" | "24h" | "7d" | "30d" | "all";
type Cohort = { key: string; visitors: number; search: number; plans: number; checkout: number; buyers: number };
type Funnel = {
  visitors: number; buyers: number; steps: { key: string; label: string; n: number }[];
  byAd: Cohort[]; byCampaign: Cohort[]; byCountry: Cohort[]; byDevice: Cohort[];
};
type Person = {
  leadId: string; first: string; last: string; country: string | null; device: string | null; ad: string | null; campaign: string | null;
  placement: string | null; furthest: string; clickedPay: boolean; email: string | null; buyer: boolean; review: boolean;
};
type Visitors = { total: number; reviews: number; online: number; bought: number; byHour: number[]; people: Person[] };
type Session = {
  lead_id: string; country: string | null; region: string | null; city: string | null; device: string | null; ad: string | null;
  campaign: string | null; step: string | null; first_seen: string; last_seen: string; idle_s: number; email: string | null; bought: boolean;
};

const RANGES: [Range, string][] = [["today", "Hoje"], ["24h", "24h"], ["7d", "7 dias"], ["30d", "30 dias"], ["all", "Tudo"]];
const STEP_LABEL: Record<string, string> = {
  landing: "Landing", search: "Busca", preview: "Prévia", plans: "Planos", signup: "Cadastro", checkout: "Checkout",
  pay_click: "Clicou em pagar", app: "Dashboard", welcome: "Pós-compra", login: "Login",
};
const POST_CHECKOUT = new Set(["checkout", "pay_click", "welcome"]);
const ONLINE_S = 30;
const REFRESH_LIVE_MS = 3000;
const NO_CAMPAIGN = "(sem campanha / orgânico)";

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 1000) / 10}%` : "—");
const clean = (v: string) => {
  const t = v.replace(/\+/g, " ");
  try { return decodeURIComponent(t).trim(); } catch { return t.trim(); }
};
const nameOf = (v: string | null) => (v ? clean(v).split("|")[0].trim() : "—");
const campaignOf = (v: string | null) => {
  if (!v) return NO_CAMPAIGN;
  const [name, id] = clean(v).split("|").map((x) => x.trim());
  return name ? (id ? `${name} · …${id.slice(-5)}` : name) : NO_CAMPAIGN;
};
const flag = (cc: string | null) => (cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐");
const since = (iso: string, now: number) => {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}min` : `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
};
/** Horário de Bali (UTC+8): é onde o Gusta lê o painel. */
const bali = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "Asia/Makassar", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const card = "rounded-card border border-line bg-white";
const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-[13px] font-semibold ${on ? "bg-ink text-white" : "bg-white text-gray-600 ring-1 ring-line"}`;

function useAdmin<T>(url: string, { adminKey, onUnauthorized }: Props, refreshMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const r = await fetch(url, { headers: { "x-admin-key": adminKey }, cache: "no-store" });
        if (r.status === 401) { onUnauthorized(); return; }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as T;
        if (!stop) { setData(j); setErr(""); }
      } catch (e) {
        if (!stop) setErr(e instanceof Error ? e.message : "Falhou.");
      }
    }
    void load();
    const id = refreshMs ? setInterval(load, refreshMs) : 0;
    return () => { stop = true; if (id) clearInterval(id); };
  }, [url, adminKey, onUnauthorized, refreshMs, tick]);
  return { data, err, reload: () => setTick((t) => t + 1) };
}

function Stat({ label, value, on }: { label: string; value: number; on?: boolean }) {
  return (
    <div className={`${card} p-4 text-center`}>
      <b className={`block text-[28px] font-extrabold tabular-nums leading-tight ${on && value > 0 ? "text-emerald-600" : "text-ink"}`}>{value}</b>
      <span className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
    </div>
  );
}

function RangeBar({ range, setRange, reload, note }: { range: Range; setRange: (r: Range) => void; reload: () => void; note?: string }) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      {RANGES.map(([r, label]) => <button key={r} onClick={() => setRange(r)} className={chip(range === r)}>{label}</button>)}
      <button onClick={reload} className={chip(false)}>↻</button>
      {note && <span className="text-[13px] text-gray-500">{note}</span>}
    </div>
  );
}

function CohortTable({ title, rows, full }: { title: string; rows: Cohort[]; full?: boolean }) {
  if (!rows.length) return null;
  return (
    <div className={`${card} mt-3 overflow-x-auto`}>
      <table className="w-full min-w-[620px] text-[13px]">
        <thead className="border-b border-line text-[11px] uppercase tracking-wide text-gray-500">
          <tr className="text-right">
            <th className="px-4 py-2.5 text-left font-semibold">{title}</th>
            <th className="px-3 font-semibold">Visitantes</th>
            <th className="px-3 font-semibold">Busca</th>
            <th className="px-3 font-semibold">Planos</th>
            <th className="px-3 font-semibold">Checkout</th>
            <th className="px-4 font-semibold">Compras</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((c) => (
            <tr key={c.key} className="border-b border-line text-right last:border-0">
              <td className="max-w-[260px] truncate px-4 py-2 text-left font-semibold text-ink" title={c.key}>{full ? c.key : nameOf(c.key)}</td>
              <td className="px-3">{c.visitors}</td>
              <td className="px-3">{c.search} <span className="text-[11px] text-gray-400">{pct(c.search, c.visitors)}</span></td>
              <td className="px-3">{c.plans} <span className="text-[11px] text-gray-400">{pct(c.plans, c.visitors)}</span></td>
              <td className="px-3">{c.checkout} <span className="text-[11px] text-gray-400">{pct(c.checkout, c.visitors)}</span></td>
              <td className="px-4 font-bold text-emerald-600">{c.buyers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FunnelTab(props: Props) {
  const [range, setRange] = useState<Range>("7d");
  const { data, err, reload } = useAdmin<Funnel>(`/api/admin/funnel?range=${range}`, props);
  return (
    <>
      <RangeBar range={range} setRange={setRange} reload={reload} note={data ? `${data.visitors} visitantes reais (robôs fora)` : "Carregando…"} />
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      {data && (
        <>
          <div className={`${card} mt-3`}>
            {data.visitors === 0 && <p className="px-4 py-10 text-center text-sm text-gray-400">Nenhuma visita nesse período.</p>}
            {data.visitors > 0 && data.steps.map((s, i) => {
              const prev = i ? data.steps[i - 1].n : data.visitors;
              return (
                <div key={s.key} className="flex items-center gap-3 border-b border-line px-4 py-2 last:border-0">
                  <span className="w-32 shrink-0 text-[13px] font-semibold text-ink sm:w-40">{s.label}</span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded bg-gray-100">
                    <span className="absolute inset-y-0 left-0 rounded bg-brand-magenta/70" style={{ width: pct(s.n, data.visitors).replace("—", "0%") }} />
                  </span>
                  <b className="w-12 text-right text-[13px] tabular-nums">{s.n}</b>
                  <span className="w-14 text-right text-[12px] tabular-nums text-gray-500">{pct(s.n, data.visitors)}</span>
                  <span className="hidden w-16 text-right text-[12px] tabular-nums text-gray-400 sm:inline">{i ? `${pct(s.n, prev)} ↓` : ""}</span>
                </div>
              );
            })}
            {data.visitors > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 text-[13px]">
                <span className="w-32 shrink-0 font-semibold text-ink sm:w-40">Compra</span>
                <span className="flex-1" />
                <b className="w-12 text-right tabular-nums text-emerald-600">{data.buyers}</b>
                <span className="w-14 text-right text-[12px] tabular-nums text-gray-500">{pct(data.buyers, data.visitors)}</span>
                <span className="hidden w-16 sm:inline" />
              </div>
            )}
          </div>
          <CohortTable title="Anúncio (utm_content)" rows={data.byAd} />
          <CohortTable title="Campanha" rows={data.byCampaign} />
          <CohortTable title="País" rows={data.byCountry} full />
          <CohortTable title="Aparelho" rows={data.byDevice} full />
          <p className="mt-2 text-[12px] text-gray-400">Compra = visitante com conta que concluiu checkout. % das colunas = dos visitantes da linha.</p>
        </>
      )}
    </>
  );
}

export function VisitorsTab(props: Props) {
  const [range, setRange] = useState<Range>("today");
  const { data, err, reload } = useAdmin<Visitors>(`/api/admin/visitors?range=${range}`, props);
  const max = Math.max(1, ...(data?.byHour ?? []));
  return (
    <>
      <RangeBar range={range} setRange={setRange} reload={reload} note={data ? "" : "Carregando…"} />
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      {data && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="Pessoas reais" value={data.total - data.reviews} />
            <Stat label="Online agora" value={data.online} on />
            <Stat label="Compraram" value={data.bought} />
          </div>
          <div className={`${card} mt-3 p-4`}>
            <p className="mb-3 text-[13px] font-bold text-ink">Chegadas por hora · Bali (UTC+8)</p>
            <div className="flex h-28 items-end gap-[3px]">
              {data.byHour.map((n, h) => (
                <div key={h} className="flex flex-1 flex-col items-center gap-1" title={`${String(h).padStart(2, "0")}h: ${n}`}>
                  <span className="text-[9px] tabular-nums text-gray-400">{n || ""}</span>
                  <span className="w-full rounded-t bg-brand-magenta/70" style={{ height: `${(n / max) * 72}px` }} />
                  <span className="text-[9px] tabular-nums text-gray-400">{h}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={`${card} mt-3 overflow-x-auto`}>
            {data.total === 0 && <p className="px-4 py-10 text-center text-sm text-gray-400">Nenhuma visita nesse período.</p>}
            {data.total > 0 && (
              <table className="w-full min-w-[760px] text-left text-[13px]">
                <thead className="border-b border-line text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Chegou (Bali)</th>
                    <th className="px-3 font-semibold">País</th>
                    <th className="px-3 font-semibold">Aparelho</th>
                    <th className="px-3 font-semibold">Anúncio</th>
                    <th className="px-3 font-semibold">Chegou até</th>
                    <th className="px-4 font-semibold">Quem</th>
                  </tr>
                </thead>
                <tbody>
                  {data.people.map((p) => {
                    const mins = Math.round((new Date(p.last).getTime() - new Date(p.first).getTime()) / 60000);
                    return (
                      <tr key={p.leadId} className="border-b border-line align-top last:border-0">
                        <td className="whitespace-nowrap px-4 py-2 tabular-nums">{bali(p.first)}<span className="block text-[11px] text-gray-400">{mins ? `${mins} min no site` : "< 1 min"}</span></td>
                        <td className="px-3 py-2">{flag(p.country)} {p.country ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2">{p.device ?? "—"}{p.placement && <span className="block text-[11px] text-gray-400">{p.placement}</span>}{p.review && <span className="block text-[11px] text-amber-600">revisão da Meta?</span>}</td>
                        <td className="max-w-[200px] truncate px-3 py-2" title={p.campaign ?? ""}>{nameOf(p.ad)}</td>
                        <td className="px-3 py-2">{p.furthest || "—"}</td>
                        <td className="px-4 py-2">{p.buyer ? <span className="font-bold text-emerald-600">comprou ✓</span> : p.email ? <span className="block max-w-[220px] truncate">{p.email}</span> : p.clickedPay ? "clicou em pagar" : <span className="text-gray-400">anônimo</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {data.reviews > 0 && <p className="mt-2 text-[12px] text-gray-400">{data.reviews} visitas parecem revisão automática da Meta (coluna da direita, sem avançar) e não contam como pessoas reais.</p>}
          {data.total > data.people.length && <p className="mt-2 text-[12px] text-gray-400">Mostrando as últimas {data.people.length} de {data.total}.</p>}
        </>
      )}
    </>
  );
}

export function LiveTab(props: Props) {
  const [hours, setHours] = useState(2);
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [camp, setCamp] = useState<string | null>(null);
  const { data, err, reload } = useAdmin<{ sessions: Session[] }>(`/api/admin/live?h=${hours}`, props, REFRESH_LIVE_MS);
  const sessions = useMemo(() => data?.sessions ?? [], [data]);
  const now = Date.now();
  const online = sessions.filter((s) => s.idle_s <= ONLINE_S);
  const rows = onlyOnline ? online : sessions;
  const shown = camp ? rows.filter((s) => campaignOf(s.campaign) === camp) : rows;

  const camps = useMemo(() => {
    const m = new Map<string, { n: number; on: number; plans: number; checkout: number; bought: number }>();
    for (const s of sessions) {
      const k = campaignOf(s.campaign);
      const c = m.get(k) ?? { n: 0, on: 0, plans: 0, checkout: 0, bought: 0 };
      c.n++;
      if (s.idle_s <= ONLINE_S) c.on++;
      if (s.step === "plans" || s.step === "signup") c.plans++;
      if (POST_CHECKOUT.has(s.step ?? "")) c.checkout++;
      if (s.bought) c.bought++;
      m.set(k, c);
    }
    return [...m.entries()].sort((a, b) => b[1].on - a[1].on || b[1].n - a[1].n);
  }, [sessions]);

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {[1, 2, 6, 24].map((h) => <button key={h} onClick={() => setHours(h)} className={chip(hours === h)}>{h}h</button>)}
        <button onClick={() => setOnlyOnline((v) => !v)} className={chip(onlyOnline)}>Só online</button>
        <button onClick={reload} className={chip(false)}>↻</button>
        <span className="text-[13px] text-gray-500">atualiza a cada 3 s{err ? ` · ${err}` : ""}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Online agora" value={online.length} on />
        <Stat label="Nos planos" value={online.filter((s) => s.step === "plans" || s.step === "signup").length} />
        <Stat label="No checkout" value={online.filter((s) => POST_CHECKOUT.has(s.step ?? "")).length} />
        <Stat label={`Visitantes ${hours}h`} value={sessions.length} />
      </div>

      {camps.length > 0 && (
        <div className={`${card} mt-3 overflow-x-auto`}>
          <table className="w-full min-w-[620px] text-left text-[13px]">
            <thead className="border-b border-line text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Campanha ({hours}h) · clique para filtrar</th>
                <th className="px-3 font-semibold">Online</th>
                <th className="px-3 font-semibold">Visitantes</th>
                <th className="px-3 font-semibold">Planos</th>
                <th className="px-3 font-semibold">Checkout</th>
                <th className="px-4 font-semibold">Compras</th>
              </tr>
            </thead>
            <tbody>
              {camps.map(([k, c]) => (
                <tr key={k} onClick={() => setCamp(camp === k ? null : k)} className={`cursor-pointer border-b border-line last:border-0 hover:bg-gray-50 ${camp === k ? "bg-gray-100" : ""}`}>
                  <td className="max-w-[340px] truncate px-4 py-2 font-semibold text-ink" title={k}>{camp === k ? "✓ " : ""}{k}</td>
                  <td className="px-3 font-bold text-emerald-600">{c.on || <span className="font-normal text-gray-400">0</span>}</td>
                  <td className="px-3">{c.n}</td>
                  <td className="px-3">{c.plans}</td>
                  <td className="px-3">{c.checkout}</td>
                  <td className="px-4">{c.bought ? `💰 ${c.bought}` : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={`${card} mt-3 overflow-x-auto`}>
        {shown.length === 0 && <p className="px-4 py-10 text-center text-sm text-gray-400">{data ? "Ninguém por aqui ainda." : "Carregando…"}</p>}
        {shown.length > 0 && (
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="border-b border-line text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2.5 font-semibold" />
                <th className="px-3 font-semibold">Onde</th>
                <th className="px-3 font-semibold">Aparelho</th>
                <th className="px-3 font-semibold">Está em</th>
                <th className="px-3 font-semibold">Campanha / anúncio</th>
                <th className="px-3 font-semibold">Há</th>
                <th className="px-3 font-semibold">Quem</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => {
                const on = s.idle_s <= ONLINE_S;
                return (
                  <tr key={s.lead_id} className={`border-b border-line last:border-0 ${on ? "" : "opacity-50"}`}>
                    <td className="px-3 py-2" title={on ? "online" : `visto há ${since(s.last_seen, now)}`}>{on ? "🟢" : s.idle_s < 300 ? "🟡" : "⚪"}</td>
                    <td className="whitespace-nowrap px-3">{flag(s.country)} {[s.city, s.region, s.country].filter(Boolean).join(", ") || "—"}</td>
                    <td className="whitespace-nowrap px-3">{s.device ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 font-semibold text-ink">{STEP_LABEL[s.step ?? ""] ?? s.step ?? "—"}</td>
                    <td className="max-w-[240px] px-3 text-[12px]" title={`${s.campaign ?? ""}\n${s.ad ?? ""}`}>
                      <div className="truncate">{campaignOf(s.campaign)}</div>
                      <div className="truncate text-gray-400">{nameOf(s.ad)}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 text-[12px]">{since(s.first_seen, now)}</td>
                    <td className="px-3 text-[12px]">{s.bought ? "💰 " : ""}{s.email ?? <span className="text-gray-400">anônimo</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-[12px] text-gray-400">Online = batimento nos últimos {ONLINE_S} s. A página bate a cada 10 s enquanto está aberta na tela. Sem IP de propósito: só cidade, região e país.</p>
    </>
  );
}
