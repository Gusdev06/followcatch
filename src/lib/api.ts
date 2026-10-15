import type { ApiError, FollowList, Profile } from "./types";

export class ApiFail extends Error {
  constructor(public code: ApiError["error"], message: string) { super(message); }
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  const body = await r.json().catch(() => ({ error: "provider_error", message: "Bad response" }));
  if (!r.ok) throw new ApiFail(body.error ?? "provider_error", body.message ?? "Request failed");
  return body as T;
}

export const normalizeUsername = (raw: string) => raw.trim().replace(/^@/, "").replace(/.*instagram\.com\//, "").replace(/[/?#].*$/, "").toLowerCase();
export const isValidUsername = (u: string) => /^[a-z0-9._]{1,30}$/.test(u);

export const api = {
  profile: (u: string) => get<Profile>(`/api/profile?u=${encodeURIComponent(u)}`),
  following: (u: string) => get<FollowList>(`/api/following?u=${encodeURIComponent(u)}`),
  followers: (u: string) => get<FollowList>(`/api/followers?u=${encodeURIComponent(u)}`),
};

/** Toda foto do Instagram passa pelo proxy (CDN do IG expira e bloqueia hotlink). */
export const img = (url: string) => (url ? `/api/img?url=${encodeURIComponent(url)}` : "");
