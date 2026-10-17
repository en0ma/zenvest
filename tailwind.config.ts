import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {
    colors: { ink: "#252525", forest: "#292725", mint: "#d6a16f", canvas: "#faf8f3", muted: "#91603f" },
    boxShadow: { soft: "0 14px 50px rgba(55,43,32,.08)" }
  }},
  plugins: [],
} satisfies Config;
