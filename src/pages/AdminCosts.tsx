// Aba "Custos" do admin: quanto a coleta de dados está custando, de quem, e se as cotas seguram a conta.
// Valores ESTIMADOS (o custo por item que o servidor assume), não a fatura da Apify. Tudo em UTC.
import { useEffect, useState } from "react";

type Costs = {
  generatedAt: string;
  today: { totalUsd: number; visitorUsd: number; subscriberUsd: number; unattributedUsd: number; globalLimitUsd: number; visitorLimitUsd: number };
  cache: { hitToday: number; missToday: number; rateToday: number | null; hit7d: number; miss7d: number; rate7d: number | null };
  daily: { day: string; visitor: number; subscriber: number; unattributed: number; runs: number; failed: number }[];
  byActor: { actor: string; runs: number; failed: number; items: number; usd: number; avgMs: number }[];
  subscribersThisWeek: { userId: string; email: string | null; plan: string | null; status: string | null; runs: number; failed: number; usd: number; quotaUsed: number; quotaLimit: number }[];
  acquisition30d: { visitorUsd: number; paidCheckouts: number; visitorUsdPerPaid: number | null };
};

const usd = (n: number) => `US$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: n < 1 ? 3 : 2, maximumFractionDigits: n < 1 ? 3 : 2 })}`;
const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Bar({ value, max, tone = "bg-brand-magenta" }: { value: number; max: number; tone?: string }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${tone}`} style={{ width: `${w}%` }} /></div>;
}

function Kpi({ label, value, sub, bar }: { label: string; value: string; sub?: string; bar?: { value: number; max: number; warn: boolean } }) {
  return (
    <div className="rounded-card border border-line bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-[26px] font-extrabold tabular-nums leading-tight text-ink">{value}</div>
      {bar && <div className="mt-2"><Bar value={bar.value} max={bar.max} tone={bar.warn ? "bg-red-500" : "bg-brand-magenta"} /></div>}
      {sub && <div className="mt-1.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

const th = "px-4 py-3 font-semibold";

export default function AdminCosts({ adminKey, onUnauthorized }: { adminKey: string; onUnauthorized: () => void }) {
  const [data, setData] = useState<Costs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setRefresh((n) => n + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setLoading(true); setError("");
    void (async () => {
      try {
        const r = await fetch("/api/admin/costs", { headers: { "x-admin-key": adminKey }, cache: "no-store", signal: controller.signal });
        if (!alive) return;
        if (r.status === 401) { onUnauthorized(); return; }
        const body = await r.json();
        if (!r.ok) throw new Error(body.message || `HTTP ${r.status}`);
        if (alive) setData(body as Costs);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Não foi possível carregar os custos.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; controller.abort(); };
  }, [adminKey, refresh, onUnauthorized]);

  const t = data?.today;
  const maxDay = Math.max(0, ...(data?.daily ?? []).map((d) => d.visitor + d.subscriber + d.unattributed));
  const acq = data?.acquisition30d;
  return (
    <section className="mt-5" aria-label="Custos de coleta de dados">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-ink">Custos de dados</h2>
          <p className="text-[13px] text-gray-500">Valores estimados (não é a fatura da Apify) · dia em UTC · atualiza a cada 60 segundos{data && ` · ${when(data.generatedAt)}`}</p>
        </div>
        <button onClick={() => setRefresh((n) => n + 1)} disabled={loading} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">
          {loading ? "Atualizando…" : "Atualizar custos"}
        </button>
      </div>
      {error && <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error} {data && "Os dados abaixo são da última atualização concluída."}</div>}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Gasto hoje" value={t ? usd(t.totalUsd) : "—"}
          sub={t ? `Disjuntor: ${usd(t.globalLimitUsd)} por dia` : undefined}
          bar={t ? { value: t.totalUsd, max: t.globalLimitUsd, warn: t.totalUsd >= t.globalLimitUsd * 0.8 } : undefined}
        />
        <Kpi
          label="Balde dos visitantes hoje" value={t ? usd(t.visitorUsd) : "—"}
          sub={t ? `Limite: ${usd(t.visitorLimitUsd)} · assinantes: ${usd(t.subscriberUsd)}` : undefined}
          bar={t ? { value: t.visitorUsd, max: t.visitorLimitUsd, warn: t.visitorUsd >= t.visitorLimitUsd * 0.8 } : undefined}
        />
        <Kpi
          label="Cache hit do perfil (7 dias)" value={data ? pct(data.cache.rate7d) : "—"}
          sub={data ? `${data.cache.hit7d} sem pagar · ${data.cache.miss7d} coletas · hoje ${pct(data.cache.rateToday)}` : undefined}
        />
        <Kpi
          label="Visitantes por checkout (30 dias)" value={acq?.visitorUsdPerPaid != null ? usd(acq.visitorUsdPerPaid) : "—"}
          sub={acq ? `${usd(acq.visitorUsd)} gastos com visitantes ÷ ${acq.paidCheckouts} checkout${acq.paidCheckouts === 1 ? "" : "s"} concluído${acq.paidCheckouts === 1 ? "" : "s"}` : undefined}
        />
      </div>

      <h3 className="mt-7 text-[15px] font-extrabold text-ink">Gasto por dia (14 dias)</h3>
      <div className="mt-2 overflow-x-auto rounded-card border border-line bg-white" aria-busy={loading}>
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-gray-500">
            <tr><th className={th}>Dia</th><th className={`${th} text-right`}>Visitantes</th><th className={`${th} text-right`}>Assinantes</th><th className={`${th} text-right`}>Sem dono*</th><th className={`${th} text-right`}>Total</th><th className={`${th} w-40`}> </th><th className={`${th} text-right`}>Coletas (falhas)</th></tr>
          </thead>
          <tbody>
            {data?.daily.map((d) => {
              const total = d.visitor + d.subscriber + d.unattributed;
              return (
                <tr key={d.day} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-ink">{dayLabel(d.day)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{usd(d.visitor)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{usd(d.subscriber)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{usd(d.unattributed)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-ink">{usd(total)}</td>
                  <td className="px-4 py-2.5"><Bar value={total} max={maxDay} /></td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{d.runs}{d.failed > 0 && <span className="text-red-600"> ({d.failed})</span>}</td>
                </tr>
              );
            })}
            {!data?.daily.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{loading ? "Carregando…" : "Nenhuma coleta nos últimos 14 dias."}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-xs text-gray-500">*Coletas de antes de 2026-11-04, quando o gasto ainda não registrava quem o gerou.</p>

      <h3 className="mt-7 text-[15px] font-extrabold text-ink">Assinantes que coletaram nesta semana (desde segunda, 00:00 UTC)</h3>
      <p className="text-xs text-gray-500">Meta de custo de dados por assinante: até 15% do líquido semanal (cerca de US$ 1,20 no Starter e US$ 1,80 no Premium; ver docs/cost-strategy.md). A cota conta @ novos por dia.</p>
      <div className="mt-2 overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-gray-500">
            <tr><th className={th}>Assinante</th><th className={th}>Plano</th><th className={`${th} text-right`}>Coletas (falhas)</th><th className={`${th} text-right`}>Custo na semana</th><th className={`${th} w-48`}>Cota semanal</th></tr>
          </thead>
          <tbody>
            {data?.subscribersThisWeek.map((s) => (
              <tr key={s.userId} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-semibold text-ink">{s.email ?? s.userId}</td>
                <td className="px-4 py-2.5 capitalize text-gray-600">{s.plan ?? "—"}{s.status && s.status !== "active" ? ` · ${s.status}` : ""}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{s.runs}{s.failed > 0 && <span className="text-red-600"> ({s.failed})</span>}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-ink">{usd(s.usd)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1"><Bar value={s.quotaUsed} max={s.quotaLimit} tone={s.quotaUsed >= s.quotaLimit ? "bg-red-500" : "bg-brand-magenta"} /></div>
                    <span className="whitespace-nowrap text-xs tabular-nums text-gray-500">{s.quotaUsed}/{s.quotaLimit}</span>
                  </div>
                </td>
              </tr>
            ))}
            {!data?.subscribersThisWeek.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">{loading ? "Carregando…" : "Nenhum assinante coletou dados nesta semana."}</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 className="mt-7 text-[15px] font-extrabold text-ink">Por actor (30 dias)</h3>
      <div className="mt-2 overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-gray-500">
            <tr><th className={th}>Actor</th><th className={`${th} text-right`}>Coletas</th><th className={`${th} text-right`}>Falhas</th><th className={`${th} text-right`}>Itens</th><th className={`${th} text-right`}>Custo</th><th className={`${th} text-right`}>Tempo médio</th></tr>
          </thead>
          <tbody>
            {data?.byActor.map((a) => (
              <tr key={a.actor} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-semibold text-ink">{a.actor}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{a.runs}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${a.failed ? "text-red-600" : "text-gray-600"}`}>{a.failed}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{a.items}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-ink">{usd(a.usd)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{(a.avgMs / 1000).toFixed(1)} s</td>
              </tr>
            ))}
            {!data?.byActor.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{loading ? "Carregando…" : "Nenhuma coleta nos últimos 30 dias."}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-500">O "cache hit" conta só consultas de perfil que terminaram com resultado (inclui privado e não encontrado). Coletas falhas aparecem com custo 0 porque a Apify pode cobrar a partida e isso ainda não é reconciliado.</p>
    </section>
  );
}
