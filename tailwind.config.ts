import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF9F6",
        ink: "#20241F",
        line: "#E4E1DB",
        accent: {
          DEFAULT: "#0E6B5C",
          dark: "#0A4F44",
          light: "#E4F1EE",
        },
        ochre: {
          DEFAULT: "#B8862B",
          light: "#F6EDDC",
        },
      },
      fontFamily: {
        sans: ["var(--font-vazirmatn)", "Tahoma", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
