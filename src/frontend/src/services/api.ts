import axios from 'axios';
import { Caixa, MovimentacaoCaixa, PixGenerateResult, Produto, Venda } from '../types';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 5000,
});

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
    itens: { produtoId: string; quantidade: number; precoUnitario: number }[];
    pagamentos: { formaPagamento: number; valor: number; troco: number; txId?: string }[];
  }): Promise<Venda> {
    const res = await api.post<Venda>('/vendas', vendaData);
    return res.data;
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
