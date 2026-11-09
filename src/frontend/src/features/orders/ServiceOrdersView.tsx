import React, { useState } from 'react';
import { Wrench, Plus, Search, Printer, X } from 'lucide-react';
import { useClientsAndOrdersStore } from '../../store/useClientsAndOrdersStore';
import { OrdemServico, StatusOrdemServico } from '../../types';

export const ServiceOrdersView: React.FC = () => {
  const { ordens, adicionarOrdem, atualizarStatusOrdem } = useClientsAndOrdersStore();

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const [ordemSelecionadaImprimir, setOrdemSelecionadaImprimir] = useState<OrdemServico | null>(null);

  // Formulário Nova O.S.
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [equipamento, setEquipamento] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valorMaoDeObra, setValorMaoDeObra] = useState<number>(0);
  const [valorPecas, setValorPecas] = useState<number>(0);
  const [observacoes, setObservacoes] = useState('');

  const statusList: { id: StatusOrdemServico; label: string; cor: string }[] = [
    { id: 'EmAnalise', label: 'Em Análise', cor: 'bg-amber-50 text-amber-600 border-amber-200' },
    { id: 'EmAndamento', label: 'Em Andamento', cor: 'bg-blue-50 text-[#005bf8] border-blue-200' },
    { id: 'AguardandoPecas', label: 'Aguardando Peças', cor: 'bg-purple-50 text-purple-600 border-purple-200' },
    { id: 'Concluida', label: 'Concluída', cor: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    { id: 'Entregue', label: 'Entregue', cor: 'bg-slate-100 text-slate-700 border-slate-300' },
  ];

  const handleSalvarNova = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteNome || !equipamento) return;

    adicionarOrdem({
      clienteNome,
      clienteTelefone,
      equipamentoOuVeiculo: equipamento,
      descricaoProblema: descricao,
      status: 'EmAnalise',
      valorMaoDeObra,
      valorPecas,
      valorTotal: valorMaoDeObra + valorPecas,
      observacoes,
    });

    setModalNovaAberto(false);
    setClienteNome('');
    setClienteTelefone('');
    setEquipamento('');
    setDescricao('');
    setValorMaoDeObra(0);
    setValorPecas(0);
    setObservacoes('');
  };

  const ordensFiltradas = ordens.filter((o) => {
    const matchBusca =
      o.clienteNome.toLowerCase().includes(busca.toLowerCase()) ||
      o.equipamentoOuVeiculo.toLowerCase().includes(busca.toLowerCase()) ||
      String(o.numero).includes(busca) ||
      o.descricaoProblema.toLowerCase().includes(busca.toLowerCase());

    const matchStatus = filtroStatus === 'todos' || o.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  return (
    <div className="w-full h-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 select-none font-sans space-y-6">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Ordens de Serviço (O.S.)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gerencie atendimentos de assistência técnica, orçamentos, manutenções e reparos.
          </p>
        </div>

        <button
          onClick={() => setModalNovaAberto(true)}
          className="px-5 py-2.5 bg-[#005bf8] hover:bg-[#0047db] text-white text-xs font-bold rounded-2xl flex items-center gap-2 shadow-sm shadow-blue-500/25 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Ordem de Serviço</span>
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, equipamento, defeito ou nº da O.S..."
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#005bf8]/20 focus:border-[#005bf8] focus:bg-white"
          />
        </div>

        {/* Pílulas de Status */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setFiltroStatus('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filtroStatus === 'todos'
                ? 'bg-[#005bf8] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas
          </button>
          {statusList.map((s) => (
            <button
              key={s.id}
              onClick={() => setFiltroStatus(s.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                filtroStatus === s.id
                  ? 'bg-[#005bf8] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de Ordens de Serviço */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[760px]">
            <thead className="bg-[#f8faff] border-b border-slate-200/80 text-slate-500 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4 w-20">Nº O.S.</th>
                <th className="py-3 px-4">Cliente & Contato</th>
                <th className="py-3 px-4">Equipamento / Aparelho</th>
                <th className="py-3 px-4">Defeito / Serviço</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Valor Total</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ordensFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    Nenhuma Ordem de Serviço encontrada.
                  </td>
                </tr>
              ) : (
                ordensFiltradas.map((ordem) => {
                  const statusInfo = statusList.find((s) => s.id === ordem.status) || statusList[0];
                  return (
                    <tr key={ordem.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-xs text-slate-900">
                        #{ordem.numero}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className="font-bold text-slate-800 block">{ordem.clienteNome}</span>
                        <span className="text-slate-400 text-[11px]">{ordem.clienteTelefone}</span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                        {ordem.equipamentoOuVeiculo}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 max-w-xs truncate">
                        {ordem.descricaoProblema}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <select
                          value={ordem.status}
                          onChange={(e) => atualizarStatusOrdem(ordem.id, e.target.value as StatusOrdemServico)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none ${statusInfo.cor}`}
                        >
                          {statusList.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-[#005bf8] text-sm">
                        R$ {ordem.valorTotal.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setOrdemSelecionadaImprimir(ordem)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                            title="Imprimir Comprovante de O.S."
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Ordem de Serviço */}
      {modalNovaAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#005bf8]" />
                <h3 className="font-bold text-slate-900">Cadastrar Nova Ordem de Serviço</h3>
              </div>
              <button onClick={() => setModalNovaAberto(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarNova} className="py-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nome do Cliente *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mariana Duarte Souza"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#005bf8]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  placeholder="(11) 98765-4321"
                  value={clienteTelefone}
                  onChange={(e) => setClienteTelefone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#005bf8]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Equipamento / Aparelho *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Notebook Dell Inspiron 15"
                  value={equipamento}
                  onChange={(e) => setEquipamento(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#005bf8]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Defeito Reclamado / Serviço a Executar</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Tela sem vídeo, cooler travando..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#005bf8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mão de Obra (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={valorMaoDeObra}
                    onChange={(e) => setValorMaoDeObra(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Peças / Materiais (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={valorPecas}
                    onChange={(e) => setValorPecas(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovaAberto(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#005bf8] hover:bg-[#0047db] text-white font-bold rounded-xl shadow-md shadow-blue-500/20"
                >
                  Salvar O.S.
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Impressão de O.S. */}
      {ordemSelecionadaImprimir && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Comprovante da O.S. #{ordemSelecionadaImprimir.numero}
              </h3>
              <button onClick={() => setOrdemSelecionadaImprimir(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-2 text-xs text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-200 mt-2 font-mono">
              <div className="text-center font-bold text-sm border-b pb-2">ATYLUS PDV & SERVIÇOS</div>
              <div className="flex justify-between">
                <span>Ordem de Serviço:</span>
                <span className="font-bold">#{ordemSelecionadaImprimir.numero}</span>
              </div>
              <div className="flex justify-between">
                <span>Cliente:</span>
                <span>{ordemSelecionadaImprimir.clienteNome}</span>
              </div>
              <div className="flex justify-between">
                <span>Equipamento:</span>
                <span>{ordemSelecionadaImprimir.equipamentoOuVeiculo}</span>
              </div>
              <div>
                <span>Defeito:</span>
                <p className="text-[11px] text-slate-500">{ordemSelecionadaImprimir.descricaoProblema}</p>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-sm text-[#005bf8]">
                <span>Total Estimado:</span>
                <span>R$ {ordemSelecionadaImprimir.valorTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full mt-4 py-2.5 bg-[#005bf8] hover:bg-[#0047db] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Ordem</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
