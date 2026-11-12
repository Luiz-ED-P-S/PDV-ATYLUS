export type FormaPagamento = 'Dinheiro' | 'Pix' | 'CartaoCredito' | 'CartaoDebito';

export type StatusCaixa = 'Aberto' | 'Fechado';

export type TipoUnidade = 'UN' | 'KG' | 'LT' | 'CX';

export interface Produto {
  id: string;
  codigoBarras: string;
  nome: string;
  precoVenda: number;
  precoCusto: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  unidadeMedida?: TipoUnidade;
  ativo: boolean;
}

export interface ItemCarrinho {
  id: string;
  produtoId: string;
  nome: string;
  codigoBarras: string;
  quantidade: number;
  unidadeMedida?: TipoUnidade;
  precoUnitario: number;
  subtotal: number;
}

export interface PagamentoItem {
  id: string;
  forma: FormaPagamento;
  valor: number;
  troco?: number;
  txId?: string;
  /** Pix confirmado manualmente por Supervisor (não é confirmação bancária). */
  confirmacaoManual?: string;
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
  terminalId?: string;
  numeroSequencial?: number;
  codigoIdentificador?: string;
  clienteNome?: string;
  clienteDocumento?: string;
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
    unidadeMedida?: TipoUnidade;
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

export interface AbaAtendimento {
  id: string;
  numero: number;
  titulo: string;
  clienteNome?: string;
  clienteDocumento?: string;
  itens: ItemCarrinho[];
  selectedItemId: string | null;
  desconto: number;
  criadaEm: string;
}

export type StatusCobrancaPix = 'Pendente' | 'Confirmada' | 'Utilizada' | 'Expirada';

/** Cobrança Pix persistida no backend. Só o backend decide quando ela está confirmada. */
export interface CobrancaPix {
  txId: string;
  valor: number;
  status: StatusCobrancaPix;
  provedor: string;
  /** true apenas para QR Code de cobrança bancária real (provedor Pix integrado). */
  cobrancaBancaria: boolean;
  /** true quando gerada pelo simulador (somente desenvolvimento/testes). */
  simulada: boolean;
  expiraEm: string;
  qrCodeBase64?: string | null;
  copiaECola?: string | null;
  instrucoes?: string | null;
  metodoConfirmacao?: 'Simulacao' | 'ManualSupervisor' | 'Provedor' | null;
  confirmadoEm?: string | null;
  supervisorMatricula?: string | null;
  confirmacaoManual: boolean;
}

/** @deprecated mantido por compatibilidade: use CobrancaPix */
export type PixGenerateResult = CobrancaPix;

export interface RecursosSistema {
  pixSimulacaoHabilitada: boolean;
  pixProvedor: string;
  pixCobrancaBancaria: boolean;
  confirmacaoManualPix: boolean;
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

export interface NfeXmlProdutoItem {
  codigoProduto: string;
  codigoBarras: string;
  descricao: string;
  ncm: string;
  unidadeComercial: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  margemSugeridaPercentual: number;
  precoVendaSugerido: number;
}

export interface StatusSincronizacao {
  online: boolean;
  pendentes: number;
  ultimaSincronizacao?: string;
  terminalId: string;
  cloudUrl: string;
  ultimoStatus: string;
  empresaNome?: string;
  empresaCnpj?: string;
  empresaIe?: string;
  empresaEndereco?: string;
}

export interface ResultadoSincronizacao {
  sucesso: boolean;
  sincronizados: number;
  falhas: number;
  mensagem: string;
}


// === Clientes e Ordens de Serviço ===
export type StatusOrdemServico = 'EmAnalise' | 'EmAndamento' | 'AguardandoPecas' | 'Concluida' | 'Entregue' | 'Cancelada';

export interface Cliente {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
  limiteCredito: number;
  saldoDevedor: number;
  observacoes?: string;
  criadoEm: string;
}

export interface OrdemServico {
  id: string;
  numero: number;
  clienteNome: string;
  clienteTelefone?: string;
  equipamentoOuVeiculo: string;
  descricaoProblema: string;
  status: StatusOrdemServico;
  valorMaoDeObra: number;
  valorPecas: number;
  valorTotal: number;
  dataAbertura: string;
  dataPrevisao?: string;
  observacoes?: string;
}
