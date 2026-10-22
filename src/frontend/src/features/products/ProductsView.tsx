import React, { useState, useEffect } from 'react';
import { Search, Plus, Package, Edit, AlertCircle } from 'lucide-react';
import { Produto } from '../../types';
import { pdvApi } from '../../services/api';

export const ProductsView: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);

  // Modal Novo Produto
  const [isNovoModalOpen, setIsNovoModalOpen] = useState(false);
  const [novoCodigo, setNovoCodigo] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoPrecoVenda, setNovoPrecoVenda] = useState<number>(0);
  const [novoPrecoCusto, setNovoPrecoCusto] = useState<number>(0);
  const [novoEstoque, setNovoEstoque] = useState<number>(10);
  const [novaUnidade, setNovaUnidade] = useState<'UN' | 'KG'>('UN');

  useEffect(() => {
    carregarProdutos();
  }, []);

  const carregarProdutos = async () => {
    setCarregando(true);
    try {
      const lista = await pdvApi.buscarProdutos();
      setProdutos(lista);
    } finally {
      setCarregando(false);
    }
  };

  const handleSalvarNovo = () => {
    if (!novoCodigo || !novoNome || novoPrecoVenda <= 0) {
      alert('Preencha código, descrição e preço de venda válido.');
      return;
    }

    const novoProduto: Produto = {
      id: 'prod-' + Date.now(),
      codigoBarras: novoCodigo.trim(),
      nome: novoNome.trim(),
      precoVenda: novoPrecoVenda,
      precoCusto: novoPrecoCusto,
      estoqueAtual: novoEstoque,
      estoqueMinimo: 5,
      unidadeMedida: novaUnidade,
      ativo: true,
    };

    setProdutos(prev => [novoProduto, ...prev]);
    setIsNovoModalOpen(false);
    setNovoCodigo('');
    setNovoNome('');
    setNovoPrecoVenda(0);
    setNovoPrecoCusto(0);
  };

  const produtosFiltrados = produtos.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.codigoBarras.includes(busca)
  );

  return (
    <div className="flex-1 p-6 overflow-y-auto flex flex-col space-y-5 bg-[#0b1118]">
      {/* Topo do Módulo */}
      <div className="flex items-center justify-between border-b border-[#1f3042] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Catálogo de Produtos & Estoque</h1>
            <p className="text-xs text-slate-400 font-mono">Gerencie preços de venda, custos e estoque do PDV</p>
          </div>
        </div>

        <button
          onClick={() => setIsNovoModalOpen(true)}
          className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-mono text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-sky-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Produto</span>
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="flex items-center gap-4 bg-[#111c26] p-3 rounded-2xl border border-[#1f3042]">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Pesquisar por nome ou código de barras..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#090f16] border border-[#1f3042] rounded-xl text-white font-mono text-xs focus:outline-none focus:border-sky-500"
          />
        </div>
        <span className="text-xs font-mono text-slate-500">
          {produtosFiltrados.length} itens listados
        </span>
      </div>

      {/* Tabela de Produtos */}
      <div className="flex-1 bg-[#111c26] border border-[#1f3042] rounded-2xl overflow-hidden shadow-xl flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className="bg-[#162330] text-slate-400 uppercase sticky top-0 border-b border-[#1f3042]">
              <tr>
                <th className="p-3 w-36">Cód. Barras</th>
                <th className="p-3 font-sans">Descrição</th>
                <th className="p-3 text-center w-16">Un.</th>
                <th className="p-3 text-right w-24">Preço Custo</th>
                <th className="p-3 text-right w-28">Preço Venda</th>
                <th className="p-3 text-center w-28">Estoque Atual</th>
                <th className="p-3 text-center w-20">Status</th>
                <th className="p-3 text-center w-16">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2938]">
              {produtosFiltrados.map(prod => {
                const isBaixo = prod.estoqueAtual <= prod.estoqueMinimo;
                return (
                  <tr key={prod.id} className="hover:bg-[#14212e] text-slate-300">
                    <td className="p-3 text-slate-400 font-bold">{prod.codigoBarras}</td>
                    <td className="p-3 font-sans font-medium text-white">{prod.nome}</td>
                    <td className="p-3 text-center">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px]">
                        {prod.unidadeMedida || 'UN'}
                      </span>
                    </td>
                    <td className="p-3 text-right text-slate-400">R$ {prod.precoCusto.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-emerald-400">R$ {prod.precoVenda.toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded font-bold ${isBaixo ? 'bg-red-950/60 text-red-400 border border-red-800' : 'bg-slate-800 text-slate-300'}`}>
                        {prod.estoqueAtual} {prod.unidadeMedida || 'UN'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-900">
                        Ativo
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button className="p-1 hover:text-sky-400 text-slate-500">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Cadastro de Produto */}
      {isNovoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#111c26] border border-[#1f3042] rounded-2xl shadow-2xl p-6 font-sans space-y-4">
            <h3 className="font-bold text-white text-base">Novo Produto</h3>
            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-400 mb-1">CÓDIGO DE BARRAS:</label>
                <input
                  type="text"
                  value={novoCodigo}
                  onChange={e => setNovoCodigo(e.target.value)}
                  className="w-full p-2.5 bg-[#090f16] border border-[#1f3042] rounded-xl text-white"
                  placeholder="Ex: 7891234567890 ou 15 para balança"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">DESCRIÇÃO DO PRODUTO:</label>
                <input
                  type="text"
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  className="w-full p-2.5 bg-[#090f16] border border-[#1f3042] rounded-xl text-white font-sans"
                  placeholder="Ex: Biscoito Recheado 140g"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">PREÇO DE VENDA (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={novoPrecoVenda}
                    onChange={e => setNovoPrecoVenda(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-[#090f16] border border-[#1f3042] rounded-xl text-white font-bold text-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">PREÇO DE CUSTO (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={novoPrecoCusto}
                    onChange={e => setNovoPrecoCusto(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-[#090f16] border border-[#1f3042] rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">ESTOQUE INICIAL:</label>
                  <input
                    type="number"
                    value={novoEstoque}
                    onChange={e => setNovoEstoque(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-[#090f16] border border-[#1f3042] rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">UNIDADE DE MEDIDA:</label>
                  <select
                    value={novaUnidade}
                    onChange={e => setNovaUnidade(e.target.value as 'UN' | 'KG')}
                    className="w-full p-2.5 bg-[#090f16] border border-[#1f3042] rounded-xl text-white"
                  >
                    <option value="UN">UN (Unidade)</option>
                    <option value="KG">KG (Quilo / Balança)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 font-mono text-xs">
              <button
                onClick={() => setIsNovoModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarNovo}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl"
              >
                Salvar Produto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
