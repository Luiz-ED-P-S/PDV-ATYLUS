import React, { useState, useEffect } from 'react';
import { Search, Plus, Package, Check, X, RefreshCw, AlertCircle } from 'lucide-react';
import { Produto } from '../../types';
import { pdvApi } from '../../services/api';

export const ProductsView: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Edição Inline
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'precoCusto' | 'precoVenda' | 'estoqueAtual' } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [salvandoInline, setSalvandoInline] = useState(false);

  // Modal Novo Produto
  const [isNovoModalOpen, setIsNovoModalOpen] = useState(false);
  const [salvandoNovo, setSalvandoNovo] = useState(false);
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
    setErro(null);
    try {
      const lista = await pdvApi.buscarProdutos();
      setProdutos(lista);
    } catch {
      setErro('Erro ao carregar produtos do banco de dados.');
    } finally {
      setCarregando(false);
    }
  };

  const handleSalvarNovo = async () => {
    if (!novoCodigo.trim() || !novoNome.trim() || novoPrecoVenda <= 0) {
      alert('Preencha código, descrição e preço de venda válido.');
      return;
    }

    setSalvandoNovo(true);
    try {
      const novoProduto = await pdvApi.criarProduto({
        codigoBarras: novoCodigo.trim(),
        nome: novoNome.trim(),
        precoVenda: novoPrecoVenda,
        precoCusto: novoPrecoCusto,
        estoqueAtual: novoEstoque,
        estoqueMinimo: 5,
      });

      setProdutos(prev => [novoProduto, ...prev]);
      setIsNovoModalOpen(false);
      setNovoCodigo('');
      setNovoNome('');
      setNovoPrecoVenda(0);
      setNovoPrecoCusto(0);
      setNovoEstoque(10);
      alert('Produto cadastrado e persistido com sucesso!');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Falha ao cadastrar produto.';
      alert(`Erro: ${msg}`);
    } finally {
      setSalvandoNovo(false);
    }
  };

  const startInlineEdit = (prod: Produto, field: 'precoCusto' | 'precoVenda' | 'estoqueAtual') => {
    setEditingCell({ id: prod.id, field });
    setEditValue(prod[field].toString());
  };

  const cancelInlineEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveInlineEdit = async (prod: Produto) => {
    if (!editingCell) return;
    const numVal = parseFloat(editValue);
    if (isNaN(numVal) || (editingCell.field === 'precoVenda' && numVal <= 0) || numVal < 0) {
      alert('Valor inválido fornecido.');
      cancelInlineEdit();
      return;
    }

    setSalvandoInline(true);
    try {
      const payload: any = {};
      payload[editingCell.field] = numVal;

      const atualizado = await pdvApi.atualizarProduto(prod.id, payload);
      
      setProdutos(prev => prev.map(p => (p.id === prod.id ? { ...p, ...atualizado } : p)));
      setEditingCell(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Erro ao salvar alteração.';
      alert(`Falha: ${msg}`);
    } finally {
      setSalvandoInline(false);
    }
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
            <p className="text-xs text-slate-400 font-mono">
              Clique nos valores de Custo, Preço ou Estoque para <strong className="text-sky-400">edição inline imediata</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={carregarProdutos}
            disabled={carregando}
            className="p-2.5 bg-[#111c26] hover:bg-[#1a2938] text-slate-300 rounded-xl border border-[#1f3042] transition flex items-center gap-1.5 text-xs font-mono"
            title="Recarregar catálogo"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin text-sky-400' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            onClick={() => setIsNovoModalOpen(true)}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-mono text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-sky-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Produto</span>
          </button>
        </div>
      </div>

      {erro && (
        <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-red-300 text-xs flex items-center gap-2 font-mono">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span>{erro}</span>
        </div>
      )}

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
                <th className="p-3 text-right w-32">Preço Custo (R$)</th>
                <th className="p-3 text-right w-32">Preço Venda (R$)</th>
                <th className="p-3 text-center w-32">Estoque Atual</th>
                <th className="p-3 text-center w-20">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2938]">
              {carregando ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-mono">
                    Carregando catálogo de produtos...
                  </td>
                </tr>
              ) : produtosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-mono">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                produtosFiltrados.map(prod => {
                  const isBaixo = prod.estoqueAtual <= prod.estoqueMinimo;

                  return (
                    <tr key={prod.id} className="hover:bg-[#14212e] text-slate-300 transition">
                      <td className="p-3 text-slate-400 font-bold">{prod.codigoBarras}</td>
                      <td className="p-3 font-sans font-medium text-white">{prod.nome}</td>
                      <td className="p-3 text-center">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px]">
                          {prod.unidadeMedida || 'UN'}
                        </span>
                      </td>

                      {/* Preço Custo com Edição Inline */}
                      <td className="p-3 text-right">
                        {editingCell?.id === prod.id && editingCell?.field === 'precoCusto' ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.01"
                              autoFocus
                              disabled={salvandoInline}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveInlineEdit(prod);
                                if (e.key === 'Escape') cancelInlineEdit();
                              }}
                              className="w-20 px-1.5 py-0.5 bg-[#090f16] border border-sky-500 rounded text-right text-white font-mono text-xs focus:outline-none"
                            />
                            <button onClick={() => saveInlineEdit(prod)} className="text-emerald-400 hover:text-emerald-300">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={cancelInlineEdit} className="text-slate-500 hover:text-slate-300">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => startInlineEdit(prod, 'precoCusto')}
                            title="Clique para editar custo"
                            className="cursor-pointer hover:bg-slate-800/80 px-2 py-1 rounded text-slate-400 hover:text-white transition inline-block border border-transparent hover:border-slate-700"
                          >
                            R$ {prod.precoCusto.toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* Preço Venda com Edição Inline */}
                      <td className="p-3 text-right">
                        {editingCell?.id === prod.id && editingCell?.field === 'precoVenda' ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.01"
                              autoFocus
                              disabled={salvandoInline}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveInlineEdit(prod);
                                if (e.key === 'Escape') cancelInlineEdit();
                              }}
                              className="w-20 px-1.5 py-0.5 bg-[#090f16] border border-emerald-500 rounded text-right font-bold text-emerald-400 font-mono text-xs focus:outline-none"
                            />
                            <button onClick={() => saveInlineEdit(prod)} className="text-emerald-400 hover:text-emerald-300">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={cancelInlineEdit} className="text-slate-500 hover:text-slate-300">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => startInlineEdit(prod, 'precoVenda')}
                            title="Clique para editar preço de venda"
                            className="cursor-pointer hover:bg-emerald-950/30 px-2 py-1 rounded font-bold text-emerald-400 hover:text-emerald-300 transition inline-block border border-transparent hover:border-emerald-800"
                          >
                            R$ {prod.precoVenda.toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* Estoque Atual com Edição Inline */}
                      <td className="p-3 text-center">
                        {editingCell?.id === prod.id && editingCell?.field === 'estoqueAtual' ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              step="1"
                              autoFocus
                              disabled={salvandoInline}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveInlineEdit(prod);
                                if (e.key === 'Escape') cancelInlineEdit();
                              }}
                              className="w-16 px-1.5 py-0.5 bg-[#090f16] border border-sky-500 rounded text-center text-white font-mono text-xs focus:outline-none"
                            />
                            <button onClick={() => saveInlineEdit(prod)} className="text-emerald-400 hover:text-emerald-300">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={cancelInlineEdit} className="text-slate-500 hover:text-slate-300">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => startInlineEdit(prod, 'estoqueAtual')}
                            title="Clique para ajustar estoque"
                            className={`cursor-pointer px-2 py-0.5 rounded font-bold transition inline-block border ${
                              isBaixo
                                ? 'bg-red-950/60 text-red-400 border-red-800 hover:bg-red-900/60'
                                : 'bg-slate-800 text-slate-300 border-transparent hover:border-slate-600'
                            }`}
                          >
                            {prod.estoqueAtual} {prod.unidadeMedida || 'UN'}
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-900">
                          Ativo
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Cadastro de Produto Persistente */}
      {isNovoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#111c26] border border-[#1f3042] rounded-2xl shadow-2xl p-6 font-sans space-y-4">
            <h3 className="font-bold text-white text-base">Novo Produto (Gravado no Banco)</h3>
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
                disabled={salvandoNovo}
                onClick={() => setIsNovoModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
              >
                Cancelar
              </button>
              <button
                disabled={salvandoNovo}
                onClick={handleSalvarNovo}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-1.5"
              >
                {salvandoNovo ? 'Salvando no Banco...' : 'Salvar no Banco de Dados'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
