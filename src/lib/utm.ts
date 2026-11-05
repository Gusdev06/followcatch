// Guarda as UTMs da entrada no site até o checkout: o funil troca de página e perde a query.
// Última origem vence. Sem localStorage (janela privada), a venda só fica sem origem.
const KEY = "fc_tracking";
const PARAMS = ["src", "sck", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

export function captureTracking(): void {
  try {
    const query = new URLSearchParams(window.location.search);
    const found: Record<string, string> = {};
    for (const param of PARAMS) {
      const value = query.get(param);
      if (value) found[param] = value;
    }
    if (Object.keys(found).length) localStorage.setItem(KEY, JSON.stringify(found));
  } catch {
    /* sem storage */
  }
}

export function getTracking(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}
