import { useEffect, useState } from "react";

type Search = {
  id: string; visitorId: string; userId: string | null; email: string | null;
  username: string; outcome: string; source: string; at: string;
};
type Data = {
  generatedAt: string; page: number; pageSize: number; total: number; items: Search[];
  summary: { total: number; anonymous: number; visitors: number; today: number; legacy: number };
};
type Kind = "all" | "anonymous" | "registered";
const date = (value: string) => new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const outcomes: Record<string, string> = {
  pending: "Iniciada", success: "Encontrado", private: "Perfil privado", not_found: "Não encontrado",
  rate_limited: "Limite atingido", provider_error: "Erro na consulta", unknown: "Não registrado",
};

export default function AdminSearches({ adminKey, onUnauthorized }: { adminKey: string; onUnauthorized: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<Kind>("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setInterval(() => setRefresh((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page), kind, q: query });
    void (async () => {
      try {
        const r = await fetch(`/api/admin/searches?${params}`, {
          headers: { "x-admin-key": adminKey }, cache: "no-store", signal: controller.signal,
        });
        if (!alive) return;
        if (r.status === 401) { onUnauthorized(); return; }
        const body = await r.json();
        if (!r.ok) throw new Error(body.message || `HTTP ${r.status}`);
        if (alive) setData(body as Data);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Não foi possível carregar as consultas.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; controller.abort(); };
  }, [adminKey, page, kind, query, refresh, onUnauthorized]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 50)));
  return (
    <section className="mt-5" aria-label="Consultas de todos os visitantes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-ink">Quem consultou</h2>
          <p className="text-[13px] text-gray-500">Com e sem conta · atualização automática a cada 30 segundos.</p>
        </div>
        <button onClick={() => setRefresh((n) => n + 1)} disabled={loading} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">
          {loading ? "Atualizando…" : "Atualizar consultas"}
        </button>
      </div>
      {error && <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error} {data && "Os dados abaixo são da última atualização concluída."}</div>}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ["Consultas", data?.summary.total], ["Sem identificação", data?.summary.anonymous],
          ["Visitantes / contas", data?.summary.visitors], ["Consultas hoje (UTC)", data?.summary.today],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-card border border-line bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
            <div className="mt-1 text-[28px] font-extrabold tabular-nums text-ink">{value ?? "—"}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500">Sem login, identificamos o navegador por um código. Nome e e-mail só aparecem quando há uma conta conectada. Um visitante pode usar mais de um navegador.</p>
      {!!data?.summary.legacy && <p className="mt-1 text-xs text-amber-700">{data.summary.legacy} registros antigos recuperados. Esse histórico é parcial: pode agrupar visitantes pelo IP, não confirma se havia login e não inclui todas as repetições ou consultas atendidas pelo cache.</p>}
      <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row">
        <div className="flex flex-wrap gap-1" aria-label="Filtrar consultas">
          {([["all", "Todos"], ["anonymous", "Sem identificação"], ["registered", "Com conta"]] as const).map(([value, label]) => (
            <button key={value} aria-pressed={kind === value} onClick={() => { setKind(value); setPage(1); }} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${kind === value ? "bg-ink text-white" : "bg-white text-gray-600 ring-1 ring-line"}`}>{label}</button>
          ))}
        </div>
        <input aria-label="Buscar consultas" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="E-mail, @perfil ou código" className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-magenta sm:w-72" />
      </div>
      <div className="mt-3 overflow-x-auto rounded-card border border-line bg-white" aria-busy={loading}>
        <table className="w-full min-w-[700px] text-left text-[13px]">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-gray-500">
            <tr>{["Quem consultou", "Perfil consultado", "Quando", "Resultado"].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
          </thead>
          <tbody>
            {data?.items.map((item) => (
              <tr key={item.id} className="border-b border-line last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-semibold text-ink">{item.email ?? (item.source === "legacy" ? "Visitante (registro antigo)" : "Visitante sem login")}</div>
                  <div className="mt-0.5 text-[11px] text-gray-500" title={item.visitorId}>
                    {item.email ? "Conta conectada" : `Código: ${item.visitorId.replace(/^legacy:/, "").slice(0, 12)}`}
                    {item.source === "legacy" && " · registro antigo"}
                  </div>
                </td>
                <td className="px-4 py-3"><a href={`https://www.instagram.com/${item.username}/`} target="_blank" rel="noreferrer" className="font-semibold text-brand-magenta hover:underline">@{item.username}</a></td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-600">{date(item.at)}</td>
                <td className="px-4 py-3 text-gray-600">{outcomes[item.outcome] ?? item.outcome}</td>
              </tr>
            ))}
            {!data?.items.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">{loading ? "Carregando…" : error ? "Não foi possível carregar as consultas." : "Nenhuma consulta encontrada."}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
        <p>{data?.total ?? 0} consultas neste filtro{data && ` · atualizado ${date(data.generatedAt)}`}</p>
        <div className="flex items-center gap-3">
          <button disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-line bg-white px-3 py-2 disabled:opacity-40">Anterior</button>
          <span>Página {page} de {totalPages}</span>
          <button disabled={loading || page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-line bg-white px-3 py-2 disabled:opacity-40">Próxima</button>
        </div>
      </div>
    </section>
  );
}
