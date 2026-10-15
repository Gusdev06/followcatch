/** Confete decorativo de fundo (quadradinhos coloridos), como no hero de referência. */
const bits = [
  { l: "3%", t: "14%", s: 14, c: "#f9a8d4", r: 12 },
  { l: "6.5%", t: "22%", s: 8, c: "#c4b5fd", r: 45 },
  { l: "1.5%", t: "34%", s: 20, c: "#fbcfe8", r: 20 },
  { l: "3%", t: "42%", s: 16, c: "#d8b4fe", r: -10 },
  { l: "5%", t: "55%", s: 12, c: "#fed7aa", r: 45 },
  { l: "95%", t: "18%", s: 12, c: "#fed7aa", r: 45 },
  { l: "97%", t: "34%", s: 20, c: "#fdba74", r: 15, o: 0.5 },
  { l: "94%", t: "44%", s: 7, c: "#fdba74", r: 0 },
  { l: "96%", t: "56%", s: 16, c: "#f9a8d4", r: 45 },
  { l: "95.5%", t: "80%", s: 13, c: "#d8b4fe", r: 45 },
  { l: "3.5%", t: "80%", s: 13, c: "#fed7aa", r: 45 },
];
export function Decor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block">
      {bits.map((b, i) => (
        <span key={i} className="absolute" style={{ left: b.l, top: b.t, width: b.s, height: b.s, background: b.c, opacity: b.o ?? 0.75, transform: `rotate(${b.r}deg)` }} />
      ))}
    </div>
  );
}
export default Decor;
