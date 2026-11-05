import { create } from 'zustand';
import { OperadorAuth } from '../types';
import { pdvApi } from '../services/api';

interface AuthState {
  operador: OperadorAuth | null;
  autenticado: boolean;
  carregando: boolean;

  login: (matricula: string, pin: string) => Promise<boolean>;
  logout: () => void;
  restaurarSessao: () => Promise<void>;
  validarSupervisor: (pin: string, matricula?: string) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set) => ({
  operador: null,
  autenticado: false,
  carregando: true,

  login: async (matricula: string, pin: string): Promise<boolean> => {
    try {
      const response = await pdvApi.login(matricula, pin);
      set({
        operador: {
          id: response.operador.id,
          matricula: response.operador.matricula,
          nome: response.operador.nome,
          perfil: response.operador.perfil as 'Operador' | 'Supervisor',
        },
        autenticado: true,
      });
      return true;
    } catch {
      return false;
    }
  },

  logout: () => {
    pdvApi.logout();
    set({ operador: null, autenticado: false });
  },

  restaurarSessao: async () => {
    const token = pdvApi.getToken();
    if (!token) {
      set({ carregando: false });
      return;
    }

    try {
      const op = await pdvApi.obterOperadorLogado();
      if (op) {
        set({
          operador: {
            id: op.id,
            matricula: op.matricula,
            nome: op.nome,
            perfil: op.perfil as 'Operador' | 'Supervisor',
          },
          autenticado: true,
          carregando: false,
        });
      } else {
        pdvApi.logout();
        set({ operador: null, autenticado: false, carregando: false });
      }
    } catch {
      pdvApi.logout();
      set({ operador: null, autenticado: false, carregando: false });
    }
  },

  validarSupervisor: async (pin: string, matricula?: string): Promise<boolean> => {
    const result = await pdvApi.validarSupervisor(pin, matricula);
    return result.valido;
  },
}));
