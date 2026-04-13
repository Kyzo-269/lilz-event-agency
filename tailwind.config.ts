import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette Drapeau Comorien — LIL'Z EVENT AGENCY
        brand: {
          50:  "#e6f7ee",
          100: "#c2ecce",
          200: "#86d9a0",
          300: "#4ac672",
          400: "#1ab359",
          500: "#009A44",   // vert principal
          600: "#007d38",
          700: "#006030",
          800: "#004522",
          900: "#002d15",
          950: "#001a0d",
        },
        gold: {
          400: "#FFD700",   // jaune comorien
          500: "#e6c200",
          600: "#ccab00",
        },
        cobalt: {
          400: "#60a5fa",
          500: "#1E90FF",   // bleu comorien
          600: "#1a7fd4",
          700: "#1565b0",
        },
        rouge: {
          400: "#f87171",
          500: "#E4002B",   // rouge comorien
          600: "#c00025",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
