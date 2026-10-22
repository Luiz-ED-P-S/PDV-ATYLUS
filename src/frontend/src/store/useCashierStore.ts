import { create } from 'zustand';
import { Caixa, MovimentacaoCaixa } from '../types';
import { pdvApi } from '../services/api';

interface CashierState {
  caixa: Caixa | null;
  carregando: boolean;
  carregarCaixa: () => Promise<void>;
  abrirCaixa: (operadorId: string, saldoInicial: number) => Promise<void>;
  registrarMovimentacao: (tipo: 'Suprimento' | 'Sangria', valor: number, motivo: string, operadorId: string) => Promise<MovimentacaoCaixa>;
  fecharCaixaCego: (saldoInformado: number, observacoes?: string) => Promise<any>;
}

export const useCashierStore = create<CashierState>((set, get) => ({
  caixa: null,
  carregando: false,

  carregarCaixa: async () => {
    set({ carregando: true });
    try {
      const caixa = await pdvApi.obterCaixaAtual();
      set({ caixa, carregando: false });
    } catch {
      set({ carregando: false });
    }
  },

  abrirCaixa: async (operadorId, saldoInicial) => {
    set({ carregando: true });
    try {
      const caixa = await pdvApi.abrirCaixa(operadorId, saldoInicial);
      set({ caixa, carregando: false });
    } finally {
      set({ carregando: false });
    }
  },

  registrarMovimentacao: async (tipo, valor, motivo, operadorId) => {
    const caixa = get().caixa;
    if (!caixa) throw new Error('Nenhum caixa aberto');

    const mov = await pdvApi.registrarMovimentacao(caixa.id, tipo, valor, motivo, operadorId);
    set(state => ({
      caixa: state.caixa ? { ...state.caixa, movimentacoes: [...state.caixa.movimentacoes, mov] } : null,
    }));
    return mov;
  },

  fecharCaixaCego: async (saldoInformado, observacoes) => {
    const caixa = get().caixa;
    if (!caixa) throw new Error('Nenhum caixa aberto');

    const resultado = await pdvApi.fecharCaixaCego(caixa.id, saldoInformado, observacoes);
    set(state => ({
      caixa: state.caixa ? { ...state.caixa, status: 'Fechado', saldoFinalInformado: saldoInformado } : null,
    }));
    return resultado;
  },
}));
