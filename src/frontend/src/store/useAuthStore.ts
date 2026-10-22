import { create } from 'zustand';

interface OperadorAuth {
  id: string;
  matricula: string;
  nome: string;
  role: 'Operador' | 'Supervisor';
}

interface AuthState {
  operador: OperadorAuth;
  trocarOperador: (matricula: string, pin: string) => boolean;
  validarSupervisor: (pin: string) => boolean;
}

export const useAuthStore = create<AuthState>(() => ({
  operador: {
    id: 'OP01',
    matricula: 'OP01',
    nome: 'Operador Padrão',
    role: 'Operador',
  },

  trocarOperador: (matricula, pin) => {
    // PIN '0000' ou '1234'
    if (pin === '0000' || pin === '1234') {
      useAuthStore.setState({
        operador: {
          id: matricula,
          matricula,
          nome: matricula === 'GER01' ? 'Gerente Geral' : `Operador ${matricula}`,
          role: pin === '1234' ? 'Supervisor' : 'Operador',
        },
      });
      return true;
    }
    return false;
  },

  validarSupervisor: pin => {
    return pin === '1234';
  },
}));
