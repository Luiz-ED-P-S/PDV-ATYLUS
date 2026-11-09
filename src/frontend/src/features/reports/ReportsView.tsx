import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Download,
  Printer,
  CreditCard,
  QrCode,
  Coins,
} from 'lucide-react';
import { pdvApi } from '../../services/api';
import { Venda } from '../../types';

export const ReportsView: React.FC = () => {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [periodo, setPeriodo] = useState<'hoje' | '7dias' | 'mes' | 'todos'>('todos');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const lista = await pdvApi.listarTodasVendas();
      setVendas(lista.filter((v) => v.status === 'Concluida'));
    } catch {}
  };

  // Filtragem por Período
  const agora = new Date();
  const hojeStr = agora.toISOString().split('T')[0];
  const seteDiasAtras = new Date(Date.now() - 7 * 86400000);
  const primeiroDiaMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

  const vendasFiltradas = vendas.filter((v) => {
    const dataVenda = new Date(v.dataVenda);
    if (periodo === 'hoje') return v.dataVenda.startsWith(hojeStr);
    if (periodo === '7dias') return dataVenda >= seteDiasAtras;
    if (periodo === 'mes') return dataVenda >= primeiroDiaMes;
    return true;
  });

  // Métricas
  const totalFaturamento = vendasFiltradas.reduce((acc, v) => acc + v.valorLiquido, 0);
  const totalVendas = vendasFiltradas.length;
  const ticketMedio = totalVendas > 0 ? totalFaturamento / totalVendas : 0;
  const lucroEstimado = totalFaturamento * 0.42; // Média de margem estimada de 42%

  // Totais por Forma de Pagamento
  let din = 0;
  let pix = 0;
  let cart = 0;

  vendasFiltradas.forEach((v) => {
    v.pagamentos?.forEach((p) => {
      const forma = String(p.formaPagamento);
      if (forma === '1' || forma === 'Dinheiro') din += p.valor - (p.troco || 0);
      else if (forma === '2' || forma === 'Pix') pix += p.valor;
      else cart += p.valor;
    });
  });

  const totalFormas = (din + pix + cart) || 1;
  const percDin = Math.round((din / totalFormas) * 100);
  const percPix = Math.round((pix / totalFormas) * 100);
  const percCart = Math.round((cart / totalFormas) * 100);

  // Ranking de Produtos Mais Vendidos
  const produtosVendidosMap: { [nome: string]: { quantidade: number; total: number } } = {};
  vendasFiltradas.forEach((v) => {
    v.itens?.forEach((i) => {
      if (!produtosVendidosMap[i.produtoNome]) {
        produtosVendidosMap[i.produtoNome] = { quantidade: 0, total: 0 };
      }
      produtosVendidosMap[i.produtoNome].quantidade += i.quantidade || 1;
      produtosVendidosMap[i.produtoNome].total += i.subtotal || 0;
    });
  });

  const topProdutos = Object.entries(produtosVendidosMap)
    .map(([nome, dados]) => ({ nome, ...dados }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);

  const handleExportarCsv = () => {
    let csv = 'ID;Data;Cliente;ValorTotal;FormaPagamento\n';
    vendasFiltradas.forEach((v) => {
      const formasStr = v.pagamentos?.map((p) => p.formaPagamento).join('+') || 'N/A';
      csv += `${v.id};${v.dataVenda};${v.clienteNome || 'Consumidor Final'};${v.valorLiquido.toFixed(2)};${formasStr}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-vendas-atylus-${hojeStr}.csv`;
    link.click();
  };

  return (
    <div className="w-full h-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 select-none font-sans space-y-6">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Relatórios Gerenciais
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Indicadores de faturamento, curvas de vendas, meios de pagamento e produtos mais vendidos.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportarCsv}
            className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-[#005bf8] hover:bg-[#0047db] text-white text-xs font-bold rounded-2xl flex items-center gap-2 shadow-sm shadow-blue-500/25 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Relatório</span>
          </button>
        </div>
      </div>

      {/* Seletor de Período */}
      <div className="bg-white rounded-3xl p-3 border border-slate-200/80 shadow-sm flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 hidden sm:inline">
          Período:
        </span>
        {[
          { id: 'hoje', label: 'Hoje' },
          { id: '7dias', label: 'Últimos 7 Dias' },
          { id: 'mes', label: 'Este Mês' },
          { id: 'todos', label: 'Todo o Período' },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriodo(p.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              periodo === p.id
                ? 'bg-[#005bf8] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 4 Cards de Indicadores Financeiros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Faturamento */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#eaf1ff] text-[#005bf8] flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-bold block">Faturamento Bruto</span>
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 block">
                R$ {totalFaturamento.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Vendas */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#eaf1ff] text-[#005bf8] flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-bold block">Vendas Concluídas</span>
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 block">
                {totalVendas}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Ticket Médio */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#eaf1ff] text-[#005bf8] flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-bold block">Ticket Médio</span>
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 block">
                R$ {ticketMedio.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Margem Estimada */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-bold block">Lucro Bruto Estimado</span>
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 block">
                R$ {lucroEstimado.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Distribuição por Meio de Pagamento e Ranking de Produtos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Distribuição por Meio de Pagamento */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Distribuição por Meio de Pagamento
          </h2>

          <div className="space-y-4">
            {/* Dinheiro */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-500" /> Dinheiro ({percDin}%)
                </span>
                <span className="font-bold text-slate-900">R$ {din.toFixed(2)}</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${percDin}%` }} />
              </div>
            </div>

            {/* Pix */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-[#005bf8]" /> Pix Instantâneo ({percPix}%)
                </span>
                <span className="font-bold text-slate-900">R$ {pix.toFixed(2)}</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#005bf8] rounded-full" style={{ width: `${percPix}%` }} />
              </div>
            </div>

            {/* Cartões */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-indigo-500" /> Cartões Débito / Crédito ({percCart}%)
                </span>
                <span className="font-bold text-slate-900">R$ {cart.toFixed(2)}</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percCart}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Ranking dos Produtos Mais Vendidos */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Top 5 Produtos Mais Vendidos
          </h2>

          {topProdutos.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Nenhum item comercializado no período selecionado.
            </div>
          ) : (
            <div className="space-y-3">
              {topProdutos.map((prod, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{prod.nome}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#005bf8] block">
                      {prod.quantidade} un. vendidas
                    </span>
                    <span className="text-[10px] text-slate-400">
                      R$ {prod.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
