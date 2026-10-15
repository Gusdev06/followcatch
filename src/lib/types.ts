// Contrato entre front e back. Mudança aqui passa pelo coordenador (CONTRATO.md / CONTRATO-F2.md).
export type MiniAccount = { username: string; fullName: string; picUrl: string; verified: boolean; private: boolean };
export type Profile = {
  username: string; fullName: string; bio: string; picUrl: string; verified: boolean; private: boolean;
  posts: number; followers: number; following: number; similar: MiniAccount[]; fetchedAt: string;
};
export type Gender = "female" | "male" | "other";
export type FollowItem = MiniAccount & { gender: Gender; rank: number /* 0 = mais recente */ };
/** Item escondido pra quem não assina: o servidor nem manda username/nome/foto. */
export type LockedItem = { locked: true; gender: Gender; rank: number };
export const isLocked = (i: FollowItem | LockedItem): i is LockedItem => "locked" in i && i.locked === true;
export type FollowList = {
  username: string; kind: "following" | "followers";
  items: (FollowItem | LockedItem)[];
  /** true = teaser (sem assinatura ativa); false = lista completa */
  locked: boolean;
  total: number;
  fetchedAt: string;
};
export type PlanId = "premium" | "starter";
export type Cycle = "weekly" | "quarterly";
export type Me = {
  email: string;
  plan: PlanId | null;
  cycle: Cycle | null;
  status: "active" | "past_due" | "canceled" | "none";
  renewsAt: string | null;
};
export type ApiErrorCode = "invalid" | "not_found" | "private" | "rate_limited" | "provider_error" | "unauthorized" | "email_taken" | "bad_credentials" | "payment_error";
export type ApiError = { error: ApiErrorCode; message: string };
