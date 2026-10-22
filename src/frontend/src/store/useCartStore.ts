import { create } from 'zustand';
import { ItemCarrinho, Produto } from '../types';
import { sound } from '../services/sound';

interface CartState {
  itens: ItemCarrinho[];
  selectedItemId: string | null;
  desconto: number;

  adicionarProduto: (produto: Produto, quantidade?: number) => void;
  removerItem: (id: string) => void;
  removerItemSelecionado: () => void;
  incrementarQuantidade: (id: string, delta: number) => void;
  selecionarItem: (id: string | null) => void;
  setDesconto: (desconto: number) => void;
  limparCarrinho: () => void;

  getTotalBruto: () => number;
  getTotalLiquido: () => number;
  getTotalItens: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  itens: [],
  selectedItemId: null,
  desconto: 0,

  adicionarProduto: (produto, quantidade = 1) => {
    sound.playScanBeep();
    set(state => {
      const itemExistente = state.itens.find(i => i.produtoId === produto.id);

      if (itemExistente) {
        const novaQtd = itemExistente.quantidade + quantidade;
        const itensAtualizados = state.itens.map(i =>
          i.produtoId === produto.id
            ? { ...i, quantidade: novaQtd, subtotal: novaQtd * i.precoUnitario }
            : i
        );
        return { itens: itensAtualizados, selectedItemId: itemExistente.id };
      }

      const novoItem: ItemCarrinho = {
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        produtoId: produto.id,
        nome: produto.nome,
        codigoBarras: produto.codigoBarras,
        quantidade,
        precoUnitario: produto.precoVenda,
        subtotal: quantidade * produto.precoVenda,
      };

      return {
        itens: [...state.itens, novoItem],
        selectedItemId: novoItem.id,
      };
    });
  },

  removerItem: id => {
    set(state => {
      const itensFiltrados = state.itens.filter(i => i.id !== id);
      const novoSelecionado = itensFiltrados.length > 0 ? itensFiltrados[itensFiltrados.length - 1].id : null;
      return { itens: itensFiltrados, selectedItemId: novoSelecionado };
    });
  },

  removerItemSelecionado: () => {
    const { selectedItemId, removerItem } = get();
    if (selectedItemId) {
      removerItem(selectedItemId);
    }
  },

  incrementarQuantidade: (id, delta) => {
    set(state => {
      const itens = state.itens
        .map(item => {
          if (item.id === id) {
            const novaQtd = Math.max(1, item.quantidade + delta);
            return { ...item, quantidade: novaQtd, subtotal: novaQtd * item.precoUnitario };
          }
          return item;
        });
      return { itens };
    });
  },

  selecionarItem: id => set({ selectedItemId: id }),

  setDesconto: desconto => set({ desconto: Math.max(0, desconto) }),

  limparCarrinho: () => set({ itens: [], selectedItemId: null, desconto: 0 }),

  getTotalBruto: () => {
    return get().itens.reduce((acc, item) => acc + item.subtotal, 0);
  },

  getTotalLiquido: () => {
    const bruto = get().getTotalBruto();
    return Math.max(0, bruto - get().desconto);
  },

  getTotalItens: () => {
    return get().itens.reduce((acc, item) => acc + item.quantidade, 0);
  },
}));
