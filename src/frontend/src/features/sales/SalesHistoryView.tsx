import React, { useState, useEffect } from 'react';
import {
  Printer,
  Search,
  Ban,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Receipt,
  DollarSign,
  X,
  CreditCard,
  ShoppingBag,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Venda } from '../../types';
import { ReceiptPrintModal } from '../pos/components/ReceiptPrintModal';
import { pdvApi } from '../../services/api';

export const SalesHistoryView: React.FC = () => {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'Concluida' | 'Cancelada'>('todos');
  const [vendaSelecionadaImprimir, setVendaSelecionadaImprimir] = useState<Venda | null>(null);
  const [vendaDetalhe, setVendaDetalhe] = useState<Venda | null>(null);

  const carregarVendas = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await pdvApi.listarTodasVendas();
      setVendas(dados);
    } catch (err: any) {
      setErro('Não foi possível carregar as vendas do servidor.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarVendas();
  }, []);

  const handleCancelarVenda = async (id: string) => {
    const motivo = prompt('Informe o motivo do cancelamento:') || 'Cancelamento solicitado pelo supervisor';
    const pin = prompt('Informe o PIN de Supervisor para autorizar o cancelamento:');
    
    if (!pin) {
      alert('Operação cancelada: PIN não fornecido.');
      return;
    }

    try {
      await pdvApi.cancelarVenda(id, motivo, pin);
      alert('Venda cancelada com sucesso e estoque estornado!');
      await carregarVendas();
      if (vendaDetalhe?.id === id) setVendaDetalhe(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Erro ao cancelar venda.';
      alert(`Falha no cancelamento: ${msg}`);
    }
  };

  const vendasFiltradas = vendas.filter(v => {
    const matchBusca = 
      v.id.toLowerCase().includes(busca.toLowerCase()) ||
      (v.codigoIdentificador && v.codigoIdentificador.toLowerCase().includes(busca.toLowerCase())) ||
      (v.clienteNome && v.clienteNome.toLowerCase().includes(busca.toLowerCase())) ||
      (v.clienteDocumento && v.clienteDocumento.includes(busca));

    const matchStatus = filtroStatus === 'todos' || v.status === filtroStatus;

    return matchBusca && matchStatus;
  });

  // Métricas calculadas para os Cards
  const vendasConcluidas = vendas.filter(v => v.status === 'Concluida');
  const faturamentoTotal = vendasConcluidas.reduce((acc, v) => acc + (v.valorLiquido || 0), 0);
  const totalConcluidasCount = vendasConcluidas.length;
  const ticketMedio = totalConcluidasCount > 0 ? faturamentoTotal / totalConcluidasCount : 0;
  const canceladasCount = vendas.filter(v => v.status === 'Cancelada').length;

  return (
    <div className="flex-1 flex flex-col space-y-5 select-none font-sans">
      {/* Topo Moderno */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Histórico de Vendas</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Gerencie os comprovantes fiscais/não fiscais, emita 2ª via e estorne com supervisor.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={carregarVendas}
            disabled={carregando}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200/90 shadow-xs transition flex items-center gap-2 text-xs font-bold"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${carregando ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {erro && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Cards de Métricas / Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Vendido</span>
            <div className="text-xl font-black font-mono text-slate-900 mt-0.5">
              R$ {faturamentoTotal.toFixed(2)}
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold">{totalConcluidasCount} vendas válidas</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Quantidade Vendas</span>
            <div className="text-xl font-black font-mono text-slate-900 mt-0.5">
              {vendas.length}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Concluídas & Canceladas</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Ticket Médio</span>
            <div className="text-xl font-black font-mono text-slate-900 mt-0.5">
              R$ {ticketMedio.toFixed(2)}
            </div>
            <span className="text-[10px] text-sky-600 font-semibold">Por atendimento</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Canceladas</span>
            <div className="text-xl font-black font-mono text-rose-600 mt-0.5">
              {canceladasCount}
            </div>
            <span className="text-[10px] text-rose-500 font-semibold">Estornadas no caixa</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-xl flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por ID, código, nome do cliente ou documento..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200/90 rounded-xl text-slate-800 text-xs sm:text-sm placeholder-slate-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setFiltroStatus('todos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              filtroStatus === 'todos' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todas ({vendas.length})
          </button>
          <button
            onClick={() => setFiltroStatus('Concluida')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              filtroStatus === 'Concluida' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Concluídas
          </button>
          <button
            onClick={() => setFiltroStatus('Cancelada')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              filtroStatus === 'Cancelada' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Canceladas
          </button>
        </div>
      </div>

      {/* Tabela de Vendas */}
      <div className="flex-1 bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[380px]">
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 backdrop-blur-md text-slate-400 font-bold uppercase text-[11px] tracking-wider sticky top-0 border-b border-slate-100 z-10">
              <tr>
                <th className="py-3.5 px-5 w-32 font-semibold">CÓDIGO / ID</th>
                <th className="py-3.5 px-5 w-36 font-semibold">DATA & HORA</th>
                <th className="py-3.5 px-5 font-semibold">CLIENTE</th>
                <th className="py-3.5 px-5 w-24 text-center font-semibold">ITENS</th>
                <th className="py-3.5 px-5 text-right w-36 font-semibold">TOTAL LÍQUIDO</th>
                <th className="py-3.5 px-5 font-semibold">PAGAMENTO(S)</th>
                <th className="py-3.5 px-5 text-center w-28 font-semibold">STATUS</th>
                <th className="py-3.5 px-5 text-center w-36 font-semibold">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {carregando ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                      <span>Carregando histórico de vendas...</span>
                    </div>
                  </td>
                </tr>
              ) : vendasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 font-medium">
                    Nenhuma venda encontrada com os filtros informados.
                  </td>
                </tr>
              ) : (
                vendasFiltradas.map(v => (
                  <tr
                    key={v.id}
                    onClick={() => setVendaDetalhe(v)}
                    className="hover:bg-indigo-50/40 transition cursor-pointer group"
                  >
                    <td className="py-3.5 px-5 font-mono font-bold text-indigo-600 truncate max-w-[130px]">
                      <span className="group-hover:underline">
                        {v.codigoIdentificador || `${v.id.substring(0, 8)}...`}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 font-medium">
                      {new Date(v.dataVenda).toLocaleDateString('pt-BR')} {new Date(v.dataVenda).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-5 font-bold text-slate-900">
                      {v.clienteNome ? `${v.clienteNome} (${v.clienteDocumento || 'Sem doc'})` : <span className="text-slate-400 font-normal">Consumidor Final</span>}
                    </td>
                    <td className="py-3.5 px-5 text-center text-slate-600 font-medium">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono">
                        {v.itens?.length || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono font-black text-emerald-600 text-sm">
                      R$ {v.valorLiquido.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-5 text-[11px] text-slate-600 font-medium">
                      {v.pagamentos && v.pagamentos.length > 0
                        ? v.pagamentos.map(p => `${p.formaPagamento} (R$ ${p.valor.toFixed(2)})`).join(', ')
                        : '—'}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border inline-flex items-center gap-1 ${
                        v.status === 'Concluida'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                          : 'bg-rose-50 text-rose-700 border-rose-200/80'
                      }`}>
                        {v.status === 'Concluida' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Concluída</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-rose-500" />
                            <span>Cancelada</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          title="Reimprimir Cupom Térmico"
                          onClick={() => setVendaSelecionadaImprimir(v)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 transition shadow-xs"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {v.status === 'Concluida' && (
                          <button
                            title="Cancelar Venda (Supervisor)"
                            onClick={() => handleCancelarVenda(v.id)}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition shadow-xs"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gaveta Lateral de Detalhes da Venda Selecionada */}
      {vendaDetalhe && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setVendaDetalhe(null)}
          />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl z-10 flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900">Detalhes da Venda</h3>
                <span className="font-mono text-xs text-indigo-600 font-bold">
                  {vendaDetalhe.codigoIdentificador || vendaDetalhe.id}
                </span>
              </div>
              <button
                onClick={() => setVendaDetalhe(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <span className={`font-bold ${vendaDetalhe.status === 'Concluida' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {vendaDetalhe.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Data/Hora:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(vendaDetalhe.dataVenda).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Cliente:</span>
                  <span className="font-bold text-slate-800">
                    {vendaDetalhe.clienteNome || 'Consumidor Final'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 uppercase text-[11px] mb-2 tracking-wider flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Itens da Venda ({vendaDetalhe.itens?.length || 0})</span>
                </h4>
                <div className="border border-slate-200/80 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {vendaDetalhe.itens && vendaDetalhe.itens.map((item, idx) => (
                    <div key={idx} className="p-3 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{item.produtoNome}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.quantidade} x R$ {item.precoUnitario.toFixed(2)}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-slate-900">
                        R$ {item.subtotal.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 uppercase text-[11px] mb-2 tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pagamento</span>
                </h4>
                <div className="border border-slate-200/80 rounded-2xl p-3.5 bg-slate-50 space-y-2">
                  {vendaDetalhe.pagamentos && vendaDetalhe.pagamentos.map((pag, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="font-semibold text-slate-700">{pag.formaPagamento}:</span>
                      <span className="font-mono font-bold text-slate-900">R$ {pag.valor.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-700">Total Líquido:</span>
                    <span className="font-mono font-black text-emerald-600">R$ {vendaDetalhe.valorLiquido.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button
                  onClick={() => setVendaSelecionadaImprimir(vendaDetalhe)}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xs transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Cupom</span>
                </button>
                {vendaDetalhe.status === 'Concluida' && (
                  <button
                    onClick={() => handleCancelarVenda(vendaDetalhe.id)}
                    className="px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Ban className="w-4 h-4" />
                    <span>Estornar</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reimpressão de Cupom */}
      <ReceiptPrintModal
        venda={vendaSelecionadaImprimir}
        onClose={() => setVendaSelecionadaImprimir(null)}
      />
    </div>
  );
};
