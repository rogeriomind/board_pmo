import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        panel: "0 18px 50px rgba(15, 23, 42, 0.08)",
        card: "0 8px 26px rgba(15, 23, 42, 0.07)"
      },
      colors: {
        ink: "#071536",
        muted: "#667085",
        line: "#e4e8f0",
        brand: "#5b35f2"
      }
    }
  },
  plugins: []
} satisfies Config;
