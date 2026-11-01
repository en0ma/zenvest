import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {
    colors: { ink: "#14253D", forest: "#14253D", mint: "#B5ACF2", canvas: "#F6F8FB", muted: "#5145A8" },
    boxShadow: { soft: "0 14px 50px rgba(55,43,32,.08)" }
  }},
  plugins: [],
} satisfies Config;
