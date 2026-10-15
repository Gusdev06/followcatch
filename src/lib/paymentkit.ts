// PaymentKit.js (checkout embutido). Carregado sob demanda pela página /checkout.
// Docs: https://docs.paymentkit.com/guides/integration/sdk-reference/payment-kit-js/getting-started
// O SDK se autentica só com o `secure_token` da checkout session (criada no backend);
// não usa chave publicável. Stripe.js é exigido pela própria doc (3DS, Radar, wallets)
// e o SDK nunca o carrega sozinho, por isso `loadStripeJs()` abaixo.
import PaymentKit from "@payment-kit-js/vanilla";
import CardPaymentMethod from "@payment-kit-js/vanilla/payment-methods/card";
import ApplePayPaymentMethod from "@payment-kit-js/vanilla/payment-methods/apple-pay";
import GooglePayPaymentMethod from "@payment-kit-js/vanilla/payment-methods/google-pay";

export type PkErrors = Record<string, unknown> & { root?: string };
export type PkResult = { ok: true; data: Record<string, unknown> } | { ok: false; errors: PkErrors };
export type CardField = "card_pan" | "card_exp" | "card_cvc";
export type CustomerFields = { name: string; email: string; country: string; zip: string };

const STRIPE_SRC = "https://js.stripe.com/v3/";

/** Injeta Stripe.js uma vez. Resolve mesmo se falhar (o cartão funciona sem; 3DS e wallets não). */
export function loadStripeJs(timeoutMs = 8000): Promise<boolean> {
  const w = window as unknown as { Stripe?: unknown };
  if (w.Stripe) return Promise.resolve(true);
  return new Promise((resolve) => {
    let el = document.querySelector<HTMLScriptElement>(`script[src="${STRIPE_SRC}"]`);
    if (!el) {
      el = document.createElement("script");
      el.src = STRIPE_SRC;
      el.async = true;
      document.head.appendChild(el);
    }
    const t = window.setTimeout(() => resolve(!!w.Stripe), timeoutMs);
    el.addEventListener("load", () => { window.clearTimeout(t); resolve(true); }, { once: true });
    el.addEventListener("error", () => { window.clearTimeout(t); resolve(false); }, { once: true });
  });
}

export type PkHandle = {
  /** Monta os 3 campos de cartão nos seletores dados. Devolve o unmount. */
  mountCard: (
    targets: Record<CardField, string>,
    opts: { onLoaded: (f: CardField) => void; onFocus: (f: CardField, focused: boolean) => void },
  ) => () => void;
  onWalletReady: (cb: (w: { apple: boolean; google: boolean }) => void) => void;
  submitCard: (c: CustomerFields) => Promise<PkResult>;
  submitWallet: (kind: "apple_pay" | "google_pay", info: { first: string; last: string; email: string }) => Promise<PkResult>;
  cleanup: () => void;
};

const INPUT_STYLE: Record<string, string> = {
  fontSize: "16px", // 16px evita o zoom do iOS ao focar
  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  color: "#111827",
};

export function createPaymentKit(secureToken: string): PkHandle {
  const pk = PaymentKit({
    environment: "production",
    secureToken,
    paymentMethods: [CardPaymentMethod, ApplePayPaymentMethod, GooglePayPaymentMethod],
  });

  const run = (paymentMethod: "card" | "apple_pay" | "google_pay", fields: Record<string, string>, options?: unknown) =>
    new Promise<PkResult>((resolve) => {
      pk.submit({
        paymentMethod,
        fields,
        options,
        onSuccess: (data) => resolve({ ok: true, data }),
        onError: (errors) => resolve({ ok: false, errors: errors as PkErrors }),
      });
    });

  return {
    mountCard(targets, { onLoaded, onFocus }) {
      const placeholders: Record<CardField, string> = { card_pan: "1234 1234 1234 1234", card_exp: "MM / YY", card_cvc: "CVV" };
      const mounted = (Object.keys(targets) as CardField[]).map((f) =>
        pk.card
          .createElement(f, {
            style: INPUT_STYLE,
            placeholder: placeholders[f],
            onLoaded: () => onLoaded(f),
            onFocusChange: (focused: boolean) => onFocus(f, focused),
          })
          .mount(targets[f]),
      );
      return () => mounted.forEach((m) => m.unmount());
    },
    onWalletReady(cb) {
      const state = { apple: false, google: false };
      pk.apple_pay.onApplePayReady((r) => { state.apple = r; cb({ ...state }); });
      pk.google_pay.onGooglePayReady((r) => { state.google = r; cb({ ...state }); });
    },
    submitCard: (c) =>
      run("card", {
        customer_name: c.name,
        customer_email: c.email,
        customer_country: c.country,
        customer_zip_code: c.zip,
      }),
    submitWallet: (kind, info) =>
      run(kind, {}, { customerInfo: { first_name: info.first, last_name: info.last, email: info.email } }),
    cleanup: () => pk.cleanup(),
  };
}
