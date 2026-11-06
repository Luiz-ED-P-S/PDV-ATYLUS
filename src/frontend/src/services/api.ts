import axios from 'axios';
import { Caixa, LoginResponse, MovimentacaoCaixa, OperadorListItem, PixGenerateResult, Produto, ResultadoSincronizacao, StatusSincronizacao, Venda } from '../types';

const TOKEN_KEY = 'atylus_pdv_token';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 5000,
});

// Interceptor: injeta o token JWT em todas as requisições autenticadas
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: se receber 401, limpa o token e redireciona para login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Não limpa token para rotas de login/operadores (públicas)
      const url = error.config?.url || '';
      if (!url.includes('/auth/login') && !url.includes('/auth/operadores')) {
        localStorage.removeItem(TOKEN_KEY);
        window.dispatchEvent(new CustomEvent('atylus:session-expired'));
      }
    }
    return Promise.reject(error);
  }
);

export const pdvApi = {
  // === Autenticação com E-mail, BCrypt e OTP ===
  async registrarUsuario(nome: string, email: string, senha: string): Promise<{ sucesso: boolean; mensagem: string; usuario?: any }> {
    const res = await axios.post('/api/auth/register', { nome, email, senha });
    return res.data;
  },

  async verificarCodigoOtp(email: string, codigo: string): Promise<{ sucesso: boolean; mensagem: string }> {
    const res = await axios.post('/api/auth/verify', { email, codigo });
    return res.data;
  },

  async loginUsuario(email: string, senha: string): Promise<{ sucesso: boolean; mensagem: string; token?: string; usuario?: any }> {
    const res = await axios.post('/api/auth/login', { email, senha });
    if (res.data.token) {
      localStorage.setItem(TOKEN_KEY, res.data.token);
    }
    return res.data;
  },

  // === Autenticação por Matrícula/PIN (Operador) ===
  async login(matricula: string, pin: string): Promise<LoginResponse> {
    const res = await api.post<LoginResponse>('/auth/login', { matricula, pin });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    return res.data;
  },

  async validarSupervisor(pin: string, matricula?: string): Promise<{ valido: boolean; supervisorNome?: string }> {
    try {
      const res = await api.post('/auth/validar-supervisor', { pin, matricula });
      return res.data;
    } catch {
      return { valido: false };
    }
  },

  async obterOperadorLogado(): Promise<{ id: string; matricula: string; nome: string; perfil: string } | null> {
    try {
      const res = await api.get('/auth/me');
      return res.data;
    } catch {
      return null;
    }
  },

  async listarOperadores(): Promise<OperadorListItem[]> {
    try {
      const res = await api.get<OperadorListItem[]>('/auth/operadores');
      return res.data;
    } catch {
      return [];
    }
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
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
      const res = await api.get<Caixa>('/caixa/atual');
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) return null;
      throw err;
    }
  },

  async abrirCaixa(operadorId: string, saldoInicial: number): Promise<Caixa> {
    const res = await api.post<Caixa>('/caixa/abrir', { operadorId, saldoInicial });
    return res.data;
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

  async gerarPix(valor: number, descricao: string): Promise<PixGenerateResult> {
    const res = await api.post<PixGenerateResult>('/payments/pix/generate', { valor, descricao });
    return res.data;
  },

  async consultarPix(txid: string): Promise<{ txId: string; pago: boolean; valor: number }> {
    const res = await api.get(`/payments/pix/status/${txid}`);
    return res.data;
  },

  async simularPagamentoPix(txid: string): Promise<void> {
    await api.post(`/payments/pix/simulate-payment/${txid}`);
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
