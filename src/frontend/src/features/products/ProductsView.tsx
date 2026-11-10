import React, { useState, useEffect } from 'react';
import { Search, Plus, Check, X, RefreshCw, AlertCircle, Download } from 'lucide-react';
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
  const [novoPrecoVenda, setNovoPrecoVenda] = useState<string>('');
  const [novoPrecoCusto, setNovoPrecoCusto] = useState<string>('');
  const [novoEstoque, setNovoEstoque] = useState<string>('10');
  const [novaUnidade, setNovaUnidade] = useState<'UN' | 'KG'>('UN');
  const [baixandoNuvem, setBaixandoNuvem] = useState(false);

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

  const handlePuxarNuvem = async () => {
    setBaixandoNuvem(true);
    setErro(null);
    try {
      const res = await pdvApi.puxarCatalogoNuvem();
      alert(res.mensagem);
      await carregarProdutos();
    } catch (err: any) {
      setErro(`Falha ao sincronizar com nuvem: ${err.message || 'Erro de rede'}`);
    } finally {
      setBaixandoNuvem(false);
    }
  };

  const handleSalvarNovo = async () => {
    const precoVendaNum = parseFloat(novoPrecoVenda.replace(',', '.')) || 0;
    const precoCustoNum = parseFloat(novoPrecoCusto.replace(',', '.')) || 0;
    const estoqueNum = parseFloat(novoEstoque.replace(',', '.')) || 0;

    if (!novoCodigo.trim() || !novoNome.trim() || precoVendaNum <= 0) {
      alert('Preencha código, descrição e preço de venda válido (maior que zero).');
      return;
    }

    if (precoCustoNum > precoVendaNum) {
      alert(`Bloqueio de preço de custo elevado: O preço de custo (R$ ${precoCustoNum.toFixed(2)}) não pode ser superior ao preço de venda (R$ ${precoVendaNum.toFixed(2)})! Operação bloqueada.`);
      return;
    }

    setSalvandoNovo(true);
    try {
      const novoProduto = await pdvApi.criarProduto({
        codigoBarras: novoCodigo.trim(),
        nome: novoNome.trim(),
        precoVenda: precoVendaNum,
        precoCusto: precoCustoNum,
        estoqueAtual: estoqueNum,
        estoqueMinimo: 5,
      });

      setProdutos(prev => [novoProduto, ...prev]);
      setIsNovoModalOpen(false);
      setNovoCodigo('');
      setNovoNome('');
      setNovoPrecoVenda('');
      setNovoPrecoCusto('');
      setNovoEstoque('10');
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

    if (editingCell.field === 'precoCusto' && numVal > prod.precoVenda) {
      alert(`Bloqueio de preço de custo elevado: O preço de custo (R$ ${numVal.toFixed(2)}) não pode ser superior ao preço de venda (R$ ${prod.precoVenda.toFixed(2)})! Operação bloqueada.`);
      cancelInlineEdit();
      return;
    }

    if (editingCell.field === 'precoVenda' && numVal < prod.precoCusto) {
      alert(`Bloqueio de preço de custo elevado: O preço de venda (R$ ${numVal.toFixed(2)}) não pode ser inferior ao preço de custo (R$ ${prod.precoCusto.toFixed(2)})! Operação bloqueada.`);
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
    <div className="flex-1 flex flex-col space-y-5 select-none font-sans">
      {/* Topo do Módulo Fiel ao Vídeo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Catálogo de Produtos & Estoque</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Gestão de preços, código de barras, estoque mínimo e sincronização com catálogo central.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePuxarNuvem}
            disabled={baixandoNuvem}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-full border border-slate-200/90 shadow-sm transition flex items-center gap-2 text-xs font-bold"
            title="Puxar produtos e preços atualizados da nuvem"
          >
            <Download className={`w-4 h-4 text-[#005bf8] ${baixandoNuvem ? 'animate-bounce' : ''}`} />
            <span>{baixandoNuvem ? 'Baixando...' : 'Puxar da Nuvem'}</span>
          </button>

          <button
            onClick={carregarProdutos}
            disabled={carregando}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-full border border-slate-200/90 shadow-sm transition flex items-center gap-2 text-xs font-bold"
            title="Recarregar catálogo"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${carregando ? 'animate-spin text-[#005bf8]' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            onClick={() => setIsNovoModalOpen(true)}
            className="px-5 py-2.5 bg-[#005bf8] hover:bg-[#004ce5] text-white text-xs font-bold rounded-full flex items-center gap-2 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Novo Produto</span>
          </button>
        </div>
      </div>

      {erro && (
        <div className="p-3.5 bg-red-50/90 border border-red-200 rounded-2xl text-red-600 text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Barra de Pesquisa Arredondada Fiel ao Vídeo */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-xl flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por nome ou código de barras..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200/90 rounded-full text-slate-800 text-xs sm:text-sm placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#005bf8]/20 focus:border-[#005bf8] transition"
          />
        </div>
        <span className="text-xs font-bold text-slate-500 pr-2">
          {produtosFiltrados.length} itens listados
        </span>
      </div>

      {/* Tabela Branca com Cantos Arredondados Fiel ao Vídeo */}
      <div className="flex-1 bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/80 text-slate-400 font-bold uppercase text-[11px] tracking-wider sticky top-0 border-b border-slate-100">
              <tr>
                <th className="py-4 px-5 w-40 font-semibold">CÓD. BARRAS</th>
                <th className="py-4 px-5 font-semibold">DESCRIÇÃO DO PRODUTO</th>
                <th className="py-4 px-5 text-center w-20 font-semibold">UN.</th>
                <th className="py-4 px-5 text-right w-36 font-semibold">PREÇO CUSTO</th>
                <th className="py-4 px-5 text-right w-36 font-semibold">PREÇO VENDA</th>
                <th className="py-4 px-5 text-center w-36 font-semibold">ESTOQUE ATUAL</th>
                <th className="py-4 px-5 text-center w-28 font-semibold">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {carregando ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 font-medium">
                    Carregando catálogo de produtos...
                  </td>
                </tr>
              ) : produtosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 font-medium">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                produtosFiltrados.map(prod => {
                  const isBaixo = prod.estoqueAtual <= prod.estoqueMinimo;

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-5 font-mono text-slate-600 font-semibold">{prod.codigoBarras}</td>
                      <td className="py-4 px-5 font-bold text-slate-900">{prod.nome}</td>
                      <td className="py-4 px-5 text-center">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-[10px]">
                          {prod.unidadeMedida || 'UN'}
                        </span>
                      </td>

                      {/* Preço Custo com Edição Inline */}
                      <td className="py-4 px-5 text-right font-mono">
                        {editingCell?.id === prod.id && editingCell?.field === 'precoCusto' ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.01"
                              autoFocus
                              onFocus={e => e.target.select()}
                              disabled={salvandoInline}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveInlineEdit(prod);
                                if (e.key === 'Escape') cancelInlineEdit();
                              }}
                              className="w-20 px-2 py-0.5 bg-white border border-[#005bf8] rounded-lg text-right text-slate-900 font-bold text-xs focus:outline-none"
                            />
                            <button onClick={() => saveInlineEdit(prod)} className="text-emerald-600 hover:text-emerald-500">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={cancelInlineEdit} className="text-slate-400 hover:text-slate-600">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => startInlineEdit(prod, 'precoCusto')}
                            title="Clique para editar custo"
                            className="cursor-pointer hover:bg-slate-100 px-2 py-1 rounded-lg text-slate-500 hover:text-slate-900 transition inline-block border border-transparent hover:border-slate-200"
                          >
                            R$ {prod.precoCusto.toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* Preço Venda com Edição Inline */}
                      <td className="py-4 px-5 text-right font-mono">
                        {editingCell?.id === prod.id && editingCell?.field === 'precoVenda' ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.01"
                              autoFocus
                              onFocus={e => e.target.select()}
                              disabled={salvandoInline}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveInlineEdit(prod);
                                if (e.key === 'Escape') cancelInlineEdit();
                              }}
                              className="w-20 px-2 py-0.5 bg-white border border-emerald-500 rounded-lg text-right font-bold text-emerald-600 text-xs focus:outline-none"
                            />
                            <button onClick={() => saveInlineEdit(prod)} className="text-emerald-600 hover:text-emerald-500">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={cancelInlineEdit} className="text-slate-400 hover:text-slate-600">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => startInlineEdit(prod, 'precoVenda')}
                            title="Clique para editar preço de venda"
                            className="cursor-pointer hover:bg-emerald-50 px-2 py-1 rounded-lg font-bold text-emerald-600 hover:text-emerald-700 transition inline-block border border-transparent hover:border-emerald-200"
                          >
                            R$ {prod.precoVenda.toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* Estoque Atual com Edição Inline */}
                      <td className="py-4 px-5 text-center font-mono">
                        {editingCell?.id === prod.id && editingCell?.field === 'estoqueAtual' ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              step="1"
                              autoFocus
                              onFocus={e => e.target.select()}
                              disabled={salvandoInline}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveInlineEdit(prod);
                                if (e.key === 'Escape') cancelInlineEdit();
                              }}
                              className="w-16 px-2 py-0.5 bg-white border border-[#005bf8] rounded-lg text-center text-slate-900 font-bold text-xs focus:outline-none"
                            />
                            <button onClick={() => saveInlineEdit(prod)} className="text-emerald-600 hover:text-emerald-500">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={cancelInlineEdit} className="text-slate-400 hover:text-slate-600">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => startInlineEdit(prod, 'estoqueAtual')}
                            title="Clique para ajustar estoque"
                            className={`cursor-pointer px-2.5 py-1 rounded-lg font-bold text-xs transition inline-block border ${
                              isBaixo
                                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                : 'bg-slate-100 text-slate-700 border-slate-200/80 hover:bg-slate-200'
                            }`}
                          >
                            {prod.estoqueAtual} {prod.unidadeMedida || 'UN'}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-center">
                        <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200/90 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Novo Produto</h3>
                <p className="text-xs text-slate-500 font-medium">Gravado de forma persistente no banco de dados SQLite</p>
              </div>
              <button
                onClick={() => setIsNovoModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-600 mb-1.5 uppercase font-bold text-[11px]">Código de Barras:</label>
                <input
                  type="text"
                  value={novoCodigo}
                  onChange={e => setNovoCodigo(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-[#005bf8] transition"
                  placeholder="Ex: 7891234567890 ou 15 para balança"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1.5 uppercase font-bold text-[11px]">Descrição do Produto:</label>
                <input
                  type="text"
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:border-[#005bf8] transition"
                  placeholder="Ex: Biscoito Recheado 140g"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 mb-1.5 uppercase font-bold text-[11px]">Preço de Venda (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={novoPrecoVenda}
                    onFocus={e => e.target.select()}
                    onChange={e => setNovoPrecoVenda(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-emerald-600 font-mono font-black text-sm focus:bg-white focus:outline-none focus:border-[#005bf8] transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1.5 uppercase font-bold text-[11px]">Preço de Custo (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={novoPrecoCusto}
                    onFocus={e => e.target.select()}
                    onChange={e => setNovoPrecoCusto(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-[#005bf8] transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 mb-1.5 uppercase font-bold text-[11px]">Estoque Inicial:</label>
                  <input
                    type="number"
                    step="1"
                    placeholder="0"
                    value={novoEstoque}
                    onFocus={e => e.target.select()}
                    onChange={e => setNovoEstoque(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-[#005bf8] transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1.5 uppercase font-bold text-[11px]">Unidade de Medida:</label>
                  <select
                    value={novaUnidade}
                    onChange={e => setNovaUnidade(e.target.value as 'UN' | 'KG')}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-[#005bf8] transition"
                  >
                    <option value="UN">UN (Unidade)</option>
                    <option value="KG">KG (Quilo / Balança)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                disabled={salvandoNovo}
                onClick={() => setIsNovoModalOpen(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-full transition"
              >
                Cancelar
              </button>
              <button
                disabled={salvandoNovo}
                onClick={handleSalvarNovo}
                className="px-6 py-2.5 bg-[#005bf8] hover:bg-[#004ce5] disabled:opacity-50 text-white font-extrabold rounded-full flex items-center gap-2 shadow-sm transition"
              >
                {salvandoNovo ? 'Salvando...' : 'Salvar no Banco'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
