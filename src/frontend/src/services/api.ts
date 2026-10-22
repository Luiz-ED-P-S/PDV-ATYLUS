import axios from 'axios';
import { Caixa, MovimentacaoCaixa, PixGenerateResult, Produto, Venda } from '../types';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 4000,
});

// Catálogo mock inicial em memória para desenvolvimento offline
const MOCK_PRODUTOS: Produto[] = [
  { id: '1', codigoBarras: '7894900010015', nome: 'Refrigerante Coca-Cola 2L', precoVenda: 9.50, precoCusto: 6.00, estoqueAtual: 50, estoqueMinimo: 10, ativo: true },
  { id: '2', codigoBarras: '7891000100103', nome: 'Leite Integral Ninho 1L', precoVenda: 5.80, precoCusto: 3.90, estoqueAtual: 30, estoqueMinimo: 5, ativo: true },
  { id: '3', codigoBarras: '7891910000197', nome: 'Açúcar Refinado União 1kg', precoVenda: 4.20, precoCusto: 2.70, estoqueAtual: 40, estoqueMinimo: 10, ativo: true },
  { id: '4', codigoBarras: '7896004000153', nome: 'Café Torrado e Moído Pilão 500g', precoVenda: 18.90, precoCusto: 12.50, estoqueAtual: 25, estoqueMinimo: 5, ativo: true },
  { id: '5', codigoBarras: '7891024131238', nome: 'Biscoito Recheado Passatempo 130g', precoVenda: 3.20, precoCusto: 1.80, estoqueAtual: 60, estoqueMinimo: 15, ativo: true },
];

let mockCaixa: Caixa | null = {
  id: 'caixa-local-01',
  operadorId: 'OP01',
  dataAbertura: new Date().toISOString(),
  saldoInicial: 100.00,
  status: 'Aberto',
  movimentacoes: [
    {
      id: 'mov-01',
      tipo: 'Suprimento',
      valor: 100.00,
      motivo: 'Fundo de troco inicial',
      operadorId: 'OP01',
      dataHora: new Date().toISOString(),
    },
  ],
};

const mockPixTransacoes: Record<string, { pago: boolean; valor: number }> = {};

export const pdvApi = {
  async buscarProdutos(termo?: string): Promise<Produto[]> {
    try {
      const res = await api.get<Produto[]>('/produtos', { params: { termo } });
      return res.data;
    } catch {
      if (!termo) return MOCK_PRODUTOS;
      const t = termo.toLowerCase();
      return MOCK_PRODUTOS.filter(p => p.nome.toLowerCase().includes(t) || p.codigoBarras.includes(t));
    }
  },

  async buscarProdutoPorCodigo(codigo: string): Promise<Produto | null> {
    try {
      const res = await api.get<Produto>(`/produtos/codigo/${codigo}`);
      return res.data;
    } catch {
      const produto = MOCK_PRODUTOS.find(p => p.codigoBarras === codigo.trim());
      return produto || null;
    }
  },

  async obterCaixaAtual(): Promise<Caixa | null> {
    try {
      const res = await api.get<Caixa>('/caixa/atual');
      return res.data;
    } catch {
      return mockCaixa;
    }
  },

  async abrirCaixa(operadorId: string, saldoInicial: number): Promise<Caixa> {
    try {
      const res = await api.post<Caixa>('/caixa/abrir', { operadorId, saldoInicial });
      return res.data;
    } catch {
      mockCaixa = {
        id: 'caixa-' + Date.now(),
        operadorId,
        dataAbertura: new Date().toISOString(),
        saldoInicial,
        status: 'Aberto',
        movimentacoes: [
          {
            id: 'mov-' + Date.now(),
            tipo: 'Suprimento',
            valor: saldoInicial,
            motivo: 'Abertura de caixa com fundo de troco',
            operadorId,
            dataHora: new Date().toISOString(),
          },
        ],
      };
      return mockCaixa;
    }
  },

  async registrarMovimentacao(caixaId: string, tipo: 'Suprimento' | 'Sangria', valor: number, motivo: string, operadorId: string): Promise<MovimentacaoCaixa> {
    try {
      const res = await api.post<MovimentacaoCaixa>('/caixa/movimentacao', { caixaId, tipo: tipo === 'Suprimento' ? 1 : 2, valor, motivo, operadorId });
      return res.data;
    } catch {
      const novaMov: MovimentacaoCaixa = {
        id: 'mov-' + Date.now(),
        tipo,
        valor,
        motivo,
        operadorId,
        dataHora: new Date().toISOString(),
      };
      if (mockCaixa) {
        mockCaixa.movimentacoes.push(novaMov);
      }
      return novaMov;
    }
  },

  async fecharCaixaCego(caixaId: string, saldoInformado: number, observacoes?: string) {
    try {
      const res = await api.post('/caixa/fechar-cego', { caixaId, saldoInformado, observacoes });
      return res.data;
    } catch {
      const suprimentos = mockCaixa?.movimentacoes.filter(m => m.tipo === 'Suprimento').reduce((acc, m) => acc + m.valor, 0) || 0;
      const sangrias = mockCaixa?.movimentacoes.filter(m => m.tipo === 'Sangria').reduce((acc, m) => acc + m.valor, 0) || 0;
      const esperado = suprimentos - sangrias;
      const diferenca = saldoInformado - esperado;

      if (mockCaixa) {
        mockCaixa.status = 'Fechado';
        mockCaixa.saldoFinalInformado = saldoInformado;
        mockCaixa.dataFechamento = new Date().toISOString();
        mockCaixa.observacoesFechamento = observacoes;
      }

      return {
        caixaId,
        saldoEsperadoSistema: esperado,
        saldoInformadoOperador: saldoInformado,
        diferenca,
        statusConferencia: diferenca === 0 ? 'Exato' : diferenca > 0 ? `Sobra (+R$ ${diferenca.toFixed(2)})` : `Falta (-R$ ${Math.abs(diferenca).toFixed(2)})`,
      };
    }
  },

  async criarVenda(vendaData: {
    operadorId: string;
    desconto: number;
    itens: { produtoId: string; quantidade: number; precoUnitario: number }[];
    pagamentos: { formaPagamento: number; valor: number; troco: number; txId?: string }[];
  }): Promise<Venda> {
    try {
      const res = await api.post<Venda>('/vendas', vendaData);
      return res.data;
    } catch {
      const total = vendaData.itens.reduce((acc, i) => acc + i.quantidade * i.precoUnitario, 0);
      const novaVenda: Venda = {
        id: 'venda-' + Date.now(),
        caixaId: mockCaixa?.id || 'caixa-mock',
        operadorId: vendaData.operadorId,
        dataVenda: new Date().toISOString(),
        valorTotal: total,
        desconto: vendaData.desconto,
        valorLiquido: total - vendaData.desconto,
        status: 'Concluida',
        itens: vendaData.itens.map(i => {
          const prod = MOCK_PRODUTOS.find(p => p.id === i.produtoId);
          return {
            produtoId: i.produtoId,
            produtoNome: prod?.nome || 'Produto',
            codigoBarras: prod?.codigoBarras || '',
            quantidade: i.quantidade,
            precoUnitario: i.precoUnitario,
            subtotal: i.quantidade * i.precoUnitario,
          };
        }),
        pagamentos: vendaData.pagamentos.map(p => ({
          formaPagamento: p.formaPagamento === 1 ? 'Dinheiro' : p.formaPagamento === 2 ? 'Pix' : p.formaPagamento === 3 ? 'CartaoCredito' : 'CartaoDebito',
          valor: p.valor,
          troco: p.troco,
          txId: p.txId,
        })),
      };
      return novaVenda;
    }
  },

  async gerarPix(valor: number, descricao: string): Promise<PixGenerateResult> {
    try {
      const res = await api.post<PixGenerateResult>('/payments/pix/generate', { valor, descricao });
      return res.data;
    } catch {
      const txId = 'PIX' + Date.now();
      mockPixTransacoes[txId] = { pago: false, valor };

      // SVG simulado embutido em Base64
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='200' height='200'><rect width='200' height='200' fill='white'/><rect x='20' y='20' width='45' height='45' fill='black'/><rect x='25' y='25' width='35' height='35' fill='white'/><rect x='30' y='30' width='25' height='25' fill='black'/><rect x='135' y='20' width='45' height='45' fill='black'/><rect x='140' y='25' width='35' height='35' fill='white'/><rect x='145' y='30' width='25' height='25' fill='black'/><rect x='20' y='135' width='45' height='45' fill='black'/><rect x='25' y='140' width='35' height='35' fill='white'/><rect x='30' y='145' width='25' height='25' fill='black'/><rect x='85' y='85' width='30' height='30' fill='#00bdae'/><text x='100' y='185' font-size='10' text-anchor='middle'>R$ ${valor.toFixed(2)}</text></svg>`;

      return {
        txId,
        qrCodeBase64: `data:image/svg+xml;base64,${btoa(svg)}`,
        copiaECola: `00020126580014br.gov.bcb.pix0136${txId}520400005303986540${valor.toFixed(2)}5802BR5910PDV ATYLUS`,
        valor,
        expiraEm: new Date(Date.now() + 15 * 60000).toISOString(),
      };
    }
  },

  async consultarPix(txid: string): Promise<{ txId: string; pago: boolean; valor: number }> {
    try {
      const res = await api.get(`/payments/pix/status/${txid}`);
      return res.data;
    } catch {
      const reg = mockPixTransacoes[txid];
      return { txId: txid, pago: reg?.pago || false, valor: reg?.valor || 0 };
    }
  },

  async simularPagamentoPix(txid: string): Promise<void> {
    try {
      await api.post(`/payments/pix/simulate-payment/${txid}`);
    } catch {
      if (mockPixTransacoes[txid]) {
        mockPixTransacoes[txid].pago = true;
      }
    }
  },
};
