import { quarterlyTotal, quarterlyWeekly, site } from "../../config/site";

export type Cycle = "weekly" | "quarterly";
export type Plan = (typeof site.plans)[number];

export const PLAN_BLURB: Record<string, string> = {
  premium: "Watch as many Instagram accounts as you want, with every feature",
  starter: "Keep tabs on up to 2 Instagram accounts with the essentials",
};

export const findPlan = (id: string | null) => site.plans.find((p) => p.id === id) ?? site.plans[0];
export const parseCycle = (c: string | null): Cycle => (c === "quarterly" ? "quarterly" : "weekly");

export function priceOf(p: Plan, cycle: Cycle) {
  const perWeek = cycle === "weekly" ? p.weekly : quarterlyWeekly(p.weekly);
  const anchorOff = Math.round((1 - p.weekly / p.anchorWeekly) * 100);
  return {
    perWeek,
    anchor: p.anchorWeekly,
    anchorOff,
    total: cycle === "quarterly" ? quarterlyTotal(p.weekly) : p.weekly,
    billed: cycle === "quarterly" ? `Billed $${quarterlyTotal(p.weekly).toFixed(2)} every 3 months` : "Billed weekly · cancel anytime",
  };
}
