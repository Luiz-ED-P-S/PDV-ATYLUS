import React, { useState, useEffect } from 'react';
import { X, DollarSign, QrCode, CreditCard, CheckCircle2, Copy, Check, Play } from 'lucide-react';
import { FormaPagamento, PixGenerateResult, Venda } from '../../../types';
import { useCartStore } from '../../../store/useCartStore';
import { useCashierStore } from '../../../store/useCashierStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { pdvApi } from '../../../services/api';
import { sound } from '../../../services/sound';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVendaConcluida: (venda: Venda) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onVendaConcluida }) => {
  const { itens, getTotalLiquido, limparCarrinho, desconto } = useCartStore();
  const caixa = useCashierStore(state => state.caixa);
  const operador = useAuthStore(state => state.operador);

  const total = getTotalLiquido();

  const [formaSelecionada, setFormaSelecionada] = useState<FormaPagamento>('Dinheiro');
  const [valorRecebido, setValorRecebido] = useState<number>(total);
  const [pixInfo, setPixInfo] = useState<PixGenerateResult | null>(null);
  const [pixCopiado, setPixCopiado] = useState(false);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValorRecebido(total);
      setPixInfo(null);
      setPixCopiado(false);
      setFormaSelecionada('Dinheiro');
    }
  }, [isOpen, total]);

  // Efeito para gerar Pix quando a forma Pix for selecionada
  useEffect(() => {
    if (formaSelecionada === 'Pix' && isOpen && !pixInfo) {
      pdvApi.gerarPix(total, 'Venda Balcão PDV').then(res => setPixInfo(res));
    }
  }, [formaSelecionada, isOpen, total, pixInfo]);

  // Polling automático de status do Pix a cada 2 segundos
  useEffect(() => {
    if (formaSelecionada !== 'Pix' || !pixInfo) return;

    const interval = setInterval(async () => {
      const status = await pdvApi.consultarPix(pixInfo.txId);
      if (status.pago) {
        clearInterval(interval);
        finalizarVenda('Pix', pixInfo.txId);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [formaSelecionada, pixInfo]);

  const troco = Math.max(0, valorRecebido - total);

  const finalizarVenda = async (forma: FormaPagamento, txId?: string) => {
    if (processando) return;
    setProcessando(true);

    try {
      const formaNum = forma === 'Dinheiro' ? 1 : forma === 'Pix' ? 2 : forma === 'CartaoCredito' ? 3 : 4;

      const venda = await pdvApi.criarVenda({
        operadorId: operador.id,
        desconto,
        itens: itens.map(i => ({
          produtoId: i.produtoId,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
        })),
        pagamentos: [
          {
            formaPagamento: formaNum,
            valor: forma === 'Dinheiro' ? valorRecebido : total,
            troco: forma === 'Dinheiro' ? troco : 0,
            txId,
          },
        ],
      });

      sound.playSuccessChime();
      limparCarrinho();
      onClose();
      onVendaConcluida(venda);
    } finally {
      setProcessando(false);
    }
  };

  const copiarPix = () => {
    if (pixInfo) {
      navigator.clipboard.writeText(pixInfo.copiaECola);
      setPixCopiado(true);
      setTimeout(() => setPixCopiado(false), 2000);
    }
  };

  const simularPagamentoPix = async () => {
    if (pixInfo) {
      await pdvApi.simularPagamentoPix(pixInfo.txId);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Finalização de Pagamento (F1)</h2>
              <p className="text-xs text-slate-400">Selecione o método de pagamento e confirme</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumo do Valor */}
        <div className="p-6 bg-slate-950/60 border-b border-slate-800 flex justify-between items-center">
          <span className="text-slate-400 font-medium">TOTAL A PAGAR:</span>
          <span className="text-4xl font-extrabold font-mono text-emerald-400 tracking-tight">
            R$ {total.toFixed(2)}
          </span>
        </div>

        {/* Formas de Pagamento em Abas */}
        <div className="grid grid-cols-4 p-4 gap-3 bg-slate-900 border-b border-slate-800">
          <button
            onClick={() => setFormaSelecionada('Dinheiro')}
            className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-2 border font-medium transition ${
              formaSelecionada === 'Dinheiro'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-950/50'
                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <DollarSign className="w-6 h-6" />
            <span className="text-xs font-mono font-bold">[1] Dinheiro</span>
          </button>

          <button
            onClick={() => setFormaSelecionada('Pix')}
            className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-2 border font-medium transition ${
              formaSelecionada === 'Pix'
                ? 'bg-sky-600 text-white border-sky-500 shadow-lg shadow-sky-950/50'
                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <QrCode className="w-6 h-6" />
            <span className="text-xs font-mono font-bold">[2] Pix Automático</span>
          </button>

          <button
            onClick={() => setFormaSelecionada('CartaoCredito')}
            className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-2 border font-medium transition ${
              formaSelecionada === 'CartaoCredito'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-950/50'
                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <CreditCard className="w-6 h-6" />
            <span className="text-xs font-mono font-bold">[3] Crédito</span>
          </button>

          <button
            onClick={() => setFormaSelecionada('CartaoDebito')}
            className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-2 border font-medium transition ${
              formaSelecionada === 'CartaoDebito'
                ? 'bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-950/50'
                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <CreditCard className="w-6 h-6" />
            <span className="text-xs font-mono font-bold">[4] Débito</span>
          </button>
        </div>

        {/* Conteúdo Dinâmico por Forma de Pagamento */}
        <div className="p-6 flex-1 min-h-[260px] flex flex-col justify-center">
          {formaSelecionada === 'Dinheiro' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
                    Valor Recebido em Dinheiro (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={total}
                    value={valorRecebido}
                    onChange={e => setValorRecebido(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-2xl font-bold font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-center">
                  <span className="text-xs font-mono text-slate-400 uppercase">Troco a Devolver:</span>
                  <span className={`text-3xl font-extrabold font-mono mt-1 ${troco > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    R$ {troco.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Botões rápidos de cédulas */}
              <div className="flex gap-2">
                <span className="text-xs text-slate-500 self-center font-mono mr-2">Cédulas rápidas:</span>
                {[10, 20, 50, 100].map(cedula => (
                  <button
                    key={cedula}
                    onClick={() => setValorRecebido(cedula >= total ? cedula : valorRecebido + cedula)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono text-sm font-semibold transition"
                  >
                    + R$ {cedula}
                  </button>
                ))}
              </div>
            </div>
          )}

          {formaSelecionada === 'Pix' && (
            <div className="flex flex-col items-center text-center space-y-4">
              {pixInfo ? (
                <>
                  <div className="p-3 bg-white rounded-2xl shadow-xl">
                    <img src={pixInfo.qrCodeBase64} alt="QR Code Pix" className="w-44 h-44" />
                  </div>
                  <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Aguardando confirmação bancária em tempo real...</span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={copiarPix}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium text-slate-300 flex items-center gap-2 transition"
                    >
                      {pixCopiado ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{pixCopiado ? 'Chave Copiada!' : 'Copiar Código Pix'}</span>
                    </button>

                    <button
                      onClick={simularPagamentoPix}
                      className="px-4 py-2 bg-sky-950 hover:bg-sky-900 border border-sky-800 rounded-xl text-sm font-medium text-sky-300 flex items-center gap-2 transition"
                    >
                      <Play className="w-4 h-4 text-sky-400" />
                      <span>Simular Aprovação (Offline)</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-slate-500 font-mono">Gerando QR Code Pix...</div>
              )}
            </div>
          )}

          {(formaSelecionada === 'CartaoCredito' || formaSelecionada === 'CartaoDebito') && (
            <div className="flex flex-col items-center justify-center space-y-3 py-6">
              <CreditCard className="w-16 h-16 text-indigo-400 animate-pulse" />
              <h4 className="text-lg font-bold text-slate-200">
                Aproxime ou insira o cartão na Maquininha TEF / POS
              </h4>
              <p className="text-sm text-slate-500 max-w-md text-center">
                Aguarde o processamento na maquininha externa e clique em "Confirmar Venda" após a impressão do comprovante.
              </p>
            </div>
          )}
        </div>

        {/* Rodapé com Botão de Confirmação */}
        <div className="p-5 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium font-mono text-sm transition"
          >
            [Esc] Cancelar
          </button>

          <button
            disabled={processando || (formaSelecionada === 'Dinheiro' && valorRecebido < total)}
            onClick={() => finalizarVenda(formaSelecionada)}
            className="px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold text-base flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition active:scale-95"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{processando ? 'Processando...' : 'Confirmar e Finalizar Venda (Enter)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
