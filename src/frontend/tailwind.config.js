/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        horus: {
          bg: '#0b1118',       // Fundo principal escuro profundo do Hórus PDV
          card: '#111c26',     // Cartões e painéis secundários
          surface: '#162330',  // Elementos elevados e cabeçalhos
          border: '#1f3042',   // Bordas sutis de alta definição
          accent: '#0284c7',   // Azul primário característico (Sky 600)
          cyan: '#0ea5e9',     // Azul ciano de destaque (Sky 500)
          emerald: '#10b981',  // Verde esmeralda para totais e dinheiro
          amber: '#f59e0b',    // Âmbar para avisos e caixa
          rose: '#f43f5e',     // Vermelho rosa para cancelamentos
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
