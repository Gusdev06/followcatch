import { useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Footer, Header } from "../components/ui";
import { ErrorCard } from "../components/funnel/ErrorCard";
import { LoadingCard, type Stage } from "../components/funnel/LoadingCard";
import { Preview, StickyUnlock } from "../components/funnel/Preview";
import { SearchBar } from "../components/funnel/SearchBar";
import { Sparkles } from "../components/funnel/shared";
import { useSearch } from "../components/funnel/useSearch";
import { isMock } from "../components/funnel/mock";
import { isActive, useMe } from "../lib/session";
import { trackStep } from "../lib/analytics";

// Ritmo do loading: dura o tempo real do perfil, nunca menos que 6 s no total.
const FIND_MIN = 3000; // "Finding profile…" no mínimo
const COMPLETE_MS = 1400; // "Loading complete" com a barra cheia
const FOUND_MS = 1600; // "Profile Found!" + confete

export default function Search() {
  const [params] = useSearchParams();
  const u = params.get("u") ?? "";
  const { me } = useMe();
  // Assinante vê a lista completa no dashboard, sem blur.
  if (isActive(me)) return <Navigate to={`/app?u=${encodeURIComponent(u)}${isMock() ? "&mock=1" : ""}`} replace />;
  return <SearchFlow key={u} raw={u} />;
}

function SearchFlow({ raw }: { raw: string }) {
  const s = useSearch(raw);
  const inputRef = useRef<HTMLInputElement>(null);
  const start = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const [readyAt, setReadyAt] = useState<number | null>(null);

  const profileOk = s.profile.status === "ok";
  // A primeira aba carrega durante a animação, pra estar pronta quando a prévia abrir. A outra só no clique.
  const { ensure } = s;
  useEffect(() => { if (profileOk) ensure("following"); }, [profileOk, ensure]);
  useEffect(() => {
    if (profileOk && readyAt === null) setReadyAt(Math.max(Date.now(), start.current + FIND_MIN));
  }, [profileOk, readyAt]);

  const done = readyAt !== null && now >= readyAt + COMPLETE_MS + FOUND_MS;
  useEffect(() => { if (done) trackStep("preview"); }, [done]);
  useEffect(() => {
    if (done || s.profile.status === "error") return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [done, s.profile.status]);

  useEffect(() => {
    document.title = `@${s.username || "search"} · Recent following & followers | FollowCatch`;
  }, [s.username]);

  let stage: Stage = "finding";
  // Sobe rápido no começo e segue andando devagar até ~96% (perfil inexistente leva ~55 s até o 404).
  const elapsed = now - start.current;
  let progress = 70 * (1 - Math.exp(-elapsed / 3000)) + 26 * (1 - Math.exp(-elapsed / 30000));
  if (readyAt !== null && now >= readyAt) {
    stage = now >= readyAt + COMPLETE_MS ? "found" : "complete";
    progress = 100;
  }

  const retry = () => {
    const el = inputRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.select();
    el.focus();
  };

  const showPreview = done && s.profile.data;

  return (
    <div className="flex min-h-screen flex-col">
      <Header showPricing />
      <main className={`relative isolate flex-1 px-4 ${showPreview ? "pb-28 pt-6 sm:pt-8" : "py-10 sm:py-14"}`}>
        <Sparkles />
        {showPreview ? (
          <>
            <Preview profile={s.profile.data!} following={s.following} followers={s.followers} gender={s.gender} ensure={ensure} />
            <div className="mx-auto mt-10 max-w-3xl">
              <p className="mb-3 text-center text-sm font-medium text-gray-500">Check another account</p>
              <SearchBar ref={inputRef} />
            </div>
            <StickyUnlock username={s.profile.data!.username} />
          </>
        ) : (
          <>
            <div className="mx-auto mb-7 max-w-2xl text-center">
              <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
                See who <span className="bg-cta bg-clip-text text-transparent">@{s.username || "anyone"}</span> recently followed
              </h1>
              <p className="mt-3 text-[15px] text-gray-600 sm:text-lg">Public Instagram activity, newest first. No login, and they won't be notified.</p>
            </div>
            <div className="mb-6">
              <SearchBar ref={inputRef} initial={s.username} />
            </div>
            {s.profile.status === "error" ? (
              <ErrorCard code={s.profile.error ?? "provider_error"} username={s.username} onRetry={retry} />
            ) : (
              <LoadingCard stage={stage} progress={progress} slow={stage === "finding" && elapsed > 15000} picUrl={s.profile.data?.picUrl} username={s.username} />
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
