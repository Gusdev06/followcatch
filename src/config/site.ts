// Marca, preços e prova social. Decisão 15/10: nada de número inventado aqui;
// avaliações, assinaturas recentes e usuários entram quando forem reais.
export const site = {
  name: "FollowCatch",
  domain: "followcatch.com",
  supportEmail: "support@followcatch.com",
  promo: {
    // Promoção real com data de fim. null = barra sem contador.
    label: "Launch Sale · Quarterly 30% Off",
    endsAt: null as string | null, // ex.: "2026-10-31T23:59:59-04:00"
  },
  plans: [
    { id: "premium", name: "Premium", weekly: 14, anchorWeekly: 35, features: ["Unlimited accounts", "New following & followers", "Unfollow alerts", "Story viewer", "Priority support"] },
    { id: "starter", name: "Starter", weekly: 12, anchorWeekly: 30, features: ["Track up to 2 accounts", "New following & followers", "Unfollow alerts", "Email support"] },
  ],
  quarterlyDiscount: 0.3, // trimestral = semanal × 13 × (1 - desconto)
  socialProof: {
    rating: null as null | { score: number; count: number },
    usersThisMonth: null as number | null,
    recentSubscriptions: [] as { name: string; plan: string; at: string }[],
    testimonials: [] as { name: string; text: string; source: string }[],
  },
};
export const quarterlyTotal = (weekly: number) => +(weekly * 13 * (1 - site.quarterlyDiscount)).toFixed(2);
export const quarterlyWeekly = (weekly: number) => +(weekly * (1 - site.quarterlyDiscount)).toFixed(2);
