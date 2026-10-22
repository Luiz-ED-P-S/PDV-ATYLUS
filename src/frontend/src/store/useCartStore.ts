import { create } from 'zustand';
import { AbaAtendimento, ItemCarrinho, Produto, TipoUnidade } from '../types';
import { sound } from '../services/sound';

interface CartState {
  abas: AbaAtendimento[];
  abaAtivaId: string;

  // Gerenciamento de Abas
  criarNovaAba: (titulo?: string) => string;
  fecharAba: (id: string) => void;
  alternarAba: (id: string) => void;
  alternarPorIndice: (indice: number) => void;
  setClienteAba: (nome?: string, documento?: string) => void;

  // Manipulação de Itens na Aba Ativa
  adicionarProduto: (produto: Produto, quantidade?: number, unidade?: TipoUnidade) => void;
  removerItem: (id: string) => void;
  removerItemSelecionado: () => void;
  incrementarQuantidade: (id: string, delta: number) => void;
  selecionarItem: (id: string | null) => void;
  setDesconto: (desconto: number) => void;
  limparCarrinhoAbaAtual: () => void;

  // Getters para a Aba Ativa
  getAbaAtiva: () => AbaAtendimento;
  getItens: () => ItemCarrinho[];
  getSelectedItemId: () => string | null;
  getDesconto: () => number;
  getTotalBruto: () => number;
  getTotalLiquido: () => number;
  getTotalItens: () => number;
}

const STORAGE_KEY = 'pdv_atylus_abas_v1';

const criarAbaInicial = (numero = 1, titulo = 'Venda 1'): AbaAtendimento => ({
  id: 'aba-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
  numero,
  titulo,
  itens: [],
  selectedItemId: null,
  desconto: 0,
  criadaEm: new Date().toISOString(),
});

const carregarAbasIniciais = (): { abas: AbaAtendimento[]; abaAtivaId: string } => {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo) {
      const parsed = JSON.parse(salvo);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { abas: parsed, abaAtivaId: parsed[0].id };
      }
    }
  } catch {
    // Ignora erro de parse
  }
  const inicial = criarAbaInicial(1, 'Venda 1');
  return { abas: [inicial], abaAtivaId: inicial.id };
};

const persistir = (abas: AbaAtendimento[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(abas));
  } catch {
    // LocalStorage indisponível ou cheio
  }
};

const estadoInicial = carregarAbasIniciais();

export const useCartStore = create<CartState>((set, get) => ({
  abas: estadoInicial.abas,
  abaAtivaId: estadoInicial.abaAtivaId,

  criarNovaAba: (titulo) => {
    const { abas } = get();
    const proximoNumero = abas.length > 0 ? Math.max(...abas.map(a => a.numero)) + 1 : 1;
    const novaAba = criarAbaInicial(proximoNumero, titulo || `Venda ${proximoNumero}`);
    const novasAbas = [...abas, novaAba];

    set({ abas: novasAbas, abaAtivaId: novaAba.id });
    persistir(novasAbas);
    sound.playScanBeep();
    return novaAba.id;
  },

  fecharAba: (id) => {
    const { abas, abaAtivaId } = get();
    if (abas.length <= 1) {
      // Se só tem uma aba, limpa ao invés de fechar
      get().limparCarrinhoAbaAtual();
      return;
    }

    const novasAbas = abas.filter(a => a.id !== id);
    const novoAtivoId = abaAtivaId === id ? novasAbas[0].id : abaAtivaId;

    set({ abas: novasAbas, abaAtivaId: novoAtivoId });
    persistir(novasAbas);
  },

  alternarAba: (id) => {
    set({ abaAtivaId: id });
  },

  alternarPorIndice: (indice) => {
    const { abas } = get();
    if (abas[indice]) {
      set({ abaAtivaId: abas[indice].id });
      sound.playScanBeep();
    }
  },

  setClienteAba: (nome, documento) => {
    set(state => {
      const novasAbas = state.abas.map(a =>
        a.id === state.abaAtivaId ? { ...a, clienteNome: nome, clienteDocumento: documento } : a
      );
      persistir(novasAbas);
      return { abas: novasAbas };
    });
  },

  adicionarProduto: (produto, quantidade = 1, unidade) => {
    sound.playScanBeep();
    set(state => {
      const aba = state.abas.find(a => a.id === state.abaAtivaId);
      if (!aba) return state;

      const unMedida = unidade || produto.unidadeMedida || 'UN';
      const itemExistente = aba.itens.find(i => i.produtoId === produto.id && i.unidadeMedida === unMedida);

      let novosItens: ItemCarrinho[];
      let selectedId: string;

      if (itemExistente) {
        const novaQtd = itemExistente.quantidade + quantidade;
        novosItens = aba.itens.map(i =>
          i.id === itemExistente.id
            ? { ...i, quantidade: novaQtd, subtotal: novaQtd * i.precoUnitario }
            : i
        );
        selectedId = itemExistente.id;
      } else {
        const novoItem: ItemCarrinho = {
          id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          produtoId: produto.id,
          nome: produto.nome,
          codigoBarras: produto.codigoBarras,
          quantidade,
          unidadeMedida: unMedida,
          precoUnitario: produto.precoVenda,
          subtotal: quantidade * produto.precoVenda,
        };
        novosItens = [...aba.itens, novoItem];
        selectedId = novoItem.id;
      }

      const novasAbas = state.abas.map(a =>
        a.id === state.abaAtivaId ? { ...a, itens: novosItens, selectedItemId: selectedId } : a
      );

      persistir(novasAbas);
      return { abas: novasAbas };
    });
  },

  removerItem: (id) => {
    set(state => {
      const aba = state.abas.find(a => a.id === state.abaAtivaId);
      if (!aba) return state;

      const itensFiltrados = aba.itens.filter(i => i.id !== id);
      const novoSelected = itensFiltrados.length > 0 ? itensFiltrados[itensFiltrados.length - 1].id : null;

      const novasAbas = state.abas.map(a =>
        a.id === state.abaAtivaId ? { ...a, itens: itensFiltrados, selectedItemId: novoSelected } : a
      );

      persistir(novasAbas);
      return { abas: novasAbas };
    });
  },

  removerItemSelecionado: () => {
    const aba = get().getAbaAtiva();
    if (aba && aba.selectedItemId) {
      get().removerItem(aba.selectedItemId);
    }
  },

  incrementarQuantidade: (id, delta) => {
    set(state => {
      const aba = state.abas.find(a => a.id === state.abaAtivaId);
      if (!aba) return state;

      const novosItens = aba.itens.map(item => {
        if (item.id === id) {
          const passo = item.unidadeMedida === 'KG' ? 0.1 : 1;
          const deltaAjustado = delta > 0 ? passo : -passo;
          const novaQtd = Math.max(passo, parseFloat((item.quantidade + deltaAjustado).toFixed(3)));
          return { ...item, quantidade: novaQtd, subtotal: novaQtd * item.precoUnitario };
        }
        return item;
      });

      const novasAbas = state.abas.map(a =>
        a.id === state.abaAtivaId ? { ...a, itens: novosItens } : a
      );

      persistir(novasAbas);
      return { abas: novasAbas };
    });
  },

  selecionarItem: (id) => {
    set(state => ({
      abas: state.abas.map(a => a.id === state.abaAtivaId ? { ...a, selectedItemId: id } : a),
    }));
  },

  setDesconto: (desconto) => {
    set(state => {
      const novasAbas = state.abas.map(a =>
        a.id === state.abaAtivaId ? { ...a, desconto: Math.max(0, desconto) } : a
      );
      persistir(novasAbas);
      return { abas: novasAbas };
    });
  },

  limparCarrinhoAbaAtual: () => {
    set(state => {
      const novasAbas = state.abas.map(a =>
        a.id === state.abaAtivaId ? { ...a, itens: [], selectedItemId: null, desconto: 0, clienteNome: undefined, clienteDocumento: undefined } : a
      );
      persistir(novasAbas);
      return { abas: novasAbas };
    });
  },

  getAbaAtiva: () => {
    const { abas, abaAtivaId } = get();
    return abas.find(a => a.id === abaAtivaId) || abas[0] || criarAbaInicial();
  },

  getItens: () => {
    return get().getAbaAtiva().itens;
  },

  getSelectedItemId: () => {
    return get().getAbaAtiva().selectedItemId;
  },

  getDesconto: () => {
    return get().getAbaAtiva().desconto;
  },

  getTotalBruto: () => {
    return get().getItens().reduce((acc, item) => acc + item.subtotal, 0);
  },

  getTotalLiquido: () => {
    const bruto = get().getTotalBruto();
    return Math.max(0, bruto - get().getDesconto());
  },

  getTotalItens: () => {
    return get().getItens().reduce((acc, item) => acc + item.quantidade, 0);
  },
}));
