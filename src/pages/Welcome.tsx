import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Footer, Header } from "../components/ui";
import { site } from "../config/site";

// Volta do checkout da PaymentKit (success URL). O acesso pago é liberado pelo webhook quando o backend subir.
export default function Welcome() {
  const [params] = useSearchParams();
  const plan = site.plans.find((p) => p.id === params.get("plan")) ?? site.plans[0];
  const cycle = params.get("cycle") === "quarterly" ? "quarterly" : "weekly";
  let username = "";
  try { username = JSON.parse(localStorage.getItem("fc_pending_plan") || "{}").username || ""; } catch { /* sem storage */ }

  useEffect(() => { document.title = "Welcome to FollowCatch"; }, []);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cta text-3xl text-white shadow-lg">✓</div>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink">You're in!</h1>
        <p className="mt-3 text-[15px] text-gray-600">
          Thanks! Your <b>{plan.name}</b> ({cycle}) subscription is active.
        </p>
        <p className="mt-2 text-[15px] text-gray-600">
          We'll email your access details to the address you used at checkout.
        </p>
        {username && (
          <div className="mt-8">
            <Button href={`/search?u=${username}`} variant="cta">See @{username} again</Button>
          </div>
        )}
        <p className="mt-8 text-xs text-gray-500">Questions? <a className="underline" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a></p>
      </main>
      <Footer />
    </div>
  );
}
