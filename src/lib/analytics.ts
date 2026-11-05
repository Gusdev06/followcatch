// Manda as etapas do funil e o batimento do "ao vivo" para o /admin. Nunca atrapalha o site:
// sem storage ou sem rede, o evento simplesmente se perde.
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getTracking } from "./utm";

const KEY = "fc_lead";
const BEAT_MS = 10_000;
const ROUTE_STEP: Record<string, string> = {
  "/": "landing", "/search": "search", "/plans": "plans", "/signup": "signup",
  "/checkout": "checkout", "/app": "app", "/welcome": "welcome", "/login": "login",
};

const sent = new Set<string>();
let currentStep: string | null = null;

function leadId(): string | null {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Robô, modo de dados gravados e o próprio admin ficam fora da conta. */
function ignored() {
  return navigator.webdriver || location.pathname.startsWith("/admin") || new URLSearchParams(location.search).has("mock");
}

function send(url: string, body: object) {
  try {
    navigator.sendBeacon(url, new Blob([JSON.stringify(body)], { type: "text/plain" }));
  } catch {
    /* sem rede */
  }
}

export function trackStep(step: string) {
  currentStep = step;
  const id = leadId();
  if (!id || ignored() || sent.has(step)) return;
  sent.add(step);
  send("/api/track", { leadId: id, step, tracking: getTracking() });
}

function beat() {
  const id = leadId();
  if (!id || ignored() || document.visibilityState !== "visible") return;
  send("/api/live", { leadId: id, step: currentStep, tracking: getTracking() });
}

/** Etapa por rota + batimento enquanto a página está aberta e visível. */
export function usePageTracking() {
  const { pathname } = useLocation();
  useEffect(() => {
    const step = ROUTE_STEP[pathname];
    if (step) trackStep(step);
    beat();
  }, [pathname]);
  useEffect(() => {
    const id = setInterval(beat, BEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);
}
