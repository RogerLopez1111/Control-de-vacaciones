import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Montserrat Variable'", "Montserrat", "system-ui", "sans-serif"],
        heading: ["'Montserrat Variable'", "Montserrat", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          red: "#B70B0F",
          "red-tint": "#FBE7E8",
          navy: "#141456",
          "navy-tint": "#E7E7F0",
          gray: "#686868",
        },
      },
      fontVariantNumeric: { tabular: "tabular-nums" },
    },
  },
  plugins: [],
};

export default config;
