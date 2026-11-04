// Painel interno: quem se cadastrou. Pede a ADMIN_KEY uma vez e guarda no navegador.
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminSearches from "./AdminSearches";

type AdminUser = {
  id: string;
  email: string;
  createdAt: string;
  plan: string | null;
  cycle: string | null;
  status: string;
  provider: string | null;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  searches: number;
  lastSearchAt: string | null;
  lastUsername: string | null;
  checkouts: number;
  lastSeenAt: string | null;
};
type Data = { generatedAt: string; users: AdminUser[] };
type Filter = "all" | "paying" | "checkout" | "free";

const KEY = "fc_admin_key";
const DAYS = 30;

const store = {
  get: () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } },
  set: (v: string) => { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch { /* sem storage */ } },
};

const paying = (u: AdminUser) => u.status === "active" || u.status === "past_due" || u.status === "trialing";
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function ago(iso: string | null) {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}

function StatusPill({ u }: { u: AdminUser }) {
  const map: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    trialing: "bg-emerald-50 text-emerald-700 border-emerald-200",
    past_due: "bg-amber-50 text-amber-700 border-amber-200",
    canceled: "bg-gray-100 text-gray-600 border-gray-200",
  };
  const label = u.status === "none" ? (u.checkouts ? "abriu checkout" : "grátis") : u.status.replace("_", " ");
  const cls = map[u.status] ?? (u.checkouts ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-white text-gray-500 border-line");
  return <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${cls}`}>{label}</span>;
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-card border border-line bg-white p-4">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-[28px] font-extrabold tabular-nums leading-tight text-ink">{value}</div>
      {sub && <div className="text-[12px] text-gray-500">{sub}</div>}
    </div>
  );
}

function Daily({ users }: { users: AdminUser[] }) {
  const days = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) {
      const k = dayKey(new Date(u.createdAt));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const out: { k: string; label: string; n: number }[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = dayKey(d);
      out.push({ k, label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), n: counts.get(k) ?? 0 });
    }
    return out;
  }, [users]);
  const max = Math.max(1, ...days.map((d) => d.n));
  return (
    <div className="rounded-card border border-line bg-white p-4">
      <div className="mb-3 text-[13px] font-bold text-ink">Cadastros por dia · últimos {DAYS} dias</div>
      <div className="flex h-32 items-end gap-[3px]">
        {days.map((d) => (
          <div key={d.k} className="group relative flex h-full flex-1 items-end" title={`${d.label}: ${d.n}`}>
            <div className="w-full rounded-t-[3px] bg-brand-magenta/80 group-hover:bg-brand-magenta" style={{ height: d.n ? `${Math.max(6, (d.n / max) * 100)}%` : "2px", opacity: d.n ? 1 : 0.25 }} />
            {d.n > 0 && <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 text-[11px] font-bold tabular-nums text-ink sm:group-hover:block">{d.n}</span>}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-gray-400">
        <span>{days[0].label}</span><span>hoje</span>
      </div>
    </div>
  );
}

function KeyGate({ onKey, error }: { onKey: (k: string) => void; error: string }) {
  const [v, setV] = useState("");
  return (
    <div className="mx-auto mt-24 max-w-sm px-4">
      <h1 className="text-xl font-extrabold text-ink">Painel · consultas e cadastros</h1>
      <p className="mt-1 text-sm text-gray-500">Cole a ADMIN_KEY. Fica salva só neste navegador.</p>
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (v.trim()) onKey(v.trim()); }}>
        <input type="password" autoFocus value={v} onChange={(e) => setV(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand-magenta" placeholder="ADMIN_KEY" />
        <button className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white">Entrar</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}

export default function Admin() {
  const [key, setKey] = useState(store.get);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [qtext, setQtext] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [section, setSection] = useState<"searches" | "users">("searches");
  const clearKey = useCallback(() => { store.set(""); setKey(""); setData(null); }, []);

  const load = useCallback(async (k: string) => {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/admin/users", { headers: { "x-admin-key": k }, cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { store.set(""); setKey(""); setErr("Chave inválida."); return; }
      if (!r.ok) throw new Error(j.message || `HTTP ${r.status}`);
      setData(j as Data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Admin · FollowCatch";
    const m = document.createElement("meta");
    m.name = "robots"; m.content = "noindex";
    document.head.appendChild(m);
    return () => { m.remove(); };
  }, []);
  useEffect(() => { if (key) void load(key); }, [key, load]);

  const users = data?.users ?? [];
  const stats = useMemo(() => {
    const now = Date.now();
    const today = dayKey(new Date());
    const within = (iso: string, d: number) => now - new Date(iso).getTime() < d * 86400_000;
    const pay = users.filter(paying).length;
    return {
      total: users.length,
      today: users.filter((u) => dayKey(new Date(u.createdAt)) === today).length,
      d7: users.filter((u) => within(u.createdAt, 7)).length,
      pay,
      checkout: users.filter((u) => u.checkouts > 0).length,
      conv: users.length ? (pay / users.length) * 100 : 0,
    };
  }, [users]);

  const shown = useMemo(() => {
    const t = qtext.trim().toLowerCase();
    return users.filter((u) => {
      if (t && !u.email.includes(t) && !(u.lastUsername ?? "").includes(t)) return false;
      if (filter === "paying") return paying(u);
      if (filter === "checkout") return !paying(u) && u.checkouts > 0;
      if (filter === "free") return !paying(u) && u.checkouts === 0;
      return true;
    });
  }, [users, qtext, filter]);

  const exportCsv = () => {
    const head = ["email", "cadastro", "status", "plano", "ciclo", "buscas", "ultimo_perfil", "checkouts", "ultimo_login"];
    const lines = shown.map((u) => [u.email, u.createdAt, u.status, u.plan ?? "", u.cycle ?? "", u.searches, u.lastUsername ?? "", u.checkouts, u.lastSeenAt ?? ""].join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `followcatch-cadastros-${dayKey(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!key) return <KeyGate onKey={(k) => { store.set(k); setKey(k); }} error={err} />;

  const tabs: [Filter, string][] = [["all", "Todos"], ["paying", "Pagantes"], ["checkout", "Abriu checkout"], ["free", "Grátis"]];

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">Atividade · FollowCatch</h1>
            <p className="text-[13px] text-gray-500">{data ? `Atualizado ${dt(data.generatedAt)}` : loading ? "Carregando…" : ""}</p>
          </div>
          <div className="flex gap-2">
            {section === "users" && <><button onClick={() => void load(key)} disabled={loading} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50">{loading ? "Atualizando…" : "Atualizar"}</button>
            <button onClick={exportCsv} disabled={!shown.length} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50">CSV</button></>}
            <button onClick={clearKey} className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-500">Sair</button>
          </div>
        </div>

        {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <div className="mt-5 flex gap-2 border-b border-line" aria-label="Seções do admin">
          {([["searches", "Consultas"], ["users", "Cadastros"]] as const).map(([value, label]) => (
            <button key={value} aria-pressed={section === value} onClick={() => setSection(value)} className={`border-b-2 px-4 py-3 text-sm font-bold ${section === value ? "border-brand-magenta text-brand-magenta" : "border-transparent text-gray-500"}`}>{label}</button>
          ))}
        </div>

        {section === "searches" ? <AdminSearches adminKey={key} onUnauthorized={clearKey} /> : <>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="Total" value={stats.total} />
          <Kpi label="Hoje" value={stats.today} />
          <Kpi label="7 dias" value={stats.d7} />
          <Kpi label="Abriu checkout" value={stats.checkout} />
          <Kpi label="Pagantes" value={stats.pay} sub={`${stats.conv.toFixed(1)}% dos cadastros`} />
        </div>

        <div className="mt-3"><Daily users={users} /></div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            {tabs.map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${filter === f ? "bg-ink text-white" : "bg-white text-gray-600 ring-1 ring-line"}`}>{label}</button>
            ))}
          </div>
          <input value={qtext} onChange={(e) => setQtext(e.target.value)} placeholder="Buscar email ou @perfil" className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-magenta sm:w-64" />
        </div>

        <div className="mt-3 overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="border-b border-line text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Email</th>
                <th className="px-4 py-2.5 font-semibold">Cadastro</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Plano</th>
                <th className="px-4 py-2.5 text-right font-semibold">Buscas</th>
                <th className="px-4 py-2.5 font-semibold">Último perfil</th>
                <th className="px-4 py-2.5 text-right font-semibold">Último login</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0 hover:bg-gray-50">
                  <td className="max-w-[260px] truncate px-4 py-2.5 font-semibold text-ink" title={u.email}>{u.email}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-gray-600">{dt(u.createdAt)}</td>
                  <td className="px-4 py-2.5"><StatusPill u={u} /></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                    {u.plan ? `${u.plan} · ${u.cycle === "weekly" ? "semanal" : u.cycle === "quarterly" ? "trimestral" : u.cycle ?? ""}` : "—"}
                    {u.cancelAtPeriodEnd && <span className="ml-1 text-[11px] text-amber-600">(cancela)</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{u.searches}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {u.lastUsername ? <a href={`https://instagram.com/${u.lastUsername}`} target="_blank" rel="noreferrer" className="hover:text-brand-magenta">@{u.lastUsername}</a> : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-500">{ago(u.lastSeenAt)}</td>
                </tr>
              ))}
              {!shown.length && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">{loading ? "Carregando…" : users.length ? "Nada nesse filtro." : "Ninguém se cadastrou ainda."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-gray-400">{shown.length} de {users.length} cadastros</p>
        </>}
      </div>
    </div>
  );
}
