import React, { useState } from 'react';
import { History, Printer, Search, RotateCcw, CheckCircle2, Ban } from 'lucide-react';
import { Venda } from '../../types';
import { ReceiptPrintModal } from '../pos/components/ReceiptPrintModal';

export const SalesHistoryView: React.FC = () => {
  // Lista inicial com vendas demo
  const [vendas, setVendas] = useState<Venda[]>([
    {
      id: 'VND-001240',
      caixaId: 'cx-01',
      operadorId: 'Luiz Portella',
      clienteNome: 'João Silva',
      clienteDocumento: '123.456.789-00',
      dataVenda: new Date(Date.now() - 35 * 60000).toISOString(),
      valorTotal: 54.80,
      desconto: 5.00,
      valorLiquido: 49.80,
      status: 'Concluida',
      itens: [
        { produtoId: '1', produtoNome: 'Refrigerante Coca-Cola 2L', codigoBarras: '7894900010015', quantidade: 2, precoUnitario: 9.50, subtotal: 19.00 },
        { produtoId: '4', produtoNome: 'Café Torrado Pilão 500g', codigoBarras: '7896004000153', quantidade: 1, precoUnitario: 18.90, subtotal: 18.90 },
        { produtoId: '10', produtoNome: 'Queijo Muçarela Balança', codigoBarras: '10', quantidade: 0.338, precoUnitario: 49.90, subtotal: 16.90 },
      ],
      pagamentos: [
        { formaPagamento: 'Dinheiro', valor: 20.00, troco: 0 },
        { formaPagamento: 'Pix', valor: 29.80, troco: 0 },
      ],
    },
    {
      id: 'VND-001239',
      caixaId: 'cx-01',
      operadorId: 'Luiz Portella',
      dataVenda: new Date(Date.now() - 75 * 60000).toISOString(),
      valorTotal: 25.20,
      desconto: 0,
      valorLiquido: 25.20,
      status: 'Concluida',
      itens: [
        { produtoId: '2', produtoNome: 'Leite Integral Ninho 1L', codigoBarras: '7891000100103', quantidade: 3, precoUnitario: 5.80, subtotal: 17.40 },
        { produtoId: '3', produtoNome: 'Açúcar Refinado União 1kg', codigoBarras: '7891910000197', quantidade: 1, precoUnitario: 4.20, subtotal: 4.20 },
      ],
      pagamentos: [
        { formaPagamento: 'CartaoCredito', valor: 25.20, troco: 0 },
      ],
    },
  ]);

  const [busca, setBusca] = useState('');
  const [vendaSelecionadaImprimir, setVendaSelecionadaImprimir] = useState<Venda | null>(null);

  const handleCancelarVenda = (id: string) => {
    const pin = prompt('Informe o PIN de Supervisor para autorizar o cancelamento:');
    if (pin === '1234') {
      setVendas(prev => prev.map(v => v.id === id ? { ...v, status: 'Cancelada' as const } : v));
      alert('Venda cancelada com sucesso e estoque estornado!');
    } else {
      alert('PIN de supervisor incorreto.');
    }
  };

  const vendasFiltradas = vendas.filter(v =>
    v.id.toLowerCase().includes(busca.toLowerCase()) ||
    (v.clienteNome && v.clienteNome.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div className="flex-1 p-6 overflow-y-auto flex flex-col space-y-5 bg-[#0b1118]">
      {/* Topo */}
      <div className="flex items-center justify-between border-b border-[#1f3042] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Histórico de Vendas do Turno</h1>
            <p className="text-xs text-slate-400 font-mono">Consulte vendas anteriores, reimprima comprovantes e efetue cancelamentos</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por ID ou cliente..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#111c26] border border-[#1f3042] rounded-xl text-white font-mono text-xs focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

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
              {vendasFiltradas.map(v => (
                <tr key={v.id} className="hover:bg-[#14212e] text-slate-300">
                  <td className="p-3 font-bold text-sky-400">{v.id}</td>
                  <td className="p-3 text-slate-400">
                    {new Date(v.dataVenda).toLocaleDateString('pt-BR')} {new Date(v.dataVenda).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-3 font-sans text-white">
                    {v.clienteNome ? `${v.clienteNome} (${v.clienteDocumento || 'Sem doc'})` : <span className="text-slate-600">Não identificado</span>}
                  </td>
                  <td className="p-3 text-center text-slate-400">{v.itens.length} itens</td>
                  <td className="p-3 text-right font-bold text-emerald-400 text-sm">
                    R$ {v.valorLiquido.toFixed(2)}
                  </td>
                  <td className="p-3 text-[11px] text-slate-400">
                    {v.pagamentos.map(p => `${p.formaPagamento} (R$ ${p.valor.toFixed(2)})`).join(', ')}
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
              ))}
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
