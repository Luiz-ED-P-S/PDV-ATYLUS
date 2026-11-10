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
          fecharAba(abaAtivaId);
          return;
        }
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= 9) {
          e.preventDefault();
          alternarPorIndice(num - 1);
          return;
        }
      }

      if (isPaymentOpen || isSearchOpen || isCashierOpen || vendaFinalizada) {
        if (e.key === 'Escape') {
          setIsPaymentOpen(false);
          setIsSearchOpen(false);
          setIsCashierOpen(false);
          setVendaFinalizada(null);
        }
        return;
      }

      switch (e.key) {
        case 'F1':
          e.preventDefault();
          if (itens.length > 0) {
            if (!caixa || caixa.status !== 'Aberto') {
              sound.playErrorBeep();
              setErroMsg('Abra o caixa antes de realizar vendas [F3].');
              return;
            }
            setIsPaymentOpen(true);
          } else {
            sound.playErrorBeep();
            setErroMsg('Adicione ao menos um item ao carrinho antes de finalizar.');
          }
          break;

        case 'F2':
          e.preventDefault();
          setIsSearchOpen(true);
          break;

        case 'F3':
          e.preventDefault();
          setIsCashierOpen(true);
          break;

        case 'F4':
          e.preventDefault();
          onAbrirImportador();
          break;

        case 'Delete':
          e.preventDefault();
          removerItemSelecionado();
          break;

        case '+':
          if (selectedItemId && document.activeElement !== barcodeInputRef.current) {
            e.preventDefault();
            incrementarQuantidade(selectedItemId, 1);
          }
          break;

        case '-':
          if (selectedItemId && document.activeElement !== barcodeInputRef.current) {
            e.preventDefault();
            incrementarQuantidade(selectedItemId, -1);
          }
          break;

        case 'Escape':
          e.preventDefault();
          if (itens.length > 0) {
            if (window.confirm('Deseja realmente limpar a venda atual?')) {
              limparCarrinhoAbaAtual();
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaymentOpen, isSearchOpen, isCashierOpen, vendaFinalizada, itens, caixa, selectedItemId, removerItemSelecionado, incrementarQuantidade, limparCarrinhoAbaAtual, onAbrirImportador, abaAtivaId, criarNovaAba, fecharAba, alternarPorIndice]);

  // Processamento do Código de Barras (Suporta multiplicação '3*cod' e código de balança EAN-13 iniciando com '2')
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
        setSugestaoSelecionadaIdx((prev) => (prev > 0 ? prev - 1 : prev));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMostrarSugestoes(false);
        return;
      }
      if (e.key === 'Enter' && sugestoesProdutos[sugestaoSelecionadaIdx]) {
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

    if (!caixa || caixa.status !== 'Aberto') {
      sound.playErrorBeep();
      setErroMsg('Caixa fechado! Pressione F3 para abrir o caixa.');
      return;
    }

    let quantidade = 1;
    let codigo = entrada;

    // Multiplicação manual (ex: 3*789... ou 0.450*789...)
    if (entrada.includes('*')) {
      const partes = entrada.split('*');
      const qtdParse = parseFloat(partes[0].replace(',', '.'));
      if (!isNaN(qtdParse) && qtdParse > 0) {
        quantidade = qtdParse;
        codigo = partes.slice(1).join('*').trim();
      }
    }

    // Decodificador de Balança EAN-13 iniciando com '2' (PDVOpen)
    const balancaResult = decodificarCodigoBarras(codigo);
    if (balancaResult.isBalanca) {
      try {
        let produto = await pdvApi.buscarProdutoPorCodigo(balancaResult.codigoProduto);
        if (!produto) {
          produto = await pdvApi.buscarProdutoPorCodigo(balancaResult.codigoProdutoPadrao);
        }
        if (produto) {
          // Se o valor foi embutido, calcula a quantidade fracionada em kg
          if (balancaResult.tipoEmbutido === 'preco' && balancaResult.valorOuPesoEmbutido) {
            const pesoCalculado = parseFloat((balancaResult.valorOuPesoEmbutido / produto.precoVenda).toFixed(3));
            adicionarProduto(produto, pesoCalculado, 'KG');
            setCodigoInput('');
            return;
          }
        }
      } catch {
        // Fallback para busca normal
      }
    }

    // Busca padrão de produto por código de barras ou nome
    try {
      const produto = await pdvApi.buscarProdutoPorCodigo(codigo);
      if (produto) {
        adicionarProduto(produto, quantidade);
        setCodigoInput('');
        setMostrarSugestoes(false);
      } else {
        const encontrados = await pdvApi.buscarProdutos(codigo);
        if (encontrados.length === 1) {
          adicionarProduto(encontrados[0], quantidade);
          setCodigoInput('');
          setMostrarSugestoes(false);
        } else if (encontrados.length > 1) {
          setSugestoesProdutos(encontrados);
          setSugestaoSelecionadaIdx(0);
          setMostrarSugestoes(true);
        } else {
          sound.playErrorBeep();
          setErroMsg(`Produto com código ou nome '${codigo}' não foi encontrado.`);
        }
      }
    } catch {
      sound.playErrorBeep();
      setErroMsg('Erro ao consultar o catálogo de produtos.');
    }
  };

  const toggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const isCaixaAberto = caixa && caixa.status === 'Aberto';

  return (
    <div className="flex-1 flex flex-col space-y-4 select-none font-sans">
      {/* 1. Barra de Abas e Status Fiel ao Vídeo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Abas de Atendimento */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">VENDAS:</span>
          {abas.map((aba, index) => {
            const isAtiva = aba.id === abaAtivaId;
            const totalAba = aba.itens.reduce((acc, i) => acc + i.subtotal, 0);

            return (
              <div
                key={aba.id}
                onClick={() => alternarAba(aba.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-sm ${
                  isAtiva
                    ? 'bg-[#005bf8] text-white'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/90'
                }`}
              >
                <span>{index + 1}. {aba.titulo}</span>
                {totalAba > 0 && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${isAtiva ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    R$ {totalAba.toFixed(2)}
                  </span>
                )}
                {abas.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fecharAba(aba.id);
                    }}
                    className="hover:text-red-300 rounded p-0.5 ml-1"
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
            className="px-3.5 py-2 rounded-full bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-600 hover:text-slate-900 text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5 text-[#005bf8]" />
            <span>+ Nova Venda</span>
          </button>
        </div>

        {/* Status do Caixa e Som */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCashierOpen(true)}
            className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 border shadow-sm transition ${
              isCaixaAberto
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
            }`}
          >
            {isCaixaAberto ? <Unlock className="w-3.5 h-3.5 text-emerald-600" /> : <Lock className="w-3.5 h-3.5 text-red-500" />}
            <span>Caixa {isCaixaAberto ? 'Aberto' : 'Fechado'} (F3)</span>
          </button>

          <button
            title={isMuted ? 'Ativar Efeitos Sonoros' : 'Silenciar'}
            onClick={toggleSound}
            className="p-2 rounded-full bg-white hover:bg-slate-50 text-slate-500 border border-slate-200/90 shadow-sm transition"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4 text-[#005bf8]" />}
          </button>
        </div>
      </div>

      {/* 2. Área Principal de Venda (Lado Esquerdo 2/3 e Lado Direito 1/3) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-4 min-h-0">
        {/* LADO ESQUERDO: Input de Código de Barras e Tabela do Carrinho */}
        <section className="flex-[2] flex flex-col gap-4 min-w-0">
          {/* Input de Leitor de Código de Barras Fiel ao Vídeo */}
          <form onSubmit={handleCodigoSubmit} className="relative">
            <div className="relative flex items-center bg-white border border-slate-200/90 rounded-full shadow-sm p-1.5">
              <span className="pl-4 pr-2 text-slate-400 font-mono text-base font-bold select-none tracking-tighter">|||||</span>
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Passe o leitor ou digite o código (ex: 3*código)..."
                value={codigoInput}
                onChange={e => setCodigoInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
                className="w-full px-2 py-2 bg-transparent text-slate-800 text-sm font-medium placeholder-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                className="px-6 py-2.5 rounded-full bg-[#005bf8] hover:bg-[#004ce5] text-white font-bold text-xs shadow-sm transition shrink-0"
              >
                Adicionar
              </button>
            </div>

            {/* Dropdown de Busca em Tempo Real */}
            {mostrarSugestoes && sugestoesProdutos.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200/90 rounded-3xl shadow-2xl z-30 overflow-hidden divide-y divide-slate-100 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
                <div className="px-5 py-2.5 bg-slate-50/80 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5 text-[#005bf8] font-bold">
                    <Search className="w-3.5 h-3.5" />
                    <span>Busca em tempo real ({sugestoesProdutos.length} encontrados)</span>
                  </div>
                  <span className="text-[11px] text-slate-400">&uarr;&darr; navegar &bull; Enter selecionar &bull; Esc fechar</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {sugestoesProdutos.map((prod, idx) => {
                    const isSelected = idx === sugestaoSelecionadaIdx;
                    return (
                      <div
                        key={prod.id}
                        onMouseDown={() => selecionarSugestao(prod)}
                        className={`p-3.5 px-5 flex items-center justify-between cursor-pointer transition ${
                          isSelected
                            ? 'bg-blue-50/70 border-l-4 border-[#005bf8]'
                            : 'hover:bg-slate-50/70 text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <span>{prod.nome}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 font-mono text-slate-500 font-semibold">
                              {prod.codigoBarras}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 font-medium">
                            Estoque: <strong className="text-slate-700">{prod.estoqueAtual} un</strong>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-extrabold font-mono text-emerald-600">
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
              <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs font-medium flex items-center gap-2 z-20 shadow-md">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{erroMsg}</span>
              </div>
            )}
          </form>

          {/* Tabela do Carrinho */}
          <CartTable />
        </section>

        {/* LADO DIREITO: Totalizador e Botões Fiel ao Vídeo */}
        <aside className="w-full lg:w-96 flex flex-col gap-4 shrink-0">
          {/* Card Branco de Resumo de Valores */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-3.5 text-xs font-semibold">
              <div className="flex justify-between items-center text-slate-500">
                <span>Subtotal Bruto:</span>
                <span className="font-mono text-slate-900 font-bold text-sm">R$ {getTotalBruto().toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-500">
                <span>Desconto:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-red-500 font-bold">- R$ {desconto.toFixed(2)}</span>
                  <button
                    onClick={() => {
                      const desc = prompt('Informe o valor de desconto (R$):', String(desconto));
                      if (desc !== null) setDesconto(parseFloat(desc) || 0);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold transition"
                  >
                    Editar
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center text-slate-400 border-t border-slate-100 pt-3 text-[11px]">
                <span>Total de Itens:</span>
                <span className="font-bold text-slate-700">{getTotalItens()}</span>
              </div>
            </div>

            {/* Total a Pagar em Destaque Azul Fiel ao Vídeo */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">
                TOTAL A PAGAR
              </span>
              <div className="text-4xl lg:text-5xl font-black font-mono text-[#005bf8] tracking-tight">
                R$ {getTotalLiquido().toFixed(2)}
              </div>
            </div>
          </div>

          {/* Botões de Ação Fiel ao Vídeo */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm flex flex-col gap-3">
            <button
              onClick={() => {
                if (itens.length > 0 && isCaixaAberto) setIsPaymentOpen(true);
                else if (!isCaixaAberto) setErroMsg('Abra o caixa primeiro [F3].');
              }}
              disabled={itens.length === 0}
              className={`w-full py-4 px-5 rounded-2xl font-black text-base flex items-center justify-between transition ${
                itens.length > 0
                  ? 'bg-[#005bf8] hover:bg-[#004ce5] text-white shadow-md shadow-blue-500/20 active:scale-98'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" />
                <span>FINALIZAR VENDA</span>
              </div>
              <span className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold ${itens.length > 0 ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-400'}`}>
                F1
              </span>
            </button>

            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full py-3 px-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 font-bold text-xs flex items-center justify-between shadow-sm active:scale-98 transition"
            >
              <div className="flex items-center gap-2.5">
                <Search className="w-4 h-4 text-slate-400" />
                <span className="uppercase">BUSCAR PRODUTO</span>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 font-mono text-xs">F2</span>
            </button>

            <button
              onClick={() => setIsCashierOpen(true)}
              className="w-full py-3 px-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 font-bold text-xs flex items-center justify-between shadow-sm active:scale-98 transition"
            >
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-slate-400" />
                <span className="uppercase">CONTROLE DE CAIXA</span>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 font-mono text-xs">F3</span>
            </button>

            <button
              onClick={onAbrirImportador}
              className="w-full py-3 px-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 font-bold text-xs flex items-center justify-between shadow-sm active:scale-98 transition"
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                <span className="uppercase">IMPORTAÇÃO IA & XML</span>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 font-mono text-xs">F4</span>
            </button>

            <button
              onClick={() => {
                if (itens.length > 0 && window.confirm('Deseja realmente limpar os itens desta venda?')) {
                  limparCarrinhoAbaAtual();
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 text-xs font-bold flex items-center justify-between transition mt-1"
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
