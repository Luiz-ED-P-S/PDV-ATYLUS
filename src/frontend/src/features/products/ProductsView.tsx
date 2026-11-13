import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  Download,
  Package,
  Edit2,
  Barcode,
  AlertTriangle,
  Tag,
} from 'lucide-react';
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

  // Painel Lateral (Drawer) de Cadastro / Edição
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [salvandoForm, setSalvandoForm] = useState(false);

  // Form states
  const [formCodigo, setFormCodigo] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formPrecoVenda, setFormPrecoVenda] = useState<string>('');
  const [formPrecoCusto, setFormPrecoCusto] = useState<string>('');
  const [formEstoque, setFormEstoque] = useState<string>('10');
  const [formEstoqueMin, setFormEstoqueMin] = useState<string>('5');
  const [formUnidade, setFormUnidade] = useState<'UN' | 'KG'>('UN');
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

  const abrirDrawerNovo = () => {
    setProdutoEditando(null);
    setFormCodigo('');
    setFormNome('');
    setFormPrecoVenda('');
    setFormPrecoCusto('');
    setFormEstoque('10');
    setFormEstoqueMin('5');
    setFormUnidade('UN');
    setIsDrawerOpen(true);
  };

  const abrirDrawerEditar = (prod: Produto) => {
    setProdutoEditando(prod);
    setFormCodigo(prod.codigoBarras);
    setFormNome(prod.nome);
    setFormPrecoVenda(prod.precoVenda.toString());
    setFormPrecoCusto(prod.precoCusto.toString());
    setFormEstoque(prod.estoqueAtual.toString());
    setFormEstoqueMin(prod.estoqueMinimo.toString());
    setFormUnidade(prod.unidadeMedida as 'UN' | 'KG' || 'UN');
    setIsDrawerOpen(true);
  };

  const fecharDrawer = () => {
    setIsDrawerOpen(false);
    setProdutoEditando(null);
  };

  const handleSalvarForm = async () => {
    const precoVendaNum = parseFloat(formPrecoVenda.replace(',', '.')) || 0;
    const precoCustoNum = parseFloat(formPrecoCusto.replace(',', '.')) || 0;
    const estoqueNum = parseFloat(formEstoque.replace(',', '.')) || 0;
    const estoqueMinNum = parseFloat(formEstoqueMin.replace(',', '.')) || 5;

    if (!formCodigo.trim() || !formNome.trim() || precoVendaNum <= 0) {
      alert('Preencha código, descrição e preço de venda válido (maior que zero).');
      return;
    }

    if (precoCustoNum > precoVendaNum) {
      alert(`Bloqueio de preço: O preço de custo (R$ ${precoCustoNum.toFixed(2)}) não pode ser superior ao preço de venda (R$ ${precoVendaNum.toFixed(2)})!`);
      return;
    }

    setSalvandoForm(true);
    try {
      if (produtoEditando) {
        // Atualização
        await pdvApi.atualizarProduto(produtoEditando.id, {
          nome: formNome.trim(),
          precoVenda: precoVendaNum,
          precoCusto: precoCustoNum,
          estoqueAtual: estoqueNum,
          estoqueMinimo: estoqueMinNum,
        });
        alert('Produto atualizado com sucesso!');
      } else {
        // Novo cadastro
        const novoProduto = await pdvApi.criarProduto({
          codigoBarras: formCodigo.trim(),
          nome: formNome.trim(),
          precoVenda: precoVendaNum,
          precoCusto: precoCustoNum,
          estoqueAtual: estoqueNum,
          estoqueMinimo: estoqueMinNum,
        });
        setProdutos(prev => [novoProduto, ...prev]);
        alert('Produto cadastrado com sucesso!');
      }
      await carregarProdutos();
      fecharDrawer();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Falha ao processar produto.';
      alert(`Erro: ${msg}`);
    } finally {
      setSalvandoForm(false);
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
      alert(`Bloqueio: O preço de custo não pode superar o preço de venda (R$ ${prod.precoVenda.toFixed(2)}).`);
      cancelInlineEdit();
      return;
    }

    if (editingCell.field === 'precoVenda' && numVal < prod.precoCusto) {
      alert(`Bloqueio: O preço de venda não pode ser inferior ao preço de custo (R$ ${prod.precoCusto.toFixed(2)}).`);
      cancelInlineEdit();
      return;
    }

    setSalvandoInline(true);
    try {
      await pdvApi.atualizarProduto(prod.id, {
        [editingCell.field]: numVal
      });

      setProdutos(prev => prev.map(p => {
        if (p.id === prod.id) {
          return { ...p, [editingCell.field]: numVal };
        }
        return p;
      }));
      cancelInlineEdit();
    } catch (err: any) {
      alert(`Falha ao salvar alteração: ${err.message || 'Erro de rede'}`);
    } finally {
      setSalvandoInline(false);
    }
  };

  const produtosFiltrados = produtos.filter(p => {
    const termo = busca.toLowerCase();
    return p.nome.toLowerCase().includes(termo) || p.codigoBarras.includes(termo);
  });

  const produtosEstoqueBaixo = produtos.filter(p => p.estoqueAtual <= p.estoqueMinimo);

  return (
    <div className="flex-1 flex flex-col space-y-5 select-none font-sans">
      {/* Topo Moderno */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Produtos e Estoque</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Cadastre novos itens, ajuste preços diretamente na tabela e controle o estoque.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handlePuxarNuvem}
            disabled={baixandoNuvem}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200/90 shadow-xs transition flex items-center gap-2 text-xs font-bold"
            title="Puxar produtos e preços atualizados da nuvem"
          >
            <Download className={`w-4 h-4 text-indigo-600 ${baixandoNuvem ? 'animate-bounce' : ''}`} />
            <span>{baixandoNuvem ? 'Sincronizando...' : 'Puxar da Nuvem'}</span>
          </button>

          <button
            onClick={carregarProdutos}
            disabled={carregando}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200/90 shadow-xs transition flex items-center gap-2 text-xs font-bold"
            title="Recarregar catálogo"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${carregando ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            onClick={abrirDrawerNovo}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm shadow-indigo-600/25 transition active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      {erro && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Mini Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total de Produtos</span>
            <span className="text-lg font-black font-mono text-slate-900">{produtos.length} cadastrados</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Estoque Crítico / Baixo</span>
            <span className="text-lg font-black font-mono text-amber-600">{produtosEstoqueBaixo.length} itens</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Edição Rápida</span>
            <span className="text-xs font-semibold text-slate-600">Clique duas vezes na célula para alterar</span>
          </div>
        </div>
      </div>

      {/* Barra de Pesquisa */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-xl flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por descrição ou código de barras..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200/90 rounded-xl text-slate-800 text-xs sm:text-sm placeholder-slate-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
        </div>
        <span className="text-xs font-bold text-slate-500 pr-2">
          {produtosFiltrados.length} itens listados
        </span>
      </div>

      {/* Tabela de Produtos */}
      <div className="flex-1 bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[380px]">
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 backdrop-blur-md text-slate-400 font-bold uppercase text-[11px] tracking-wider sticky top-0 border-b border-slate-100 z-10">
              <tr>
                <th className="py-3.5 px-5 w-40 font-semibold">CÓD. BARRAS</th>
                <th className="py-3.5 px-5 font-semibold">DESCRIÇÃO DO PRODUTO</th>
                <th className="py-3.5 px-5 text-center w-20 font-semibold">UN.</th>
                <th className="py-3.5 px-5 text-right w-36 font-semibold">PREÇO CUSTO</th>
                <th className="py-3.5 px-5 text-right w-36 font-semibold">PREÇO VENDA</th>
                <th className="py-3.5 px-5 text-center w-36 font-semibold">ESTOQUE ATUAL</th>
                <th className="py-3.5 px-5 text-center w-28 font-semibold">STATUS</th>
                <th className="py-3.5 px-5 text-center w-24 font-semibold">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {carregando ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                      <span>Carregando catálogo de produtos...</span>
                    </div>
                  </td>
                </tr>
              ) : produtosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 font-medium">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                produtosFiltrados.map(prod => {
                  const isBaixo = prod.estoqueAtual <= prod.estoqueMinimo;

                  return (
                    <tr key={prod.id} className="hover:bg-indigo-50/40 transition">
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-600">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200/60">
                          {prod.codigoBarras}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-bold text-slate-900">
                        {prod.nome}
                      </td>
                      <td className="py-3.5 px-5 text-center font-bold text-slate-500">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px]">
                          {prod.unidadeMedida || 'UN'}
                        </span>
                      </td>

                      {/* Preço de Custo com Edição Inline */}
                      <td
                        onDoubleClick={() => startInlineEdit(prod, 'precoCusto')}
                        className="py-3.5 px-5 text-right font-mono font-medium text-slate-500 cursor-pointer hover:bg-indigo-50/60"
                        title="Duplo clique para editar custo"
                      >
                        {editingCell?.id === prod.id && editingCell?.field === 'precoCusto' ? (
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <input
                              type="number"
                              step="0.01"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveInlineEdit(prod);
                                if (e.key === 'Escape') cancelInlineEdit();
                              }}
                              autoFocus
                              className="w-20 p-1 text-right bg-white border border-indigo-500 rounded text-xs font-mono font-bold focus:outline-none"
                            />
                            <button
                              onClick={() => saveInlineEdit(prod)}
                              disabled={salvandoInline}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelInlineEdit}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          `R$ ${prod.precoCusto.toFixed(2)}`
                        )}
                      </td>

                      {/* Preço de Venda com Edição Inline */}
                      <td
                        onDoubleClick={() => startInlineEdit(prod, 'precoVenda')}
                        className="py-3.5 px-5 text-right font-mono font-black text-emerald-600 text-sm cursor-pointer hover:bg-emerald-50/40"
                        title="Duplo clique para editar preço de venda"
                      >
                        {editingCell?.id === prod.id && editingCell?.field === 'precoVenda' ? (
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <input
                              type="number"
                              step="0.01"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveInlineEdit(prod);
                                if (e.key === 'Escape') cancelInlineEdit();
                              }}
                              autoFocus
                              className="w-20 p-1 text-right bg-white border border-indigo-500 rounded text-xs font-mono font-bold focus:outline-none"
                            />
                            <button
                              onClick={() => saveInlineEdit(prod)}
                              disabled={salvandoInline}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelInlineEdit}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          `R$ ${prod.precoVenda.toFixed(2)}`
                        )}
                      </td>

                      {/* Estoque com Edição Inline */}
                      <td
                        onDoubleClick={() => startInlineEdit(prod, 'estoqueAtual')}
                        className="py-3.5 px-5 text-center font-mono font-bold text-slate-700 cursor-pointer hover:bg-indigo-50/60"
                        title="Duplo clique para editar estoque"
                      >
                        {editingCell?.id === prod.id && editingCell?.field === 'estoqueAtual' ? (
                          <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                            <input
                              type="number"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveInlineEdit(prod);
                                if (e.key === 'Escape') cancelInlineEdit();
                              }}
                              autoFocus
                              className="w-16 p-1 text-center bg-white border border-indigo-500 rounded text-xs font-mono font-bold focus:outline-none"
                            />
                            <button
                              onClick={() => saveInlineEdit(prod)}
                              disabled={salvandoInline}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelInlineEdit}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          `${prod.estoqueAtual} ${prod.unidadeMedida === 'KG' ? 'kg' : 'un'}`
                        )}
                      </td>

                      <td className="py-3.5 px-5 text-center">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border inline-flex items-center gap-1 ${
                          isBaixo
                            ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                        }`}>
                          {isBaixo ? (
                            <>
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              <span>Baixo</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Normal</span>
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-3.5 px-5 text-center">
                        <button
                          onClick={() => abrirDrawerEditar(prod)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition shadow-xs"
                          title="Editar cadastro completo"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Painel Lateral / Drawer Moderno de Cadastro e Edição */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={fecharDrawer}
          />
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl z-10 flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {produtoEditando ? 'Editar Produto' : 'Novo Produto'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {produtoEditando ? 'Altere as informações no banco local' : 'Preencha os campos para cadastrar'}
                  </p>
                </div>
              </div>
              <button
                onClick={fecharDrawer}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-6 space-y-4 text-xs font-semibold flex-1">
              <div>
                <label className="block text-slate-600 mb-1.5 uppercase font-bold text-[11px] flex items-center gap-1.5">
                  <Barcode className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Código de Barras / EAN-13:</span>
                </label>
                <input
                  type="text"
                  value={formCodigo}
                  disabled={!!produtoEditando}
                  onChange={e => setFormCodigo(e.target.value)}
                  className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-sm focus:bg-white focus:outline-none focus:border-indigo-600 transition ${
                    produtoEditando ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''
                  }`}
                  placeholder="Ex: 7891234567890 ou 15 para balança"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1.5 uppercase font-bold text-[11px] flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Descrição / Nome do Produto:</span>
                </label>
                <input
                  type="text"
                  value={formNome}
                  onChange={e => setFormNome(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                  placeholder="Ex: Biscoito Recheado Chocolate 140g"
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
                    value={formPrecoVenda}
                    onFocus={e => e.target.select()}
                    onChange={e => setFormPrecoVenda(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-emerald-600 font-mono font-black text-base focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1.5 uppercase font-bold text-[11px]">Preço de Custo (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={formPrecoCusto}
                    onFocus={e => e.target.select()}
                    onChange={e => setFormPrecoCusto(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-base focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 mb-1.5 uppercase font-bold text-[11px]">Estoque Atual:</label>
                  <input
                    type="number"
                    step="1"
                    placeholder="0"
                    value={formEstoque}
                    onFocus={e => e.target.select()}
                    onChange={e => setFormEstoque(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-base focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1.5 uppercase font-bold text-[11px]">Estoque Mínimo:</label>
                  <input
                    type="number"
                    step="1"
                    placeholder="5"
                    value={formEstoqueMin}
                    onFocus={e => e.target.select()}
                    onChange={e => setFormEstoqueMin(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-base focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1.5 uppercase font-bold text-[11px]">Unidade de Medida:</label>
                <select
                  value={formUnidade}
                  disabled={!!produtoEditando}
                  onChange={e => setFormUnidade(e.target.value as 'UN' | 'KG')}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                >
                  <option value="UN">UN (Unidade / Peça)</option>
                  <option value="KG">KG (Quilo / Balança Fracionada)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                disabled={salvandoForm}
                onClick={fecharDrawer}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                disabled={salvandoForm}
                onClick={handleSalvarForm}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-xl flex items-center gap-2 shadow-xs transition"
              >
                {salvandoForm ? 'Gravando...' : produtoEditando ? 'Salvar Alterações' : 'Cadastrar Produto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
