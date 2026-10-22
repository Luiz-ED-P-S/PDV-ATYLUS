export type FormaPagamento = 'Dinheiro' | 'Pix' | 'CartaoCredito' | 'CartaoDebito';

export type StatusCaixa = 'Aberto' | 'Fechado';

export interface Produto {
  id: string;
  codigoBarras: string;
  nome: string;
  precoVenda: number;
  precoCusto: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  ativo: boolean;
}

export interface ItemCarrinho {
  id: string;
  produtoId: string;
  nome: string;
  codigoBarras: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface PagamentoItem {
  forma: FormaPagamento;
  valor: number;
  troco?: number;
  txId?: string;
}

export interface MovimentacaoCaixa {
  id: string;
  tipo: 'Suprimento' | 'Sangria';
  valor: number;
  motivo: string;
  operadorId: string;
  dataHora: string;
}

export interface Caixa {
  id: string;
  operadorId: string;
  dataAbertura: string;
  dataFechamento?: string;
  saldoInicial: number;
  saldoFinalInformado?: number;
  status: StatusCaixa;
  observacoesFechamento?: string;
  movimentacoes: MovimentacaoCaixa[];
}

export interface Venda {
  id: string;
  caixaId: string;
  operadorId: string;
  dataVenda: string;
  valorTotal: number;
  desconto: number;
  valorLiquido: number;
  status: 'Concluida' | 'Cancelada';
  itens: {
    produtoId: string;
    produtoNome: string;
    codigoBarras: string;
    quantidade: number;
    precoUnitario: number;
    subtotal: number;
  }[];
  pagamentos: {
    formaPagamento: FormaPagamento;
    valor: number;
    troco: number;
    txId?: string;
  }[];
}

export interface PixGenerateResult {
  txId: string;
  qrCodeBase64: string;
  copiaECola: string;
  valor: number;
  expiraEm: string;
}

export interface MapeamentoColunas {
  colunaCodigoBarras: string | null;
  colunaNome: string | null;
  colunaPrecoVenda: string | null;
  colunaPrecoCusto: string | null;
  colunaEstoque: string | null;
  confianca: number;
  observacoes: string | null;
}
