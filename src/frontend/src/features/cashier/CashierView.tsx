import React, { useState, useEffect } from 'react';
import {
  Coins,
  Lock,
  Unlock,
  ArrowDownRight,
  ArrowUpRight,
  Printer,
  DollarSign,
  TrendingUp,
  CreditCard,
  QrCode,
} from 'lucide-react';
import { useCashierStore } from '../../store/useCashierStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CashierModal } from './CashierModal';
import { pdvApi } from '../../services/api';
import { Venda } from '../../types';

export const CashierView: React.FC = () => {
  const { caixa, carregarCaixa } = useCashierStore();
  const operador = useAuthStore((state) => state.operador);

  const [modalAberto, setModalAberto] = useState(false);
  const [vendasTurno, setVendasTurno] = useState<Venda[]>([]);
  const [imprimindo, setImprimindo] = useState(false);

  useEffect(() => {
    carregarCaixa();
    carregarVendasTurno();
  }, [carregarCaixa]);

  const carregarVendasTurno = async () => {
    try {
      const lista = await pdvApi.listarTodasVendas();
      setVendasTurno(lista.filter((v) => v.status === 'Concluida'));
    } catch {}
  };

  const isAberto = caixa && caixa.status === 'Aberto';

  // Cálculos do Caixa
  const saldoInicial = caixa?.saldoInicial || 0;
  const suprimentos = (caixa?.movimentacoes || [])
    .filter((m) => m.tipo === 'Suprimento')
    .reduce((acc, m) => acc + m.valor, 0);
  const sangrias = (caixa?.movimentacoes || [])
    .filter((m) => m.tipo === 'Sangria')
    .reduce((acc, m) => acc + m.valor, 0);

  // Vendas por forma
  let totalVendasDinheiro = 0;
  let totalVendasPix = 0;
  let totalVendasCartao = 0;

  vendasTurno.forEach((v) => {
    v.pagamentos?.forEach((p) => {
      const forma = String(p.formaPagamento);
      if (forma === '1' || forma === 'Dinheiro') totalVendasDinheiro += p.valor - (p.troco || 0);
      else if (forma === '2' || forma === 'Pix') totalVendasPix += p.valor;
      else totalVendasCartao += p.valor;
    });
  });

  const saldoDinheiroGaveta = saldoInicial + suprimentos - sangrias + totalVendasDinheiro;

  const handleImprimirFechamento = async () => {
    if (!caixa) return;
    setImprimindo(true);
    try {
      await pdvApi.imprimirFechamentoCaixa(caixa.id);
      alert('Relatório de turno enviado para a impressora térmica.');
    } catch {
      window.print();
    } finally {
      setImprimindo(false);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 select-none font-sans space-y-6">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Controle de Caixa
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gestão de fundo de troco, suprimentos, sangrias e conciliação do turno de venda.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAberto && (
            <button
              onClick={handleImprimirFechamento}
              disabled={imprimindo}
              className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl flex items-center gap-2 shadow-sm transition"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>{imprimindo ? 'Imprimindo...' : 'Imprimir Turno'}</span>
            </button>
          )}

          <button
            onClick={() => setModalAberto(true)}
            className="px-5 py-2.5 bg-[#005bf8] hover:bg-[#0047db] text-white text-xs font-bold rounded-2xl flex items-center gap-2 shadow-sm shadow-blue-500/25 transition cursor-pointer"
          >
            {isAberto ? <Coins className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span>{isAberto ? 'Operações de Caixa (F3)' : 'Abrir Caixa'}</span>
          </button>
        </div>
      </div>

      {/* Card Principal de Status e Gaveta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Status Atual */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
              isAberto ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}
          >
            {isAberto ? <Unlock className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Status do Caixa</span>
            <span className={`text-xl font-extrabold ${isAberto ? 'text-emerald-600' : 'text-red-500'}`}>
              {isAberto ? 'CAIXA ABERTO' : 'CAIXA FECHADO'}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Operador: {operador.nome}
            </span>
          </div>
        </div>

        {/* Saldo Dinheiro em Gaveta */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#eaf1ff] text-[#005bf8] flex items-center justify-center shrink-0">
            <Coins className="w-7 h-7" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Dinheiro em Gaveta</span>
            <span className="text-2xl font-extrabold text-slate-900 block">
              R$ {saldoDinheiroGaveta.toFixed(2)}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Fundo + Vendas em Dinheiro - Sangrias
            </span>
          </div>
        </div>

        {/* Total Faturado no Turno */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-7 h-7" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Total Geral Vendido</span>
            <span className="text-2xl font-extrabold text-[#005bf8] block">
              R$ {(totalVendasDinheiro + totalVendasPix + totalVendasCartao).toFixed(2)}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              {vendasTurno.length} vendas concluídas
            </span>
          </div>
        </div>
      </div>

      {/* Balanço por Formas de Pagamento e Movimentações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Quadro de Formas de Pagamento */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Detalhamento por Formas de Pagamento
          </h2>

          <div className="space-y-3">
            <div className="p-3.5 bg-slate-50 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">Dinheiro Físico</span>
              </div>
              <span className="text-sm font-extrabold text-slate-900">
                R$ {totalVendasDinheiro.toFixed(2)}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <QrCode className="w-5 h-5 text-[#005bf8]" />
                <span className="text-xs font-bold text-slate-800">Pix Instantâneo</span>
              </div>
              <span className="text-sm font-extrabold text-slate-900">
                R$ {totalVendasPix.toFixed(2)}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800">Cartões Débito / Crédito</span>
              </div>
              <span className="text-sm font-extrabold text-slate-900">
                R$ {totalVendasCartao.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Quadro de Sangrias e Suprimentos */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Movimentações Registradas
            </h2>
            <button
              onClick={() => setModalAberto(true)}
              className="text-xs font-bold text-[#005bf8] hover:underline"
            >
              + Nova Movimentação
            </button>
          </div>

          {!caixa?.movimentacoes || caixa.movimentacoes.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Nenhuma sangria ou suprimento efetuado neste turno.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {caixa.movimentacoes.map((m) => (
                <div key={m.id} className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    {m.tipo === 'Suprimento' ? (
                      <ArrowDownRight className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-amber-500" />
                    )}
                    <div>
                      <span className="font-bold text-slate-800">{m.tipo}</span>
                      <span className="text-slate-400 block text-[11px]">{m.motivo}</span>
                    </div>
                  </div>
                  <span className="font-extrabold text-slate-900">
                    R$ {m.valor.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Operações de Caixa */}
      <CashierModal isOpen={modalAberto} onClose={() => setModalAberto(false)} />
    </div>
  );
};
