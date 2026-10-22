import React, { useState, useEffect, useRef } from 'react';
import {
  Barcode,
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
  User,
} from 'lucide-react';
import { CartTable } from './components/CartTable';
import { PaymentModal } from './components/PaymentModal';
import { ProductSearchModal } from './components/ProductSearchModal';
import { ReceiptPrintModal } from './components/ReceiptPrintModal';
import { CashierModal } from '../cashier/CashierModal';
import { useCartStore } from '../../store/useCartStore';
import { useCashierStore } from '../../store/useCashierStore';
import { useAuthStore } from '../../store/useAuthStore';
import { pdvApi } from '../../services/api';
import { sound } from '../../services/sound';
import { decodificarCodigoBarras } from '../../utils/barcodeParser';
import { Venda } from '../../types';

interface POSViewProps {
  onAbrirImportador: () => void;
}

export const POSView: React.FC<POSViewProps> = ({ onAbrirImportador }) => {
  const [codigoInput, setCodigoInput] = useState('');
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(sound.isMuted());

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
    getAbaAtiva,
    getItens,
    getTotalBruto,
    getTotalLiquido,
    getTotalItens,
    getDesconto,
    adicionarProduto,
    removerItemSelecionado,
    incrementarQuantidade,
    selectedItemId,
    setDesconto,
    limparCarrinhoAbaAtual,
  } = useCartStore();

  const abaAtiva = getAbaAtiva();
  const itens = getItens();
  const desconto = getDesconto();

  const { caixa, carregarCaixa } = useCashierStore();
  const operador = useAuthStore(state => state.operador);

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
        const produto = await pdvApi.buscarProdutoPorCodigo(balancaResult.codigoProduto);
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

    // Busca padrão de produto
    try {
      const produto = await pdvApi.buscarProdutoPorCodigo(codigo);
      if (produto) {
        adicionarProduto(produto, quantidade);
        setCodigoInput('');
      } else {
        sound.playErrorBeep();
        setErroMsg(`Produto com código '${codigo}' não foi encontrado.`);
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
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950 font-sans">
      {/* 1. Barra Superior de Status */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50" />
            <span className="font-black text-lg text-white tracking-wider font-mono">PDV ATYLUS</span>
          </div>

          <button
            onClick={() => setIsCashierOpen(true)}
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 border transition ${
              isCaixaAberto
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80 hover:bg-emerald-900/60'
                : 'bg-red-950/60 text-red-400 border-red-800/80 hover:bg-red-900/60'
            }`}
          >
            {isCaixaAberto ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>CAIXA {isCaixaAberto ? 'ABERTO' : 'FECHADO'} (F3)</span>
          </button>
        </div>

        {/* Informações do Operador e Som */}
        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          <div>
            Operador: <strong className="text-slate-200">{operador.nome}</strong> ({operador.matricula})
          </div>

          <button
            title={isMuted ? 'Ativar Efeitos Sonoros' : 'Silenciar'}
            onClick={toggleSound}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </header>

      {/* 2. BARRA DE MÚLTIPLAS ABAS DE ATENDIMENTO (PDVOpen Multi-Vendas) */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-3 py-1.5 flex items-center gap-2 overflow-x-auto select-none">
        <span className="text-[11px] font-mono font-bold text-slate-500 uppercase mr-1">Vendas:</span>
        {abas.map((aba, index) => {
          const isAtiva = aba.id === abaAtivaId;
          const totalAba = aba.itens.reduce((acc, i) => acc + i.subtotal, 0);

          return (
            <div
              key={aba.id}
              onClick={() => alternarAba(aba.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 cursor-pointer transition border ${
                isAtiva
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/50'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span>{index + 1}. {aba.titulo}</span>
              {totalAba > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded ${isAtiva ? 'bg-emerald-700 text-white' : 'bg-slate-700 text-slate-300'}`}>
                  R$ {totalAba.toFixed(2)}
                </span>
              )}
              {abas.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fecharAba(aba.id);
                  }}
                  className="hover:text-red-300 rounded p-0.5 ml-0.5"
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
          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-mono font-bold flex items-center gap-1 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nova Venda</span>
          <kbd className="text-[10px] text-slate-500 bg-slate-900 px-1 rounded">Ctrl+T</kbd>
        </button>

        {abaAtiva.clienteNome && (
          <div className="ml-auto text-xs font-mono text-sky-400 flex items-center gap-1.5 bg-sky-950/60 px-2.5 py-1 rounded-lg border border-sky-800">
            <User className="w-3.5 h-3.5" />
            <span>Cliente: <strong>{abaAtiva.clienteNome}</strong></span>
          </div>
        )}
      </div>

      {/* 3. Área Principal de Venda (Lado Esquerdo 2/3 e Lado Direito 1/3) */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* LADO ESQUERDO (2/3 da Tela): Busca por Código de Barras e Tabela do Carrinho */}
        <section className="flex-[2] flex flex-col gap-3 min-w-0">
          {/* Input de Leitor de Código de Barras */}
          <form onSubmit={handleCodigoSubmit} className="relative">
            <div className="relative flex items-center">
              <Barcode className="absolute left-4 w-7 h-7 text-slate-500" />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Passe o leitor, digite código ou 3*código (Balança EAN-13 aceito automaticamente)..."
                value={codigoInput}
                onChange={e => setCodigoInput(e.target.value)}
                className="w-full pl-14 pr-28 py-3.5 bg-slate-900/90 border-2 border-slate-700 rounded-2xl text-xl font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-lg shadow-black/40 tracking-wider"
              />
              <button
                type="submit"
                className="absolute right-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-sm shadow transition"
              >
                Enter
              </button>
            </div>

            {erroMsg && (
              <div className="absolute top-full left-0 right-0 mt-1.5 p-2 bg-red-950/90 border border-red-800/80 rounded-xl text-red-300 text-xs font-mono flex items-center gap-2 z-20 shadow-xl animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{erroMsg}</span>
              </div>
            )}
          </form>

          {/* Tabela de Produtos no Carrinho */}
          <CartTable />
        </section>

        {/* LADO DIREITO (1/3 da Tela): Painel Financeiro Digital e Botões de Atalho */}
        <aside className="flex-1 flex flex-col gap-3 min-w-[320px] max-w-[420px]">
          {/* Display Digital do Caixa */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col justify-between">
            <div className="space-y-3 font-mono">
              <div className="flex justify-between items-center text-sm text-slate-400">
                <span>SUBTOTAL:</span>
                <span className="font-bold text-slate-200">R$ {getTotalBruto().toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-sm text-slate-400">
                <span>DESCONTO:</span>
                <div className="flex items-center gap-2">
                  <span className="text-red-400 font-bold">- R$ {desconto.toFixed(2)}</span>
                  <button
                    onClick={() => {
                      const desc = prompt('Informe o valor de desconto (R$):', String(desconto));
                      if (desc !== null) setDesconto(parseFloat(desc) || 0);
                    }}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                  >
                    Editar
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-800 pt-2">
                <span>TOTAL DE ITENS:</span>
                <span className="font-bold text-slate-400">{getTotalItens()}</span>
              </div>
            </div>

            {/* Total Líquido em Destaque Gigante */}
            <div className="mt-4 pt-4 border-t-2 border-dashed border-slate-800 text-right">
              <span className="text-xs text-emerald-400 font-mono tracking-widest font-bold uppercase block mb-1">
                VALOR TOTAL LÍQUIDO ({abaAtiva.titulo})
              </span>
              <div className="text-4xl lg:text-5xl font-black font-mono text-emerald-400 tracking-tight drop-shadow-[0_2px_10px_rgba(16,185,129,0.3)]">
                R$ {getTotalLiquido().toFixed(2)}
              </div>
            </div>
          </div>

          {/* Painel de Ações Rápidas por Teclado */}
          <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-2.5">
            <div className="space-y-2">
              <button
                onClick={() => {
                  if (itens.length > 0 && isCaixaAberto) setIsPaymentOpen(true);
                  else if (!isCaixaAberto) setErroMsg('Abra o caixa primeiro [F3].');
                }}
                disabled={itens.length === 0}
                className="w-full py-4 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-lg flex items-center justify-between shadow-lg shadow-emerald-500/20 active:scale-98 transition"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-6 h-6" />
                  <span>FINALIZAR VENDA</span>
                </div>
                <kbd className="px-2 py-1 rounded bg-emerald-600/60 text-slate-950 font-mono text-xs">F1</kbd>
              </button>

              <button
                onClick={() => setIsSearchOpen(true)}
                className="w-full py-3 px-4 rounded-xl bg-sky-950/60 hover:bg-sky-900/70 border border-sky-800/60 text-sky-200 font-bold text-sm flex items-center justify-between active:scale-98 transition"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-sky-400" />
                  <span>BUSCAR PRODUTO</span>
                </div>
                <kbd className="px-2 py-0.5 rounded bg-sky-900 text-sky-300 font-mono text-xs">F2</kbd>
              </button>

              <button
                onClick={() => setIsCashierOpen(true)}
                className="w-full py-3 px-4 rounded-xl bg-amber-950/60 hover:bg-amber-900/70 border border-amber-800/60 text-amber-200 font-bold text-sm flex items-center justify-between active:scale-98 transition"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>CONTROLE DE CAIXA</span>
                </div>
                <kbd className="px-2 py-0.5 rounded bg-amber-900 text-amber-300 font-mono text-xs">F3</kbd>
              </button>

              <button
                onClick={onAbrirImportador}
                className="w-full py-3 px-4 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/70 border border-indigo-800/60 text-indigo-200 font-bold text-sm flex items-center justify-between active:scale-98 transition"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                  <span>IMPORTAÇÃO IA & XML</span>
                </div>
                <kbd className="px-2 py-0.5 rounded bg-indigo-900 text-indigo-300 font-mono text-xs">F4</kbd>
              </button>
            </div>

            <button
              onClick={() => {
                if (itens.length > 0 && window.confirm('Deseja realmente limpar os itens desta venda?')) {
                  limparCarrinhoAbaAtual();
                }
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-800/60 hover:bg-red-950/50 hover:text-red-400 border border-slate-700/60 text-slate-400 text-xs font-mono font-bold flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>LIMPAR CARRINHO</span>
              </div>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono text-[10px]">Esc</kbd>
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
