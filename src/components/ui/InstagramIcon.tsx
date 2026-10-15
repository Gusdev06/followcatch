export function InstagramIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id="igg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#feda75" />
          <stop offset=".3" stopColor="#fa7e1e" />
          <stop offset=".6" stopColor="#d62976" />
          <stop offset="1" stopColor="#962fbf" />
        </linearGradient>
      </defs>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="url(#igg)" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="4.3" fill="none" stroke="url(#igg)" strokeWidth="2.2" />
      <circle cx="17.4" cy="6.6" r="1.3" fill="url(#igg)" />
    </svg>
  );
}
export default InstagramIcon;
