import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiFail, isValidUsername, normalizeUsername } from "../../lib/api";
import type { ApiErrorCode, FollowList, Gender, Profile } from "../../lib/types";
import { isMock, mockApi } from "./mock";

export type Slot<T> = { status: "idle" | "loading" | "ok" | "error"; data?: T; error?: ApiErrorCode };

export type SearchState = {
  username: string;
  profile: Slot<Profile>;
  following: Slot<FollowList>;
  followers: Slot<FollowList>;
  gender: Gender | null; // null = desconhecido / ainda não chegou
};

async function fetchGender(u: string): Promise<Gender | null> {
  try {
    const r = await fetch(`/api/gender?u=${encodeURIComponent(u)}`);
    if (!r.ok) return null;
    const b = (await r.json()) as { gender?: Gender };
    return b.gender ?? null;
  } catch {
    return null;
  }
}

const errCode = (e: unknown): ApiErrorCode => (e instanceof ApiFail ? e.code : "provider_error");

type ListKind = "following" | "followers";

/**
 * Perfil primeiro; quando chega, o gênero. As listas NÃO carregam sozinhas: cada uma custa uma coleta
 * paga, então só vai buscar a que a tela está mostrando. Quem usa chama `ensure(aba)` quando a aba
 * aparece (a primeira ao ter o perfil, a outra só se a pessoa clicar). `ensure` é idempotente.
 */
export function useSearch(raw: string) {
  const username = normalizeUsername(raw);
  const [state, setState] = useState<SearchState>(() => ({
    username,
    profile: { status: "loading" },
    following: { status: "idle" },
    followers: { status: "idle" },
    gender: null,
  }));

  const stateRef = useRef(state);
  stateRef.current = state;
  const runRef = useRef(0);

  useEffect(() => {
    let alive = true;
    runRef.current += 1;
    const set = (fn: (s: SearchState) => SearchState) => alive && setState(fn);
    setState({ username, profile: { status: "loading" }, following: { status: "idle" }, followers: { status: "idle" }, gender: null });

    if (!isValidUsername(username)) {
      setState((s) => ({ ...s, profile: { status: "error", error: "invalid" } }));
      return () => { alive = false; };
    }
    const src = dataSource();

    (async () => {
      let profile: Profile;
      try {
        profile = await src.profile(username);
      } catch (e) {
        set((s) => ({ ...s, profile: { status: "error", error: errCode(e) } }));
        return;
      }
      if (profile.private) {
        set((s) => ({ ...s, profile: { status: "ok", data: profile }, following: { status: "error", error: "private" }, followers: { status: "error", error: "private" } }));
        return;
      }
      set((s) => ({ ...s, profile: { status: "ok", data: profile } }));
      src.gender(username).then((g) => set((s) => ({ ...s, gender: g.gender })), () => undefined);
    })();

    return () => { alive = false; };
  }, [username]);

  const ensure = useCallback((kind: ListKind) => {
    const s = stateRef.current;
    if (s.username !== username || s.profile.status !== "ok" || s[kind].status !== "idle") return;
    const run = runRef.current;
    const set = (fn: (s: SearchState) => SearchState) => run === runRef.current && setState(fn);
    stateRef.current = { ...s, [kind]: { status: "loading" } }; // fecha a porta antes do próximo render
    set((x) => ({ ...x, [kind]: { status: "loading" } }));
    dataSource()[kind](username).then(
      (data) => set((x) => ({ ...x, [kind]: { status: "ok", data } })),
      (e) => set((x) => ({ ...x, [kind]: { status: "error", error: errCode(e) } })),
    );
  }, [username]);

  return { ...state, ensure };
}

function dataSource() {
  return isMock()
    ? mockApi
    : { profile: api.profile, following: api.following, followers: api.followers, gender: async (u: string) => ({ gender: await fetchGender(u) }) };
}
