import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {
    colors: { ink: "#0d1714", forest: "#113a2d", mint: "#a8efc6", canvas: "#f6f8f6", muted: "#667970" },
    boxShadow: { soft: "0 14px 50px rgba(19,55,39,.07)" }
  }},
  plugins: [],
} satisfies Config;
