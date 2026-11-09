import React, { useState } from 'react';
import { Users, Plus, Search, ShoppingCart, Edit3, Trash2, X } from 'lucide-react';
import { useClientsAndOrdersStore } from '../../store/useClientsAndOrdersStore';
import { useCartStore } from '../../store/useCartStore';
import { Cliente } from '../../types';

interface CustomersViewProps {
  onIniciarVendaCliente?: () => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ onIniciarVendaCliente }) => {
  const { clientes, adicionarCliente, atualizarCliente, removerCliente } = useClientsAndOrdersStore();
  const { setClienteAba, criarNovaAba } = useCartStore();

  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteEdicao, setClienteEdicao] = useState<Cliente | null>(null);

  // Form states
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');
  const [limiteCredito, setLimiteCredito] = useState<number>(1000);

  const abrirModalNovo = () => {
    setClienteEdicao(null);
    setNome('');
    setDocumento('');
    setTelefone('');
    setEmail('');
    setEndereco('');
    setLimiteCredito(1000);
    setModalAberto(true);
  };

  const abrirModalEditar = (c: Cliente) => {
    setClienteEdicao(c);
    setNome(c.nome);
    setDocumento(c.documento);
    setTelefone(c.telefone);
    setEmail(c.email);
    setEndereco(c.endereco);
    setLimiteCredito(c.limiteCredito);
    setModalAberto(true);
  };

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    if (clienteEdicao) {
      atualizarCliente(clienteEdicao.id, {
        nome,
        documento,
        telefone,
        email,
        endereco,
        limiteCredito,
      });
    } else {
      adicionarCliente({
        nome,
        documento,
        telefone,
        email,
        endereco,
        limiteCredito,
        saldoDevedor: 0,
      });
    }

    setModalAberto(false);
  };

  const handleIniciarVenda = (c: Cliente) => {
    criarNovaAba(`Venda - ${c.nome.split(' ')[0]}`);
    setClienteAba(c.nome, c.documento);
    if (onIniciarVendaCliente) onIniciarVendaCliente();
  };

  const clientesFiltrados = clientes.filter(
    (c) =>
      c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      c.documento.includes(busca) ||
      c.telefone.includes(busca)
  );

  return (
    <div className="w-full h-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 select-none font-sans space-y-6">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Base de Clientes
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Cadastro de clientes para emissão fiscal, limite de crediário/fiado e histórico de compras.
          </p>
        </div>

        <button
          onClick={abrirModalNovo}
          className="px-5 py-2.5 bg-[#005bf8] hover:bg-[#0047db] text-white text-xs font-bold rounded-2xl flex items-center gap-2 shadow-sm shadow-blue-500/25 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Cliente</span>
        </button>
      </div>

      {/* Busca */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex items-center">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente por nome, CPF/CNPJ ou telefone..."
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#005bf8]/20 focus:border-[#005bf8] focus:bg-white"
          />
        </div>
      </div>

      {/* Tabela de Clientes */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[700px]">
            <thead className="bg-[#f8faff] border-b border-slate-200/80 text-slate-500 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Nome do Cliente</th>
                <th className="py-3 px-4">CPF / CNPJ</th>
                <th className="py-3 px-4">Contato (Telefone/E-mail)</th>
                <th className="py-3 px-4">Endereço</th>
                <th className="py-3 px-4 text-right">Limite de Crédito</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                    Nenhum cliente localizado.
                  </td>
                </tr>
              ) : (
                clientesFiltrados.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-800 text-xs">
                      {c.nome}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-500">
                      {c.documento || 'Não informado'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <div>{c.telefone || '-'}</div>
                      <div className="text-[10px] text-slate-400">{c.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 max-w-xs truncate">
                      {c.endereco || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#005bf8] text-xs">
                      R$ {c.limiteCredito.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleIniciarVenda(c)}
                          className="px-2.5 py-1 bg-[#005bf8] hover:bg-[#0047db] text-white text-[11px] font-bold rounded-xl flex items-center gap-1 shadow-sm"
                          title="Iniciar Venda no PDV"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Vender</span>
                        </button>
                        <button
                          onClick={() => abrirModalEditar(c)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                          title="Editar Cliente"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Deseja excluir o cliente ${c.nome}?`)) {
                              removerCliente(c.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                          title="Excluir Cliente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Adicionar / Editar Cliente */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#005bf8]" />
                <h3 className="font-bold text-slate-900">
                  {clienteEdicao ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
                </h3>
              </div>
              <button onClick={() => setModalAberto(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="py-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nome Completo / Razão Social *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Silva Sauro"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#005bf8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">CPF ou CNPJ</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#005bf8]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="(11) 98765-4321"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#005bf8]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">E-mail</label>
                <input
                  type="email"
                  placeholder="cliente@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#005bf8]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Endereço Completo</label>
                <input
                  type="text"
                  placeholder="Rua, número, bairro, cidade/UF"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#005bf8]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Limite de Crédito Fiado (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={limiteCredito}
                  onChange={(e) => setLimiteCredito(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#005bf8]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#005bf8] hover:bg-[#0047db] text-white font-bold rounded-xl shadow-md shadow-blue-500/20"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
