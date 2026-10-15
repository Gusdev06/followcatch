// Contrato entre front e back. Mudança aqui passa pelo coordenador (CONTRATO.md).
export type MiniAccount = { username: string; fullName: string; picUrl: string; verified: boolean; private: boolean };
export type Profile = {
  username: string; fullName: string; bio: string; picUrl: string; verified: boolean; private: boolean;
  posts: number; followers: number; following: number; similar: MiniAccount[]; fetchedAt: string;
};
export type Gender = "female" | "male" | "other";
export type FollowItem = MiniAccount & { gender: Gender; rank: number /* 0 = mais recente */ };
export type FollowList = { username: string; kind: "following" | "followers"; items: FollowItem[]; fetchedAt: string };
export type ApiErrorCode = "invalid" | "not_found" | "private" | "rate_limited" | "provider_error";
export type ApiError = { error: ApiErrorCode; message: string };
