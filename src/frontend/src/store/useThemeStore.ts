import { create } from 'zustand';

export interface ThemeConfig {
  nomeLoja: string;
  subtituloLoja: string;
  corPrimaria: string;
  corPrimariaHover: string;
  logoUrl?: string; // Data URL ou caminho
}

const STORAGE_KEY_THEME = 'pdv_atylus_theme_v1';

const temaPadrao: ThemeConfig = {
  nomeLoja: 'ATYLUS',
  subtituloLoja: 'OPEN',
  corPrimaria: '#005bf8', // Azul Royal oficial
  corPrimariaHover: '#004ce5',
  logoUrl: '',
};

const carregarTemaSalvo = (): ThemeConfig => {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY_THEME);
    if (salvo) return { ...temaPadrao, ...JSON.parse(salvo) };
  } catch {}
  return temaPadrao;
};

interface ThemeState {
  theme: ThemeConfig;
  atualizarTema: (novoTema: Partial<ThemeConfig>) => void;
  resetarTema: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: carregarTemaSalvo(),

  atualizarTema: (novoTema) => {
    const atualizado = { ...get().theme, ...novoTema };
    set({ theme: atualizado });
    try {
      localStorage.setItem(STORAGE_KEY_THEME, JSON.stringify(atualizado));
      // Injeta CSS Variable global para reaproveitamento dinâmico
      document.documentElement.style.setProperty('--color-primary', atualizado.corPrimaria);
    } catch {}
  },

  resetarTema: () => {
    set({ theme: temaPadrao });
    try {
      localStorage.setItem(STORAGE_KEY_THEME, JSON.stringify(temaPadrao));
      document.documentElement.style.setProperty('--color-primary', temaPadrao.corPrimaria);
    } catch {}
  },
}));
