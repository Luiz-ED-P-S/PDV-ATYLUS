import React, { useState, useEffect } from 'react';
import { Printer, Search, Ban, RefreshCw, AlertCircle } from 'lucide-react';
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
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Erro ao cancelar venda.';
      alert(`Falha no cancelamento: ${msg}`);
    }
  };

  const vendasFiltradas = vendas.filter(v => {
    const matchBusca = 
      v.id.toLowerCase().includes(busca.toLowerCase()) ||
      (v.clienteNome && v.clienteNome.toLowerCase().includes(busca.toLowerCase())) ||
      (v.clienteDocumento && v.clienteDocumento.includes(busca));

    const matchStatus = filtroStatus === 'todos' || v.status === filtroStatus;

    return matchBusca && matchStatus;
  });

  return (
    <div className="flex-1 flex flex-col space-y-5 select-none font-sans">
      {/* Topo Fiel ao Vídeo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Histórico de Vendas</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Consulte todas as operações, emita 2ª via de cupons e realize estornos autorizados.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={carregarVendas}
            disabled={carregando}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-full border border-slate-200/90 shadow-sm transition flex items-center gap-2 text-xs font-bold"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${carregando ? 'animate-spin text-[#005bf8]' : ''}`} />
            <span>Atualizar Vendas</span>
          </button>
        </div>
      </div>

      {erro && (
        <div className="p-3.5 bg-red-50/90 border border-red-200 rounded-2xl text-red-600 text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Barra de Filtro e Busca Arredondada Fiel ao Vídeo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-xl flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por ID, nome do cliente ou documento..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200/90 rounded-full text-slate-800 text-xs sm:text-sm placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#005bf8]/20 focus:border-[#005bf8] transition"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-full border border-slate-200/80">
          <button
            onClick={() => setFiltroStatus('todos')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              filtroStatus === 'todos' ? 'bg-[#005bf8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFiltroStatus('Concluida')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              filtroStatus === 'Concluida' ? 'bg-[#005bf8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Concluídas
          </button>
          <button
            onClick={() => setFiltroStatus('Cancelada')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              filtroStatus === 'Cancelada' ? 'bg-[#005bf8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Canceladas
          </button>
        </div>
      </div>

      {/* Tabela Branca Fiel ao Vídeo */}
      <div className="flex-1 bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/80 text-slate-400 font-bold uppercase text-[11px] tracking-wider sticky top-0 border-b border-slate-100">
              <tr>
                <th className="py-4 px-5 w-32 font-semibold">CÓDIGO / ID</th>
                <th className="py-4 px-5 w-40 font-semibold">DATA & HORA</th>
                <th className="py-4 px-5 font-semibold">CLIENTE</th>
                <th className="py-4 px-5 w-24 text-center font-semibold">QTD. ITENS</th>
                <th className="py-4 px-5 text-right w-36 font-semibold">VALOR TOTAL</th>
                <th className="py-4 px-5 font-semibold">PAGAMENTO(S)</th>
                <th className="py-4 px-5 text-center w-28 font-semibold">STATUS</th>
                <th className="py-4 px-5 text-center w-32 font-semibold">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {carregando ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 font-medium">
                    Carregando histórico de vendas...
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
                  <tr key={v.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-4 px-5 font-mono font-bold text-[#005bf8] truncate max-w-[130px]">
                      {v.codigoIdentificador || `${v.id.substring(0, 8)}...`}
                    </td>
                    <td className="py-4 px-5 text-slate-500 font-medium">
                      {new Date(v.dataVenda).toLocaleDateString('pt-BR')} {new Date(v.dataVenda).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-4 px-5 font-bold text-slate-900">
                      {v.clienteNome ? `${v.clienteNome} (${v.clienteDocumento || 'Sem doc'})` : <span className="text-slate-400 font-normal">Consumidor Final</span>}
                    </td>
                    <td className="py-4 px-5 text-center text-slate-600 font-medium">{v.itens?.length || 0} itens</td>
                    <td className="py-4 px-5 text-right font-mono font-extrabold text-emerald-600 text-sm">
                      R$ {v.valorLiquido.toFixed(2)}
                    </td>
                    <td className="py-4 px-5 text-[11px] text-slate-600 font-medium">
                      {v.pagamentos && v.pagamentos.length > 0
                        ? v.pagamentos.map(p => `${p.formaPagamento} (R$ ${p.valor.toFixed(2)})`).join(', ')
                        : '—'}
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span className={`text-[11px] px-3 py-1 rounded-full font-bold border ${v.status === 'Concluida' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                        {v.status === 'Concluida' ? 'Concluída' : 'Cancelada'}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          title="Reimprimir Cupom Térmico"
                          onClick={() => setVendaSelecionadaImprimir(v)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {v.status === 'Concluida' && (
                          <button
                            title="Cancelar Venda (Supervisor)"
                            onClick={() => handleCancelarVenda(v.id)}
                            className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition"
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

      {/* Modal de Reimpressão de Cupom */}
      <ReceiptPrintModal
        venda={vendaSelecionadaImprimir}
        onClose={() => setVendaSelecionadaImprimir(null)}
      />
    </div>
  );
};
