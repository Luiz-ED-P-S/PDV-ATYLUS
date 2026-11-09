import { create } from 'zustand';

export interface OperadorAuth {
  id: string;
  matricula: string;
  nome: string;
  role: 'Operador' | 'Supervisor';
}

const operadorPadrao: OperadorAuth = {
  id: 'OP01',
  matricula: 'OP01',
  nome: 'Operador Padrão',
  role: 'Operador',
};

interface AuthState {
  operador: OperadorAuth;
  autenticado: boolean;
  login: (emailOuMatricula: string, senhaOuPin: string) => Promise<boolean>;
  logout: () => void;
  trocarOperador: (matricula: string, pin: string) => boolean;
  validarSupervisor: (pin: string) => boolean;
}

export const useAuthStore = create<AuthState>((set) => ({
  operador: operadorPadrao,
  autenticado: true,

  login: async (emailOuMatricula, _senhaOuPin) => {
    set({
      operador: {
        id: emailOuMatricula,
        matricula: emailOuMatricula.includes('@') ? emailOuMatricula.split('@')[0].toUpperCase() : emailOuMatricula,
        nome: emailOuMatricula.includes('@') ? emailOuMatricula.split('@')[0] : `Operador ${emailOuMatricula}`,
        role: 'Supervisor',
      },
      autenticado: true,
    });
    return true;
  },

  logout: () => {
    set({ operador: operadorPadrao, autenticado: false });
  },

  trocarOperador: (matricula, pin) => {
    // PIN '0000' ou '1234'
    if (pin === '0000' || pin === '1234') {
      set({
        operador: {
          id: matricula,
          matricula,
          nome: matricula === 'GER01' ? 'Gerente Geral' : `Operador ${matricula}`,
          role: pin === '1234' ? 'Supervisor' : 'Operador',
        },
        autenticado: true,
      });
      return true;
    }
    return false;
  },

  validarSupervisor: pin => {
    return pin === '1234';
  },
}));
