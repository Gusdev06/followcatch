import { site } from "../../config/site";

/** Botão flutuante de suporte: abre o email (sem chat ao vivo na F1). */
export function ChatBubble() {
  return (
    <a
      href={`mailto:${site.supportEmail}?subject=${encodeURIComponent(`${site.name} support`)}`}
      aria-label="Contact support by email"
      className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-cta text-white shadow-[0_10px_25px_-8px_rgba(225,48,108,0.7)] transition hover:scale-105 sm:bottom-6 sm:right-6"
    >
      <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2Zm3 5v2h10V9H7Zm0 4v2h7v-2H7Z" /></svg>
    </a>
  );
}
export default ChatBubble;
