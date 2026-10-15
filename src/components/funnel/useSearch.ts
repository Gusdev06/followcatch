import { useEffect, useState } from "react";
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

/** Perfil primeiro; quando chega, following + followers + gênero em paralelo. */
export function useSearch(raw: string) {
  const username = normalizeUsername(raw);
  const [state, setState] = useState<SearchState>(() => ({
    username,
    profile: { status: "loading" },
    following: { status: "idle" },
    followers: { status: "idle" },
    gender: null,
  }));

  useEffect(() => {
    let alive = true;
    const set = (fn: (s: SearchState) => SearchState) => alive && setState(fn);
    setState({ username, profile: { status: "loading" }, following: { status: "idle" }, followers: { status: "idle" }, gender: null });

    if (!isValidUsername(username)) {
      setState((s) => ({ ...s, profile: { status: "error", error: "invalid" } }));
      return () => { alive = false; };
    }
    const src = isMock()
      ? mockApi
      : { profile: api.profile, following: api.following, followers: api.followers, gender: async (u: string) => ({ gender: await fetchGender(u) }) };

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
      set((s) => ({ ...s, profile: { status: "ok", data: profile }, following: { status: "loading" }, followers: { status: "loading" } }));
      const list = (kind: "following" | "followers") =>
        src[kind](username).then(
          (data) => set((s) => ({ ...s, [kind]: { status: "ok", data } })),
          (e) => set((s) => ({ ...s, [kind]: { status: "error", error: errCode(e) } })),
        );
      void list("following");
      void list("followers");
      src.gender(username).then((g) => set((s) => ({ ...s, gender: g.gender })), () => undefined);
    })();

    return () => { alive = false; };
  }, [username]);

  return state;
}
