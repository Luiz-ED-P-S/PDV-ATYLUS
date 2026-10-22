/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        retail: {
          dark: '#0f172a',     // Slate 900
          card: '#1e293b',     // Slate 800
          border: '#334155',   // Slate 700
          primary: '#10b981',  // Emerald 500 (Ação principal, Total, Sucesso)
          secondary: '#38bdf8',// Sky 400 (Informações e atalhos)
          accent: '#f59e0b',   // Amber 500 (Avisos, Caixa)
          danger: '#ef4444',   // Red 500 (Cancelamentos)
        },
      },
      fontFamily: {
        mono: ['Fira Code', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
