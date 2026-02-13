/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/**/*.{tsx,ts,html}"],
  theme: {
    extend: {
      colors: {
        accent: "var(--accent)",
        "accent-on": "var(--accent-on)",
        "bg-primary": "var(--bg-primary)",
        "bg-secondary": "var(--bg-secondary)",
        "bg-tertiary": "var(--bg-tertiary)",
        border: "var(--border)",
        danger: "var(--danger)",
        "text-dim": "var(--text-dim)",
        "text-muted": "var(--text-muted)",
        "text-primary": "var(--text-primary)",
        warning: "var(--warning)",
        "slider-thumb": "var(--slider-thumb)",
        "slider-track": "var(--slider-track)",
      },
      fontFamily: {
        sans: ["var(--font)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        theme: "var(--border-radius)",
      },
    },
  },
  plugins: [],
};
