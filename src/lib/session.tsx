import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Me } from "./types";
import { isMock, mockApi } from "../components/funnel/mock";

type Session = {
  me: Me | null;
  /** true até a primeira resposta do /api/me */
  loading: boolean;
  refresh: () => Promise<Me | null>;
  setMe: (m: Me | null) => void;
  logout: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);

export const isActive = (m: Me | null | undefined) => m?.status === "active";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    let m: Me | null = null;
    try { m = isMock() ? await mockApi.me() : await api.me(); } catch { m = null; }
    setMe(m);
    setLoading(false);
    return m;
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    if (!isMock()) { try { await api.logout(); } catch { /* sessão já pode ter caído */ } }
    setMe(null);
  }, []);

  const value = useMemo(() => ({ me, loading, refresh, setMe, logout }), [me, loading, refresh, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMe(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useMe fora do SessionProvider");
  return s;
}

/** Escolha de plano guardada antes do checkout (também lida pelo /login e /welcome). */
export type Pending = { plan?: string; cycle?: string; username?: string; email?: string };
export function readPending(): Pending {
  try { return JSON.parse(localStorage.getItem("fc_pending_plan") || "{}") as Pending; } catch { return {}; }
}
export function writePending(p: Pending) {
  try { localStorage.setItem("fc_pending_plan", JSON.stringify(p)); } catch { /* sem storage */ }
}
