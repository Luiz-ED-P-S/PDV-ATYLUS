import React, { useState, useEffect } from 'react';
import { History, Printer, Search, Ban, RefreshCw, AlertCircle } from 'lucide-react';
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
    <div className="flex-1 p-6 overflow-y-auto flex flex-col space-y-5 bg-[#0b1118]">
      {/* Topo */}
      <div className="flex items-center justify-between border-b border-[#1f3042] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Histórico Geral de Vendas</h1>
            <p className="text-xs text-slate-400 font-mono">Consulte vendas gravadas no banco de dados, reimprima cupons e cancele vendas</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={carregarVendas}
            disabled={carregando}
            className="p-2 bg-[#111c26] hover:bg-[#1a2938] text-slate-300 rounded-xl border border-[#1f3042] transition flex items-center gap-1.5 text-xs font-mono"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin text-sky-400' : ''}`} />
            <span>Atualizar</span>
          </button>

          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value as any)}
            className="px-3 py-1.5 bg-[#111c26] border border-[#1f3042] rounded-xl text-white font-mono text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="todos">Todos os Status</option>
            <option value="Concluida">Apenas Concluídas</option>
            <option value="Cancelada">Apenas Canceladas</option>
          </select>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar ID, cliente ou CPF..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#111c26] border border-[#1f3042] rounded-xl text-white font-mono text-xs focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {erro && (
        <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-red-300 text-xs flex items-center gap-2 font-mono">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span>{erro}</span>
        </div>
      )}

      {/* Tabela de Vendas */}
      <div className="flex-1 bg-[#111c26] border border-[#1f3042] rounded-2xl overflow-hidden shadow-xl flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className="bg-[#162330] text-slate-400 uppercase sticky top-0 border-b border-[#1f3042]">
              <tr>
                <th className="p-3 w-28">Venda ID</th>
                <th className="p-3 w-36">Data / Hora</th>
                <th className="p-3 font-sans">Cliente</th>
                <th className="p-3 w-24 text-center">Qtd. Itens</th>
                <th className="p-3 text-right w-28">Valor Total</th>
                <th className="p-3">Pagamento(s)</th>
                <th className="p-3 text-center w-24">Status</th>
                <th className="p-3 text-center w-36">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2938]">
              {carregando ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 font-mono">
                    Carregando histórico de vendas do banco de dados...
                  </td>
                </tr>
              ) : vendasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 font-mono">
                    Nenhuma venda encontrada no banco de dados.
                  </td>
                </tr>
              ) : (
                vendasFiltradas.map(v => (
                  <tr key={v.id} className="hover:bg-[#14212e] text-slate-300">
                    <td className="p-3 font-bold text-sky-400 truncate max-w-[120px]" title={v.id}>
                      {v.id.substring(0, 8)}...
                    </td>
                    <td className="p-3 text-slate-400">
                      {new Date(v.dataVenda).toLocaleDateString('pt-BR')} {new Date(v.dataVenda).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3 font-sans text-white">
                      {v.clienteNome ? `${v.clienteNome} (${v.clienteDocumento || 'Sem doc'})` : <span className="text-slate-600">Consumidor Final</span>}
                    </td>
                    <td className="p-3 text-center text-slate-400">{v.itens?.length || 0} itens</td>
                    <td className="p-3 text-right font-bold text-emerald-400 text-sm">
                      R$ {v.valorLiquido.toFixed(2)}
                    </td>
                    <td className="p-3 text-[11px] text-slate-400">
                      {v.pagamentos && v.pagamentos.length > 0
                        ? v.pagamentos.map(p => `${p.formaPagamento} (R$ ${p.valor.toFixed(2)})`).join(', ')
                        : '—'}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${v.status === 'Concluida' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900' : 'bg-red-950/60 text-red-400 border-red-900'}`}>
                        {v.status === 'Concluida' ? 'Concluída' : 'Cancelada'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          title="Reimprimir Cupom Térmico"
                          onClick={() => setVendaSelecionadaImprimir(v)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {v.status === 'Concluida' && (
                          <button
                            title="Cancelar Venda (Supervisor)"
                            onClick={() => handleCancelarVenda(v.id)}
                            className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 transition"
                          >
                            <Ban className="w-3.5 h-3.5" />
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
