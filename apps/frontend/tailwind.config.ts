import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#FFF4F1",
          100: "#FFE4DD",
          200: "#FFC7B8",
          300: "#FFA48D",
          400: "#FF8266",
          500: "#FF6A4D",
          600: "#F3512F",
          700: "#CC3D1F",
          800: "#A02F17",
        },
        mint: {
          50: "#F0FBF6",
          100: "#DBF5E9",
          200: "#B7EAD3",
          300: "#8ADFBC",
          400: "#5DCE9F",
          500: "#3AB483",
          600: "#2B9268",
          700: "#217050",
          800: "#1A5740",
        },
        cream: "#FFFBF5",
      },
      boxShadow: {
        soft: "0 8px 24px -6px rgba(255, 106, 77, 0.35)",
        "soft-lg": "0 16px 40px -8px rgba(255, 106, 77, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
