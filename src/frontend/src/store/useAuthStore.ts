import { create } from 'zustand';
import { authApi, LoginResposta, setAuthToken, setOnPinTemporario, setOnUnauthorized } from '../services/api';
import avatarPadraoLocal from '../assets/avatar-padrao.svg';

export type PerfilOperador = 'Operador' | 'Supervisor';

export interface OperadorAuth {
  id: string;
  matricula: string;
  nome: string;
  email?: string;
  role: PerfilOperador;
  avatarUrl?: string;
}

// Sessão (token emitido pelo backend) e preferências visuais do perfil ficam separadas:
// o perfil de acesso (role) vem SEMPRE do token assinado, nunca de dados editáveis no navegador.
const STORAGE_KEY_SESSAO = 'pdv_atylus_sessao_v2';
const STORAGE_KEY_PERFIL_VISUAL = 'pdv_atylus_perfil_visual_v1';
const STORAGE_KEY_AUTH_LEGADO = 'pdv_atylus_auth_v1';

// Avatar padrão local (embutido no pacote): o PDV funciona offline, sem imagens de URLs externas.
const AVATAR_PADRAO = avatarPadraoLocal;

// Perfis salvos por versões anteriores podem ter a URL externa antiga; ela é trocada pelo avatar local.
const normalizarAvatar = (url?: string): string =>
  !url || /^https?:\/\/images\.unsplash\.com\//i.test(url) ? AVATAR_PADRAO : url;

const operadorDeslogado: OperadorAuth = {
  id: '',
  matricula: '',
  nome: '',
  role: 'Operador',
  avatarUrl: AVATAR_PADRAO,
};

interface SessaoSalva {
  token: string;
  operador: { id: string; matricula: string; nome: string };
}

type PerfilVisual = Partial<Pick<OperadorAuth, 'nome' | 'email' | 'avatarUrl'>> & { matricula?: string };

interface PayloadToken {
  exp?: number;
  matricula?: string;
  [claim: string]: unknown;
}

const CLAIM_PIN_TEMPORARIO = 'pin_temporario';
const CLAIM_ROLE = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

const decodificarToken = (token: string): PayloadToken | null => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const perfilDoToken = (payload: PayloadToken): PerfilOperador =>
  payload[CLAIM_ROLE] === 'Supervisor' || payload['role'] === 'Supervisor' ? 'Supervisor' : 'Operador';

const tokenValido = (payload: PayloadToken | null): payload is PayloadToken =>
  !!payload && typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();

const lerJson = <T,>(chave: string): T | null => {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
};

const gravarJson = (chave: string, valor: unknown) => {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {}
};

const remover = (chave: string) => {
  try {
    localStorage.removeItem(chave);
  } catch {}
};

const montarOperador = (sessao: SessaoSalva, payload: PayloadToken): OperadorAuth => {
  // Preferências visuais só valem para o operador que as definiu
  const salvo = lerJson<PerfilVisual>(STORAGE_KEY_PERFIL_VISUAL);
  const visual: PerfilVisual = salvo?.matricula === sessao.operador.matricula ? salvo : {};
  return {
    id: sessao.operador.matricula,
    matricula: sessao.operador.matricula,
    nome: visual.nome || sessao.operador.nome,
    email: visual.email,
    avatarUrl: normalizarAvatar(visual.avatarUrl),
    role: perfilDoToken(payload),
  };
};

// A claim assinada do token só serve para a tela aparecer sem esperar a rede; quem decide é a API (403 PIN_TEMPORARIO)
const pinTemporarioDoToken = (payload: PayloadToken | null): boolean => payload?.[CLAIM_PIN_TEMPORARIO] === 'true';

const carregarSessao = (): { operador: OperadorAuth; autenticado: boolean; token: string | null; usaPinPadrao: boolean } => {
  // A sessão antiga (mock, sem token) não é mais aceita
  remover(STORAGE_KEY_AUTH_LEGADO);

  const sessao = lerJson<SessaoSalva>(STORAGE_KEY_SESSAO);
  const payload = sessao ? decodificarToken(sessao.token) : null;
  if (sessao && tokenValido(payload)) {
    setAuthToken(sessao.token);
    return { operador: montarOperador(sessao, payload), autenticado: true, token: sessao.token, usaPinPadrao: pinTemporarioDoToken(payload) };
  }

  remover(STORAGE_KEY_SESSAO);
  setAuthToken(null);
  return { operador: operadorDeslogado, autenticado: false, token: null, usaPinPadrao: false };
};

/** Valida e grava a sessão devolvida pelo backend (login ou troca de PIN). */
const persistirSessao = (resposta: LoginResposta): { operador: OperadorAuth; token: string } => {
  const payload = decodificarToken(resposta.token);
  if (!tokenValido(payload)) {
    throw new Error('Token de acesso inválido recebido do servidor.');
  }

  const sessao: SessaoSalva = {
    token: resposta.token,
    operador: {
      id: resposta.operador.id,
      matricula: resposta.operador.matricula,
      nome: resposta.operador.nome,
    },
  };

  gravarJson(STORAGE_KEY_SESSAO, sessao);
  setAuthToken(resposta.token);
  return { operador: montarOperador(sessao, payload), token: resposta.token };
};

interface AuthState {
  operador: OperadorAuth;
  autenticado: boolean;
  token: string | null;
  /** Indica que o operador entrou com um PIN padrão de fábrica e deve trocá-lo. */
  usaPinPadrao: boolean;
  login: (matricula: string, pin: string) => Promise<boolean>;
  logout: () => void;
  trocarOperador: (matricula: string, pin: string) => Promise<boolean>;
  validarSupervisor: (pin: string) => Promise<boolean>;
  alterarPin: (pinAtual: string, novoPin: string, confirmacaoNovoPin: string) => Promise<void>;
  atualizarPerfil: (dados: Partial<OperadorAuth>) => void;
  isSupervisor: () => boolean;
}

const estadoInicial = carregarSessao();

export const useAuthStore = create<AuthState>((set, get) => ({
  operador: estadoInicial.operador,
  autenticado: estadoInicial.autenticado,
  token: estadoInicial.token,
  usaPinPadrao: estadoInicial.usaPinPadrao,

  /**
   * Autentica no backend (matrícula + PIN validados com BCrypt no SQLite local).
   * Lança erro com mensagem amigável em caso de falha.
   */
  login: async (matricula, pin) => {
    const resposta = await authApi.login(matricula.trim().toUpperCase(), pin);
    const { operador, token } = persistirSessao(resposta);
    set({ operador, autenticado: true, token, usaPinPadrao: resposta.operador.usaPinPadrao });
    return true;
  },

  logout: () => {
    remover(STORAGE_KEY_SESSAO);
    setAuthToken(null);
    set({ operador: operadorDeslogado, autenticado: false, token: null, usaPinPadrao: false });
  },

  trocarOperador: async (matricula, pin) => {
    try {
      return await get().login(matricula, pin);
    } catch {
      return false;
    }
  },

  validarSupervisor: async pin => {
    try {
      await authApi.autorizarSupervisor(pin);
      return true;
    } catch {
      return false;
    }
  },

  alterarPin: async (pinAtual, novoPin, confirmacaoNovoPin) => {
    // O backend invalida o token anterior e devolve um novo; a sessão deste terminal continua ativa
    const resposta = await authApi.alterarPin(pinAtual, novoPin, confirmacaoNovoPin);
    const { operador, token } = persistirSessao(resposta);
    set({ operador, autenticado: true, token, usaPinPadrao: false });
  },

  atualizarPerfil: dados => {
    // Apenas dados visuais podem ser alterados localmente; matrícula e perfil de acesso vêm do token
    const { nome, email, avatarUrl } = dados;
    const matricula = get().operador.matricula;
    const salvo = lerJson<PerfilVisual>(STORAGE_KEY_PERFIL_VISUAL);
    const visual: PerfilVisual = salvo?.matricula === matricula ? { ...salvo } : { matricula };
    if (nome !== undefined) visual.nome = nome;
    if (email !== undefined) visual.email = email;
    if (avatarUrl !== undefined) visual.avatarUrl = avatarUrl;
    gravarJson(STORAGE_KEY_PERFIL_VISUAL, visual);
    const { matricula: _m, ...camposVisuais } = visual;
    set({ operador: { ...get().operador, ...camposVisuais } });
  },

  isSupervisor: () => get().autenticado && get().operador.role === 'Supervisor',
}));

// Token expirado ou recusado pela API encerra a sessão e volta para a tela de login
setOnUnauthorized(() => {
  if (useAuthStore.getState().autenticado) {
    useAuthStore.getState().logout();
  }
});

// A API recusou algo por PIN temporário: mostra a tela de troca obrigatória (a API continua bloqueando de qualquer forma)
setOnPinTemporario(() => {
  if (useAuthStore.getState().autenticado && !useAuthStore.getState().usaPinPadrao) {
    useAuthStore.setState({ usaPinPadrao: true });
  }
});

// Ao reabrir o aplicativo com uma sessão salva, confirma com o backend se o PIN ainda é temporário
if (estadoInicial.autenticado) {
  authApi
    .me()
    .then(me => {
      if (useAuthStore.getState().autenticado) useAuthStore.setState({ usaPinPadrao: !!me.usaPinPadrao });
    })
    .catch(() => {
      /* 401 já encerra a sessão; falha de rede mantém o estado do token */
    });
}
