/** @type {import('tailwindcss').Config} */
function withOpacity(varName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) return `rgba(var(${varName}), ${opacityValue})`;
    return `rgb(var(${varName}))`;
  };
}

module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  withOpacity("--brand-50"),
          100: withOpacity("--brand-100"),
          200: withOpacity("--brand-200"),
          300: withOpacity("--brand-300"),
          400: withOpacity("--brand-400"),
          500: withOpacity("--brand-500"),
          600: withOpacity("--brand-600"),
          700: withOpacity("--brand-700"),
          800: withOpacity("--brand-800"),
          900: withOpacity("--brand-900"),
          950: withOpacity("--brand-950"),
        },
        midnight: {
          50:  withOpacity("--mid-50"),
          100: withOpacity("--mid-100"),
          200: withOpacity("--mid-200"),
          300: withOpacity("--mid-300"),
          400: withOpacity("--mid-400"),
          500: withOpacity("--mid-500"),
          600: withOpacity("--mid-600"),
          700: withOpacity("--mid-700"),
          800: withOpacity("--mid-800"),
          900: withOpacity("--mid-900"),
          950: withOpacity("--mid-950"),
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        display: ['"Instrument Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
