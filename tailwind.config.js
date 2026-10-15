/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      colors: { ink: "#111827", line: "#eef0f3", brand: { orange: "#ff7a3d", pink: "#ff2d55", magenta: "#e1306c" } },
      backgroundImage: { cta: "linear-gradient(90deg,#ff7a3d 0%,#ff2d55 55%,#e1306c 100%)", ig: "linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)" },
      borderRadius: { card: "16px" },
    },
  },
  plugins: [],
};
