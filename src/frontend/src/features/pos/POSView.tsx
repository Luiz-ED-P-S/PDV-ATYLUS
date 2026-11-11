import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  CheckCircle2,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  FileSpreadsheet,
  AlertTriangle,
  RotateCcw,
  Plus,
  X,
  Barcode,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { CartTable } from './components/CartTable';
import { PaymentModal } from './components/PaymentModal';
import { ProductSearchModal } from './components/ProductSearchModal';
import { ReceiptPrintModal } from './components/ReceiptPrintModal';
import { CashierModal } from '../cashier/CashierModal';
import { useCartStore } from '../../store/useCartStore';
import { useCashierStore } from '../../store/useCashierStore';
import { pdvApi } from '../../services/api';
import { sound } from '../../services/sound';
import { decodificarCodigoBarras } from '../../utils/barcodeParser';
import { Venda, Produto } from '../../types';

interface POSViewProps {
  onAbrirImportador: () => void;
}

export const POSView: React.FC<POSViewProps> = ({ onAbrirImportador }) => {
  const [codigoInput, setCodigoInput] = useState('');
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(sound.isMuted());

  // Busca de produtos em tempo real (auto-complete / sugestões dinâmicas)
  const [sugestoesProdutos, setSugestoesProdutos] = useState<Produto[]>([]);
  const [sugestaoSelecionadaIdx, setSugestaoSelecionadaIdx] = useState(0);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  // Modais
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCashierOpen, setIsCashierOpen] = useState(false);
  const [vendaFinalizada, setVendaFinalizada] = useState<Venda | null>(null);

  // Store com suporte a Multi-Abas (PDVOpen)
  const {
    abas,
    abaAtivaId,
    criarNovaAba,
    fecharAba,
    alternarAba,
    alternarPorIndice,
    getItens,
    getTotalBruto,
    getTotalLiquido,
    getTotalItens,
    getDesconto,
    adicionarProduto,
    removerItemSelecionado,
    incrementarQuantidade,
    getSelectedItemId,
    setDesconto,
    limparCarrinhoAbaAtual,
  } = useCartStore();

  const itens = getItens();
  const desconto = getDesconto();
  const selectedItemId = getSelectedItemId();

  const { caixa, carregarCaixa } = useCashierStore();

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    carregarCaixa();
  }, [carregarCaixa]);

  // Foco persistente no campo de código de barras
  useEffect(() => {
    const focar = () => {
      if (!isPaymentOpen && !isSearchOpen && !isCashierOpen && !vendaFinalizada) {
        barcodeInputRef.current?.focus();
      }
    };
    focar();
    const interval = setInterval(focar, 1500);
    return () => clearInterval(interval);
  }, [isPaymentOpen, isSearchOpen, isCashierOpen, vendaFinalizada]);

  // Atalhos de teclado (F1 a F4, Del, +, -, Esc, Ctrl+T, Ctrl+W, Ctrl+1..5)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Atalhos de abas com Ctrl
      if (e.ctrlKey) {
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          criarNovaAba();
          return;
        }
        if (e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          if (abas.length > 1) {
            fecharAba(abaAtivaId);
          }
          return;
        }
        const num = parseInt(e.key);
        if (!isNaN(num) && num >= 1 && num <= 9) {
          e.preventDefault();
          alternarPorIndice(num - 1);
          return;
        }
      }

      if (e.key === 'F1') {
        e.preventDefault();
        if (itens.length > 0 && caixa && caixa.status === 'Aberto') {
          setIsPaymentOpen(true);
        } else if (!caixa || caixa.status !== 'Aberto') {
          setErroMsg('O caixa precisa estar aberto para iniciar pagamentos [F3].');
        }
      } else if (e.key === 'F2') {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === 'F3') {
        e.preventDefault();
        setIsCashierOpen(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        onAbrirImportador();
      } else if (e.key === 'Delete') {
        if (selectedItemId) {
          e.preventDefault();
          removerItemSelecionado();
        }
      } else if (e.key === '+' && document.activeElement !== barcodeInputRef.current) {
        e.preventDefault();
        if (selectedItemId) incrementarQuantidade(selectedItemId, 1);
      } else if (e.key === '-' && document.activeElement !== barcodeInputRef.current) {
        e.preventDefault();
        if (selectedItemId) incrementarQuantidade(selectedItemId, -1);
      } else if (e.key === 'Escape') {
        if (mostrarSugestoes) {
          e.preventDefault();
          setMostrarSugestoes(false);
          return;
        }
        if (!isPaymentOpen && !isSearchOpen && !isCashierOpen && itens.length > 0) {
          if (window.confirm('Deseja realmente limpar todos os itens da venda atual?')) {
            limparCarrinhoAbaAtual();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    itens,
    caixa,
    selectedItemId,
    isPaymentOpen,
    isSearchOpen,
    isCashierOpen,
    abas,
    abaAtivaId,
    mostrarSugestoes,
    criarNovaAba,
    fecharAba,
    alternarPorIndice,
    limparCarrinhoAbaAtual,
    removerItemSelecionado,
    incrementarQuantidade,
    onAbrirImportador,
  ]);

  const toggleSound = () => {
    sound.toggleMute();
    setIsMuted(sound.isMuted());
  };

  // Busca em tempo real de produtos conforme o usuário digita
  useEffect(() => {
    const entrada = codigoInput.trim();
    if (entrada.length < 2) {
      setSugestoesProdutos([]);
      setMostrarSugestoes(false);
      return;
    }

    if (/^\d+\*$/.test(entrada)) {
      return;
    }

    let termo = entrada;
    if (entrada.includes('*')) {
      termo = entrada.split('*').slice(1).join('*').trim();
    }

    if (termo.length < 2) {
      setSugestoesProdutos([]);
      setMostrarSugestoes(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const resultados = await pdvApi.buscarProdutos(termo);
        setSugestoesProdutos(resultados);
        setSugestaoSelecionadaIdx(0);
        setMostrarSugestoes(resultados.length > 0);
      } catch {
        setSugestoesProdutos([]);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [codigoInput]);

  const selecionarSugestao = (produto: Produto) => {
    let quantidade = 1;
    const entrada = codigoInput.trim();
    if (entrada.includes('*')) {
      const qtdParse = parseFloat(entrada.split('*')[0].replace(',', '.'));
      if (!isNaN(qtdParse) && qtdParse > 0) {
        quantidade = qtdParse;
      }
    }
    adicionarProduto(produto, quantidade);
    setCodigoInput('');
    setMostrarSugestoes(false);
    setSugestoesProdutos([]);
    setErroMsg(null);
    barcodeInputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mostrarSugestoes && sugestoesProdutos.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSugestaoSelecionadaIdx((prev) => (prev < sugestoesProdutos.length - 1 ? prev + 1 : prev));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSugestaoSelecionadaIdx((prev) => (prev > 0 ? prev - 1 : 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        selecionarSugestao(sugestoesProdutos[sugestaoSelecionadaIdx]);
        return;
      }
    }
  };

  const handleCodigoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroMsg(null);
    const entrada = codigoInput.trim();
    if (!entrada) return;

    if (mostrarSugestoes && sugestoesProdutos.length > 0) {
      selecionarSugestao(sugestoesProdutos[sugestaoSelecionadaIdx]);
      return;
    }

    let quantidade = 1;
    let codigo = entrada;

    if (entrada.includes('*')) {
      const partes = entrada.split('*');
      const qtdParse = parseFloat(partes[0].replace(',', '.'));
      if (!isNaN(qtdParse) && qtdParse > 0) {
        quantidade = qtdParse;
      }
      codigo = partes.slice(1).join('*').trim();
    }

    const infoBalanca = decodificarCodigoBarras(codigo);

    try {
      if (infoBalanca.isBalanca && infoBalanca.codigoProduto) {
        const produto = await pdvApi.buscarProdutoPorCodigo(infoBalanca.codigoProduto);
        if (!produto) {
          sound.playErrorBeep();
          setErroMsg(`Produto de balança [${infoBalanca.codigoProduto}] não encontrado.`);
          return;
        }

        let qtdFinal = quantidade;
        if (infoBalanca.tipoEmbutido === 'preco' && infoBalanca.valorOuPesoEmbutido && produto.precoVenda > 0) {
          qtdFinal = Number((infoBalanca.valorOuPesoEmbutido / produto.precoVenda).toFixed(3));
        } else if (infoBalanca.tipoEmbutido === 'peso' && infoBalanca.valorOuPesoEmbutido) {
          qtdFinal = infoBalanca.valorOuPesoEmbutido;
        }

        adicionarProduto(produto, qtdFinal);
        setCodigoInput('');
        setMostrarSugestoes(false);
        return;
      }

      const produto = await pdvApi.buscarProdutoPorCodigo(codigo);
      if (!produto) {
        sound.playErrorBeep();
        setErroMsg(`Produto [${codigo}] não encontrado no cadastro.`);
        return;
      }

      adicionarProduto(produto, quantidade);
      setCodigoInput('');
      setMostrarSugestoes(false);
    } catch {
      sound.playErrorBeep();
      setErroMsg('Erro de conexão ao buscar produto.');
    }
  };

  const isCaixaAberto = caixa && caixa.status === 'Aberto';

  return (
    <div className="flex-1 flex flex-col space-y-4 select-none font-sans">
      {/* 1. Barra de Abas Modernizada */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/60 p-2 rounded-2xl border border-slate-200/80 backdrop-blur-sm">
        {/* Abas de Atendimento */}
        <div className="flex items-center gap-2 overflow-x-auto py-0.5 custom-scrollbar">
          <div className="flex items-center gap-1.5 px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span>Vendas:</span>
          </div>
          {abas.map((aba, index) => {
            const isAtiva = aba.id === abaAtivaId;
            const totalAba = aba.itens.reduce((acc, i) => acc + i.subtotal, 0);

            return (
              <div
                key={aba.id}
                onClick={() => alternarAba(aba.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all duration-200 shadow-xs ${
                  isAtiva
                    ? 'bg-indigo-600 text-white shadow-indigo-500/20 shadow-md ring-2 ring-indigo-600/20'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                <span>{index + 1}. {aba.titulo}</span>
                {totalAba > 0 && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${isAtiva ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-100 text-slate-700'}`}>
                    R$ {totalAba.toFixed(2)}
                  </span>
                )}
                {abas.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fecharAba(aba.id);
                    }}
                    className="hover:text-red-200 rounded p-0.5 ml-1 transition"
                    title="Fechar aba (Ctrl+W)"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={() => criarNovaAba()}
            title="Abrir nova venda em espera (Ctrl+T)"
            className="px-3 py-2 rounded-xl bg-white hover:bg-indigo-50/50 border border-dashed border-indigo-300 text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1.5 shadow-xs transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>Nova Venda</span>
          </button>
        </div>

        {/* Status do Caixa e Som */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsCashierOpen(true)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border shadow-xs transition-all ${
              isCaixaAberto
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100/70'
                : 'bg-rose-50 text-rose-600 border-rose-200/80 hover:bg-rose-100/70'
            }`}
          >
            {isCaixaAberto ? <Unlock className="w-3.5 h-3.5 text-emerald-600" /> : <Lock className="w-3.5 h-3.5 text-rose-500" />}
            <span>Caixa {isCaixaAberto ? 'Aberto' : 'Fechado'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/70 font-mono font-medium">F3</span>
          </button>

          <button
            title={isMuted ? 'Ativar Efeitos Sonoros' : 'Silenciar'}
            onClick={toggleSound}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-500 border border-slate-200/80 shadow-xs transition"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-indigo-600" />}
          </button>
        </div>
      </div>

      {/* 2. Área Principal de Venda (2 Colunas) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-4 min-h-0">
        {/* LADO ESQUERDO: Leitor de Código + Tabela do Carrinho */}
        <section className="flex-[2] flex flex-col gap-4 min-w-0">
          {/* Input de Leitor de Código de Barras Modernizado */}
          <form onSubmit={handleCodigoSubmit} className="relative">
            <div className="relative flex items-center bg-white border border-slate-200/90 rounded-2xl shadow-sm p-1.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all duration-200">
              <div className="pl-3.5 pr-2 text-indigo-500 flex items-center gap-1.5">
                <Barcode className="w-5 h-5 text-indigo-500" />
              </div>
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Passe o leitor ou digite nome / código (ex: 3*código)..."
                value={codigoInput}
                onChange={e => setCodigoInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
                className="w-full px-2 py-2.5 bg-transparent text-slate-800 text-sm font-medium placeholder-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm shadow-indigo-600/20 transition-all shrink-0 flex items-center gap-1.5"
              >
                <span>Inserir</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Dropdown de Busca em Tempo Real */}
            {mostrarSugestoes && sugestoesProdutos.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 border border-slate-200 rounded-2xl shadow-2xl z-30 overflow-hidden divide-y divide-slate-100 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
                <div className="px-5 py-2.5 bg-slate-50 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5 text-indigo-600 font-bold">
                    <Search className="w-3.5 h-3.5" />
                    <span>Sugestões Rápidas ({sugestoesProdutos.length} encontradas)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">&uarr;&darr; navegar &bull; Enter selecionar &bull; Esc fechar</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                  {sugestoesProdutos.map((prod, idx) => {
                    const isSelected = idx === sugestaoSelecionadaIdx;
                    return (
                      <div
                        key={prod.id}
                        onMouseDown={() => selecionarSugestao(prod)}
                        className={`p-3.5 px-5 flex items-center justify-between cursor-pointer transition ${
                          isSelected
                            ? 'bg-indigo-50/80 border-l-4 border-indigo-600'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <span>{prod.nome}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 font-mono text-slate-600 font-semibold border border-slate-200/60">
                              {prod.codigoBarras}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 font-medium">
                            Estoque atual: <strong className="text-slate-700">{prod.estoqueAtual} un</strong>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black font-mono text-emerald-600">
                            R$ {prod.precoVenda.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {erroMsg && (
              <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2 z-20 shadow-md">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{erroMsg}</span>
              </div>
            )}
          </form>

          {/* Tabela do Carrinho */}
          <CartTable />
        </section>

        {/* LADO DIREITO: Totalizador e Botões Modernos */}
        <aside className="w-full lg:w-96 flex flex-col gap-4 shrink-0">
          {/* Card de Resumo de Valores */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="space-y-3.5 text-xs font-semibold">
              <div className="flex justify-between items-center text-slate-500">
                <span className="font-medium">Subtotal Bruto:</span>
                <span className="font-mono text-slate-900 font-bold text-sm">R$ {getTotalBruto().toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-500">
                <span className="font-medium">Desconto:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-rose-600 font-bold">- R$ {desconto.toFixed(2)}</span>
                  <button
                    onClick={() => {
                      const desc = prompt('Informe o valor de desconto (R$):', String(desconto));
                      if (desc !== null) setDesconto(parseFloat(desc) || 0);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold transition"
                  >
                    Editar
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center text-slate-400 border-t border-slate-100 pt-3 text-[11px]">
                <span className="font-medium">Total de Itens:</span>
                <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-mono">{getTotalItens()}</span>
              </div>
            </div>

            {/* Total a Pagar em Destaque Indigo */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-right bg-gradient-to-b from-transparent to-indigo-50/30 -mx-6 -mb-6 p-6 rounded-b-3xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">
                TOTAL A PAGAR
              </span>
              <div className="text-4xl lg:text-5xl font-black font-mono text-indigo-600 tracking-tight">
                R$ {getTotalLiquido().toFixed(2)}
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm flex flex-col gap-3">
            <button
              onClick={() => {
                if (itens.length > 0 && isCaixaAberto) setIsPaymentOpen(true);
                else if (!isCaixaAberto) setErroMsg('Abra o caixa primeiro [F3].');
              }}
              disabled={itens.length === 0}
              className={`w-full py-4 px-5 rounded-2xl font-black text-sm sm:text-base flex items-center justify-between transition-all duration-200 ${
                itens.length > 0
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-lg shadow-indigo-600/25 active:scale-98'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-indigo-200" />
                <span>FINALIZAR VENDA</span>
              </div>
              <span className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold ${itens.length > 0 ? 'bg-indigo-900/60 text-white' : 'bg-slate-200 text-slate-400'}`}>
                F1
              </span>
            </button>

            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full py-3 px-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-between shadow-xs active:scale-98 transition"
            >
              <div className="flex items-center gap-2.5">
                <Search className="w-4 h-4 text-indigo-500" />
                <span className="uppercase">Buscar Produto</span>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-mono text-xs">F2</span>
            </button>

            <button
              onClick={() => setIsCashierOpen(true)}
              className="w-full py-3 px-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-between shadow-xs active:scale-98 transition"
            >
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-slate-500" />
                <span className="uppercase">Controle de Caixa</span>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-mono text-xs">F3</span>
            </button>

            <button
              onClick={onAbrirImportador}
              className="w-full py-3 px-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-between shadow-xs active:scale-98 transition"
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="uppercase">Importação IA & XML</span>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-mono text-xs">F4</span>
            </button>

            <button
              onClick={() => {
                if (itens.length > 0 && window.confirm('Deseja realmente limpar os itens desta venda?')) {
                  limparCarrinhoAbaAtual();
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center justify-between transition mt-1"
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>LIMPAR CARRINHO</span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 font-mono text-[10px]">Esc</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Modais do Sistema */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onVendaConcluida={venda => setVendaFinalizada(venda)}
      />

      <ProductSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      <CashierModal
        isOpen={isCashierOpen}
        onClose={() => setIsCashierOpen(false)}
      />

      <ReceiptPrintModal
        venda={vendaFinalizada}
        onClose={() => setVendaFinalizada(null)}
      />
    </div>
  );
};
