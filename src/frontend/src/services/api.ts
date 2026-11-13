import axios from 'axios';
import { Caixa, CobrancaPix, MovimentacaoCaixa, Produto, RecursosSistema, ResultadoSincronizacao, StatusSincronizacao, Venda } from '../types';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 5000,
});

// ===== Autenticação (JWT emitido pelo backend local) =====
let tokenAtual: string | null = null;
let aoPerderAutorizacao: (() => void) | null = null;
let aoExigirTrocaPin: (() => void) | null = null;

/** Define o token enviado em todas as requisições (null remove). */
export const setAuthToken = (token: string | null) => {
  tokenAtual = token;
};

/** Cabeçalho Authorization para chamadas feitas com fetch() fora do cliente axios. */
export const authHeaders = (): Record<string, string> =>
  tokenAtual ? { Authorization: `Bearer ${tokenAtual}` } : {};

/** Callback chamado quando a API responde 401 (token ausente, expirado ou inválido). */
export const setOnUnauthorized = (callback: () => void) => {
  aoPerderAutorizacao = callback;
};

/** Callback chamado quando a API recusa a ação porque o operador ainda usa PIN temporário (403 PIN_TEMPORARIO). */
export const setOnPinTemporario = (callback: () => void) => {
  aoExigirTrocaPin = callback;
};

const ROTAS_AUTH_SEM_LOGOUT = ['/auth/login', '/auth/autorizar-supervisor', '/auth/alterar-pin'];

api.interceptors.request.use(config => {
  if (tokenAtual) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${tokenAtual}`;
  }
  return config;
});

api.interceptors.response.use(
  resposta => resposta,
  erro => {
    const status = erro.response?.status;
    const url: string = erro.config?.url ?? '';
    const rotaDeAuth = ROTAS_AUTH_SEM_LOGOUT.some(rota => url.startsWith(rota));

    if (status === 401 && !rotaDeAuth) {
      aoPerderAutorizacao?.();
    } else if (status === 403 && erro.response?.data?.codigo === 'PIN_TEMPORARIO') {
      // A API é a autoridade: o frontend apenas mostra a tela de troca obrigatória
      aoExigirTrocaPin?.();
    } else if (status === 403) {
      const mensagem = 'Ação permitida apenas para Supervisor.';
      erro.message = mensagem;
      if (erro.response) {
        erro.response.data = { ...(erro.response.data || {}), message: mensagem, mensagem };
      }
    }
    return Promise.reject(erro);
  }
);

export interface OperadorLoginResposta {
  id: string;
  nome: string;
  matricula: string;
  perfil: 'Operador' | 'Supervisor';
  usaPinPadrao: boolean;
}

export interface LoginResposta {
  token: string;
  expiraEm: string;
  operador: OperadorLoginResposta;
}

const mensagemDeErro = (err: any, padrao: string): string =>
  err?.response?.data?.mensagem || err?.response?.data?.message || padrao;

export const authApi = {
  async login(matricula: string, pin: string): Promise<LoginResposta> {
    try {
      const res = await api.post<LoginResposta>('/auth/login', { matricula, pin });
      return res.data;
    } catch (err: any) {
      if (!err.response) throw new Error('Servidor do PDV indisponível. Verifique se o sistema está em execução.');
      throw new Error(mensagemDeErro(err, 'Matrícula ou PIN inválidos.'));
    }
  },

  /** Situação da sessão segundo o backend (inclui se o PIN ainda é temporário). */
  async me(): Promise<OperadorLoginResposta> {
    const res = await api.get<OperadorLoginResposta>('/auth/me');
    return res.data;
  },

  async autorizarSupervisor(pin: string): Promise<void> {
    try {
      await api.post('/auth/autorizar-supervisor', { pin });
    } catch (err: any) {
      throw new Error(mensagemDeErro(err, 'PIN de supervisor inválido.'));
    }
  },

  /** Troca o PIN; o backend invalida os tokens anteriores e devolve um novo para esta sessão. */
  async alterarPin(pinAtual: string, novoPin: string, confirmacaoNovoPin: string): Promise<LoginResposta> {
    try {
      const res = await api.post<LoginResposta>('/auth/alterar-pin', { pinAtual, novoPin, confirmacaoNovoPin });
      return res.data;
    } catch (err: any) {
      throw new Error(mensagemDeErro(err, 'Não foi possível alterar o PIN.'));
    }
  },
};

export const pdvApi = {
  async buscarProdutos(termo?: string): Promise<Produto[]> {
    const res = await api.get<Produto[]>('/produtos', { params: { termo } });
    return res.data;
  },

  async buscarProdutoPorCodigo(codigo: string): Promise<Produto | null> {
    try {
      const res = await api.get<Produto>(`/produtos/codigo/${codigo}`);
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) return null;
      throw err;
    }
  },

  async criarProduto(produtoData: {
    codigoBarras: string;
    nome: string;
    precoVenda: number;
    precoCusto: number;
    estoqueAtual: number;
    estoqueMinimo: number;
  }): Promise<Produto> {
    const res = await api.post<Produto>('/produtos', produtoData);
    return res.data;
  },

  async atualizarProduto(id: string, produtoData: {
    nome?: string;
    precoVenda?: number;
    precoCusto?: number;
    estoqueAtual?: number;
    estoqueMinimo?: number;
  }): Promise<Produto> {
    const res = await api.put<Produto>(`/produtos/${id}`, produtoData);
    return res.data;
  },

  async listarTodasVendas(): Promise<Venda[]> {
    const res = await api.get<Venda[]>('/vendas');
    return res.data;
  },

  async cancelarVenda(vendaId: string, motivo: string, supervisorPin: string): Promise<void> {
    await api.post(`/vendas/${vendaId}/cancelar`, { motivo, supervisorPin });
  },

  async obterCaixaAtual(): Promise<Caixa | null> {
    try {
      const res = await api.get<any>('/caixa/atual');
      if (!res.data) return null;
      const c = res.data;
      return {
        ...c,
        status: (c.status === 1 || c.status === 'Aberto') ? 'Aberto' : 'Fechado',
        movimentacoes: (c.movimentacoes || []).map((m: any) => ({
          ...m,
          tipo: (m.tipo === 1 || m.tipo === 'Suprimento') ? 'Suprimento' : 'Sangria',
        })),
      };
    } catch (err: any) {
      if (err.response?.status === 404) return null;
      throw err;
    }
  },

  async abrirCaixa(operadorId: string, saldoInicial: number): Promise<Caixa> {
    const res = await api.post<any>('/caixa/abrir', { operadorId, saldoInicial });
    const c = res.data;
    return {
      ...c,
      status: (c.status === 1 || c.status === 'Aberto') ? 'Aberto' : 'Fechado',
      movimentacoes: (c.movimentacoes || []).map((m: any) => ({
        ...m,
        tipo: (m.tipo === 1 || m.tipo === 'Suprimento') ? 'Suprimento' : 'Sangria',
      })),
    };
  },

  async registrarMovimentacao(caixaId: string, tipo: 'Suprimento' | 'Sangria', valor: number, motivo: string, operadorId: string): Promise<MovimentacaoCaixa> {
    const res = await api.post<MovimentacaoCaixa>('/caixa/movimentacao', {
      caixaId,
      tipo: tipo === 'Suprimento' ? 1 : 2,
      valor,
      motivo,
      operadorId,
    });
    return res.data;
  },

  async fecharCaixaCego(caixaId: string, saldoInformado: number, observacoes?: string) {
    const res = await api.post('/caixa/fechar-cego', { caixaId, saldoInformado, observacoes });
    return res.data;
  },

  async criarVenda(vendaData: {
    operadorId: string;
    desconto: number;
    clienteNome?: string;
    clienteDocumento?: string;
    terminalId?: string;
    itens: { produtoId: string; quantidade: number; precoUnitario: number }[];
    pagamentos: { formaPagamento: number; valor: number; troco: number; txId?: string }[];
  }): Promise<Venda> {
    const res = await api.post<Venda>('/vendas', vendaData);
    return res.data;
  },

  // Sincronização em Nuvem & Multi-Terminal (Offline-First)
  async obterStatusSync(): Promise<StatusSincronizacao> {
    const res = await api.get<StatusSincronizacao>('/sync/status');
    return res.data;
  },

  async forcarSincronizacao(): Promise<ResultadoSincronizacao> {
    const res = await api.post<ResultadoSincronizacao>('/sync/forcar');
    return res.data;
  },

  async puxarCatalogoNuvem(): Promise<ResultadoSincronizacao> {
    const res = await api.post<ResultadoSincronizacao>('/sync/puxar-catalogo');
    return res.data;
  },

  async testarConexaoNuvem(): Promise<{ online: boolean }> {
    const res = await api.post<{ online: boolean }>('/sync/testar-conexao');
    return res.data;
  },

  async atualizarConfigSync(config: {
    cloudUrl?: string;
    terminalId?: string;
    apiKey?: string;
    empresaNome?: string;
    empresaCnpj?: string;
    empresaIe?: string;
    empresaEndereco?: string;
  }): Promise<void> {
    await api.post('/sync/config', config);
  },

  /** Recursos habilitados no servidor (ex.: simulação de Pix). Somente leitura. */
  async obterRecursos(): Promise<RecursosSistema> {
    const res = await api.get<RecursosSistema>('/sistema/recursos');
    return res.data;
  },

  /** Gera uma cobrança Pix persistida no backend. */
  async gerarPix(valor: number, descricao: string): Promise<CobrancaPix> {
    const res = await api.post<CobrancaPix>('/payments/pix/generate', { valor, descricao });
    return res.data;
  },

  async consultarPix(txid: string): Promise<CobrancaPix> {
    const res = await api.get<CobrancaPix>(`/payments/pix/status/${txid}`);
    return res.data;
  },

  /** Somente quando o servidor habilitar a simulação (desenvolvimento/testes). */
  async simularPagamentoPix(txid: string): Promise<CobrancaPix> {
    const res = await api.post<CobrancaPix>(`/payments/pix/simulate-payment/${txid}`);
    return res.data;
  },

  /** Confirmação manual do recebimento por Supervisor (validada no backend; não é confirmação bancária). */
  async confirmarPixManual(txid: string, supervisorMatricula: string, supervisorPin: string, observacao?: string): Promise<CobrancaPix> {
    try {
      const res = await api.post<CobrancaPix>(`/payments/pix/${txid}/confirmar-manual`, { supervisorMatricula, supervisorPin, observacao });
      return res.data;
    } catch (err: any) {
      throw new Error(err?.response?.data?.mensagem || err?.response?.data?.message || 'Não foi possível confirmar o Pix.');
    }
  },

  // Periféricos: Impressão Térmica ESC/POS & Gaveta
  async obterImpressorasInstaladas(): Promise<string[]> {
    try {
      const res = await api.get<string[]>('/printer/installed');
      return res.data;
    } catch {
      return ['Simulador ESC/POS (Virtual)'];
    }
  },

  async testarImpressora(config: {
    tipoConexao?: number;
    nomeOuEndereco: string;
    largura: number;
    cortarPapel: boolean;
    acionarGaveta: boolean;
    vias: number;
  }): Promise<{ sucesso: boolean; mensagem: string; bytesEnviados: number }> {
    const res = await api.post('/printer/test', config);
    return res.data;
  },

  async acionarGaveta(config?: { nomeOuEndereco?: string }): Promise<{ sucesso: boolean; mensagem: string }> {
    const res = await api.post('/printer/open-drawer', config || {});
    return res.data;
  },

  async imprimirVenda(vendaId: string, abrirGaveta = false, config?: any): Promise<{ sucesso: boolean; mensagem: string }> {
    const res = await api.post(`/printer/print-sale/${vendaId}?abrirGaveta=${abrirGaveta}`, config || {});
    return res.data;
  },

  async imprimirFechamentoCaixa(caixaId: string, config?: any): Promise<{ sucesso: boolean; mensagem: string }> {
    const res = await api.post(`/printer/print-cashier/${caixaId}`, config || {});
    return res.data;
  },
};
