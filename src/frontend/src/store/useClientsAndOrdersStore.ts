import { create } from 'zustand';
import { Cliente, OrdemServico, StatusOrdemServico } from '../types';

interface ClientsAndOrdersState {
  clientes: Cliente[];
  ordens: OrdemServico[];
  passosConcluidos: string[];
  
  // Clientes
  adicionarCliente: (cliente: Omit<Cliente, 'id' | 'criadoEm'>) => Cliente;
  atualizarCliente: (id: string, dados: Partial<Cliente>) => void;
  removerCliente: (id: string) => void;
  
  // Ordens de Serviço
  adicionarOrdem: (ordem: Omit<OrdemServico, 'id' | 'numero' | 'dataAbertura'>) => OrdemServico;
  atualizarStatusOrdem: (id: string, status: StatusOrdemServico) => void;
  atualizarOrdem: (id: string, dados: Partial<OrdemServico>) => void;
  removerOrdem: (id: string) => void;

  // Onboarding (Primeiros Passos)
  concluirPasso: (passoId: string) => void;
  isPassoConcluido: (passoId: string) => boolean;
}

const STORAGE_KEY_CLIENTES = 'pdv_atylus_clientes_v1';
const STORAGE_KEY_ORDENS = 'pdv_atylus_ordens_v1';
const STORAGE_KEY_PASSOS = 'pdv_atylus_passos_v1';

// DADOS DE EXEMPLO (demonstração): clientes e ordens fictícios, sem pessoas reais. Documentos, telefones e
// e-mails são inválidos de propósito (000..., example.com). Ficam só no navegador do app; não vão ao banco.
const clientesIniciais: Cliente[] = [
  {
    id: 'cli-1',
    nome: 'Cliente Exemplo 1 (demonstração)',
    documento: '000.000.000-01',
    telefone: '(00) 00000-0001',
    email: 'cliente1@example.com',
    endereco: 'Endereço de exemplo, 100',
    limiteCredito: 500,
    saldoDevedor: 0,
    criadoEm: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'cli-2',
    nome: 'Cliente Exemplo 2 (demonstração)',
    documento: '000.000.000-02',
    telefone: '(00) 00000-0002',
    email: 'cliente2@example.com',
    endereco: 'Endereço de exemplo, 200',
    limiteCredito: 1200,
    saldoDevedor: 85.50,
    criadoEm: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'cli-3',
    nome: 'Empresa Exemplo LTDA (demonstração)',
    documento: '00.000.000/0001-03',
    telefone: '(00) 0000-0003',
    email: 'financeiro@example.com',
    endereco: 'Endereço de exemplo, 300',
    limiteCredito: 3000,
    saldoDevedor: 350.00,
    criadoEm: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
];

const ordensIniciais: OrdemServico[] = [
  {
    id: 'os-1',
    numero: 1001,
    clienteNome: 'Cliente Exemplo 2 (demonstração)',
    clienteTelefone: '(00) 00000-0002',
    equipamentoOuVeiculo: 'Notebook Dell Inspiron 15',
    descricaoProblema: 'Troca de SSD para 512GB NVMe e Formatação com Backup de arquivos.',
    status: 'EmAndamento',
    valorMaoDeObra: 150.00,
    valorPecas: 280.00,
    valorTotal: 430.00,
    dataAbertura: new Date(Date.now() - 86400000 * 2).toISOString(),
    dataPrevisao: new Date(Date.now() + 86400000 * 1).toISOString(),
    observacoes: 'Cliente autorizou peças originais com garantia de 1 ano.',
  },
  {
    id: 'os-2',
    numero: 1002,
    clienteNome: 'Cliente Exemplo 1 (demonstração)',
    clienteTelefone: '(00) 00000-0001',
    equipamentoOuVeiculo: 'Impressora Térmica EPSON TM-T20X',
    descricaoProblema: 'Guilhotina travada ao cortar cupom de fechamento.',
    status: 'Concluida',
    valorMaoDeObra: 120.00,
    valorPecas: 45.00,
    valorTotal: 165.00,
    dataAbertura: new Date(Date.now() - 86400000 * 4).toISOString(),
    observacoes: 'Lubrificação do cabeçote e troca da lâmina guilhotina.',
  },
];

const carregarSalvos = <T>(chave: string, padrao: T): T => {
  try {
    const salvo = localStorage.getItem(chave);
    if (salvo) return JSON.parse(salvo);
  } catch {
    // Ignora
  }
  return padrao;
};

export const useClientsAndOrdersStore = create<ClientsAndOrdersState>((set, get) => ({
  clientes: carregarSalvos<Cliente[]>(STORAGE_KEY_CLIENTES, clientesIniciais),
  ordens: carregarSalvos<OrdemServico[]>(STORAGE_KEY_ORDENS, ordensIniciais),
  passosConcluidos: carregarSalvos<string[]>(STORAGE_KEY_PASSOS, []),

  adicionarCliente: (novo) => {
    const cliente: Cliente = {
      ...novo,
      id: 'cli-' + Date.now(),
      criadoEm: new Date().toISOString(),
    };
    const atualizados = [cliente, ...get().clientes];
    set({ clientes: atualizados });
    try {
      localStorage.setItem(STORAGE_KEY_CLIENTES, JSON.stringify(atualizados));
    } catch {}
    return cliente;
  },

  atualizarCliente: (id, dados) => {
    const atualizados = get().clientes.map((c) => (c.id === id ? { ...c, ...dados } : c));
    set({ clientes: atualizados });
    try {
      localStorage.setItem(STORAGE_KEY_CLIENTES, JSON.stringify(atualizados));
    } catch {}
  },

  removerCliente: (id) => {
    const atualizados = get().clientes.filter((c) => c.id !== id);
    set({ clientes: atualizados });
    try {
      localStorage.setItem(STORAGE_KEY_CLIENTES, JSON.stringify(atualizados));
    } catch {}
  },

  adicionarOrdem: (nova) => {
    const ordens = get().ordens;
    const proximoNumero = ordens.length > 0 ? Math.max(...ordens.map((o) => o.numero)) + 1 : 1001;
    const ordem: OrdemServico = {
      ...nova,
      id: 'os-' + Date.now(),
      numero: proximoNumero,
      dataAbertura: new Date().toISOString(),
    };
    const atualizadas = [ordem, ...ordens];
    set({ ordens: atualizadas });
    try {
      localStorage.setItem(STORAGE_KEY_ORDENS, JSON.stringify(atualizadas));
    } catch {}
    return ordem;
  },

  atualizarStatusOrdem: (id, status) => {
    const atualizadas = get().ordens.map((o) => (o.id === id ? { ...o, status } : o));
    set({ ordens: atualizadas });
    try {
      localStorage.setItem(STORAGE_KEY_ORDENS, JSON.stringify(atualizadas));
    } catch {}
  },

  atualizarOrdem: (id, dados) => {
    const atualizadas = get().ordens.map((o) => (o.id === id ? { ...o, ...dados } : o));
    set({ ordens: atualizadas });
    try {
      localStorage.setItem(STORAGE_KEY_ORDENS, JSON.stringify(atualizadas));
    } catch {}
  },

  removerOrdem: (id) => {
    const atualizadas = get().ordens.filter((o) => o.id !== id);
    set({ ordens: atualizadas });
    try {
      localStorage.setItem(STORAGE_KEY_ORDENS, JSON.stringify(atualizadas));
    } catch {}
  },

  concluirPasso: (passoId) => {
    const atuais = get().passosConcluidos;
    if (!atuais.includes(passoId)) {
      const novos = [...atuais, passoId];
      set({ passosConcluidos: novos });
      try {
        localStorage.setItem(STORAGE_KEY_PASSOS, JSON.stringify(novos));
      } catch {}
    }
  },

  isPassoConcluido: (passoId) => {
    return get().passosConcluidos.includes(passoId);
  },
}));
