import { create } from 'zustand';

export interface OperadorAuth {
  id: string;
  matricula: string;
  nome: string;
  email?: string;
  role: 'Operador' | 'Supervisor';
  avatarUrl?: string;
}

const STORAGE_KEY_AUTH = 'pdv_atylus_auth_v1';

const operadorPadrao: OperadorAuth = {
  id: 'OP01',
  matricula: 'OP01',
  nome: 'Contato Supervisor',
  email: 'contato@atylus.com.br',
  role: 'Supervisor',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
};

const carregarOperadorSalvo = (): { operador: OperadorAuth; autenticado: boolean } => {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY_AUTH);
    if (salvo) {
      const parsed = JSON.parse(salvo);
      return { operador: { ...operadorPadrao, ...parsed.operador }, autenticado: parsed.autenticado ?? true };
    }
  } catch {}
  return { operador: operadorPadrao, autenticado: true };
};

interface AuthState {
  operador: OperadorAuth;
  autenticado: boolean;
  login: (emailOuMatricula: string, senhaOuPin: string) => Promise<boolean>;
  logout: () => void;
  trocarOperador: (matricula: string, pin: string) => boolean;
  validarSupervisor: (pin: string) => boolean;
  atualizarPerfil: (dados: Partial<OperadorAuth>) => void;
}

const estadoInicial = carregarOperadorSalvo();

export const useAuthStore = create<AuthState>((set, get) => ({
  operador: estadoInicial.operador,
  autenticado: estadoInicial.autenticado,

  login: async (emailOuMatricula, _senhaOuPin) => {
    const novo: OperadorAuth = {
      id: emailOuMatricula,
      matricula: emailOuMatricula.includes('@') ? emailOuMatricula.split('@')[0].toUpperCase() : emailOuMatricula,
      nome: emailOuMatricula.includes('@') ? emailOuMatricula.split('@')[0] : `Operador ${emailOuMatricula}`,
      email: emailOuMatricula.includes('@') ? emailOuMatricula : `${emailOuMatricula}@atylus.com`,
      role: 'Supervisor',
      avatarUrl: get().operador.avatarUrl || operadorPadrao.avatarUrl,
    };
    set({ operador: novo, autenticado: true });
    try {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify({ operador: novo, autenticado: true }));
    } catch {}
    return true;
  },

  logout: () => {
    set({ operador: operadorPadrao, autenticado: false });
    try {
      localStorage.removeItem(STORAGE_KEY_AUTH);
    } catch {}
  },

  trocarOperador: (matricula, pin) => {
    if (pin === '0000' || pin === '1234') {
      const novo: OperadorAuth = {
        id: matricula,
        matricula,
        nome: matricula === 'GER01' ? 'Gerente Geral' : `Operador ${matricula}`,
        email: `${matricula.toLowerCase()}@atylus.com`,
        role: pin === '1234' ? 'Supervisor' : 'Operador',
        avatarUrl: get().operador.avatarUrl || operadorPadrao.avatarUrl,
      };
      set({ operador: novo, autenticado: true });
      try {
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify({ operador: novo, autenticado: true }));
      } catch {}
      return true;
    }
    return false;
  },

  validarSupervisor: pin => {
    return pin === '1234';
  },

  atualizarPerfil: (dados) => {
    const atualizado = { ...get().operador, ...dados };
    set({ operador: atualizado });
    try {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify({ operador: atualizado, autenticado: get().autenticado }));
    } catch {}
  },
}));
