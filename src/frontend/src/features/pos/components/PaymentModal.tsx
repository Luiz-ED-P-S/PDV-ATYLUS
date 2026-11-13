import React, { useState, useEffect } from 'react';
import { X, DollarSign, QrCode, CreditCard, CheckCircle2, Copy, Check, Play, Plus, Trash2, User, ShieldCheck } from 'lucide-react';
import { CobrancaPix, FormaPagamento, PagamentoItem, RecursosSistema, Venda } from '../../../types';
import { useCartStore } from '../../../store/useCartStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { pdvApi } from '../../../services/api';
import { sound } from '../../../services/sound';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVendaConcluida: (venda: Venda) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onVendaConcluida }) => {
  const { getTotalLiquido, limparCarrinhoAbaAtual, getItens, getDesconto, getAbaAtiva, setClienteAba } = useCartStore();
  const operador = useAuthStore(state => state.operador);

  const abaAtiva = getAbaAtiva();
  const total = getTotalLiquido();
  const itens = getItens();
  const desconto = getDesconto();

  // Múltiplos pagamentos lançados (PDVOpen style)
  const [pagamentosLancados, setPagamentosLancados] = useState<PagamentoItem[]>([]);
  const [formaSelecionada, setFormaSelecionada] = useState<FormaPagamento>('Dinheiro');
  const [valorParcela, setValorParcela] = useState<number>(total);
  const [dinheiroRecebido, setDinheiroRecebido] = useState<number>(total);

  // Cliente
  const [clienteNome, setClienteNome] = useState(abaAtiva.clienteNome || '');
  const [clienteDoc, setClienteDoc] = useState(abaAtiva.clienteDocumento || '');

  // Pix (cobrança persistida; a confirmação vem sempre do backend)
  const [pixInfo, setPixInfo] = useState<CobrancaPix | null>(null);
  const [pixCopiado, setPixCopiado] = useState(false);
  const [pixErro, setPixErro] = useState<string | null>(null);
  const [recursos, setRecursos] = useState<RecursosSistema | null>(null);
  const [supMatricula, setSupMatricula] = useState('');
  const [supPin, setSupPin] = useState('');
  const [supObs, setSupObs] = useState('');
  const [confirmandoPix, setConfirmandoPix] = useState(false);
  const [processando, setProcessando] = useState(false);

  // Totais calculados
  const totalPago = pagamentosLancados.reduce((acc, p) => acc + (p.valor - (p.troco || 0)), 0);
  const restante = Math.max(0, total - totalPago);
  const isQuitado = restante <= 0.009;

  useEffect(() => {
    if (isOpen) {
      setPagamentosLancados([]);
      setFormaSelecionada('Dinheiro');
      setValorParcela(total);
      setDinheiroRecebido(total);
      setPixInfo(null);
      setPixCopiado(false);
      setPixErro(null);
      setSupMatricula('');
      setSupPin('');
      setSupObs('');
      pdvApi.obterRecursos().then(setRecursos).catch(() => setRecursos(null));
      setClienteNome(abaAtiva.clienteNome || '');
      setClienteDoc(abaAtiva.clienteDocumento || '');
    }
  }, [isOpen, total, abaAtiva]);

  // Atualiza o valor padrão sugerido da parcela quando o restante mudar
  useEffect(() => {
    if (restante > 0) {
      setValorParcela(restante);
      setDinheiroRecebido(restante);
    }
  }, [restante]);

  // Gerar cobrança Pix (persistida no backend) se selecionado
  useEffect(() => {
    if (formaSelecionada === 'Pix' && isOpen && !pixInfo && !pixErro && restante > 0) {
      pdvApi
        .gerarPix(Math.round(restante * 100) / 100, 'Venda Balcão PDV')
        .then(res => setPixInfo(res))
        .catch((err: any) => setPixErro(err?.response?.data?.mensagem || 'Não foi possível gerar a cobrança Pix.'));
    }
  }, [formaSelecionada, isOpen, restante, pixInfo, pixErro]);

  /** O pagamento Pix só é lançado com a cobrança CONFIRMADA pelo backend. */
  const lancarPixConfirmado = (cobranca: CobrancaPix) => {
    if (cobranca.status !== 'Confirmada') return;
    lancarPagamento(
      'Pix',
      cobranca.valor,
      0,
      cobranca.txId,
      cobranca.confirmacaoManual ? `Confirmado manualmente por ${cobranca.supervisorMatricula} (não bancário)` : undefined
    );
  };

  // Acompanha a cobrança: lança somente quando o backend informar "Confirmada"
  useEffect(() => {
    if (formaSelecionada !== 'Pix' || !pixInfo) return;

    const interval = setInterval(async () => {
      try {
        const status = await pdvApi.consultarPix(pixInfo.txId);
        if (status.status === 'Confirmada') {
          clearInterval(interval);
          lancarPixConfirmado(status);
        } else if (status.status === 'Expirada') {
          clearInterval(interval);
          setPixErro('A cobrança Pix expirou. Selecione Pix novamente para gerar outra.');
          setPixInfo(null);
        }
      } catch {
        // falha transitória de rede: tenta de novo no próximo ciclo
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [formaSelecionada, pixInfo]);

  const handleSimularPix = async () => {
    if (!pixInfo) return;
    try {
      lancarPixConfirmado(await pdvApi.simularPagamentoPix(pixInfo.txId));
    } catch (err: any) {
      setPixErro(err?.response?.data?.mensagem || 'Simulação indisponível.');
    }
  };

  const handleConfirmarPixManual = async () => {
    if (!pixInfo || confirmandoPix) return;
    setPixErro(null);
    setConfirmandoPix(true);
    try {
      const confirmada = await pdvApi.confirmarPixManual(pixInfo.txId, supMatricula.trim().toUpperCase(), supPin, supObs.trim() || undefined);
      setSupPin('');
      lancarPixConfirmado(confirmada);
    } catch (err: any) {
      setSupPin('');
      setPixErro(err?.message || 'Não foi possível confirmar o Pix.');
      sound.playErrorBeep();
    } finally {
      setConfirmandoPix(false);
    }
  };

  const trocoCalculado = formaSelecionada === 'Dinheiro' ? Math.max(0, dinheiroRecebido - valorParcela) : 0;

  const lancarPagamento = (forma: FormaPagamento, valor: number, troco = 0, txId?: string, confirmacaoManual?: string) => {
    if (valor <= 0) return;
    const novo: PagamentoItem = {
      id: 'pag-' + Date.now(),
      forma,
      valor,
      troco,
      txId,
      confirmacaoManual,
    };
    setPagamentosLancados(prev => [...prev, novo]);
    sound.playScanBeep();
    setPixInfo(null);
    setPixErro(null);
  };

  const removerPagamento = (id: string) => {
    setPagamentosLancados(prev => prev.filter(p => p.id !== id));
  };

  const handleFinalizarTudo = async () => {
    if (!isQuitado || processando) return;
    setProcessando(true);

    try {
      setClienteAba(clienteNome, clienteDoc);

      const venda = await pdvApi.criarVenda({
        operadorId: operador.id,
        desconto,
        clienteNome: clienteNome || undefined,
        clienteDocumento: clienteDoc || undefined,
        itens: itens.map(i => ({
          produtoId: i.produtoId,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
        })),
        pagamentos: pagamentosLancados.map(p => ({
          formaPagamento: p.forma === 'Dinheiro' ? 1 : p.forma === 'Pix' ? 2 : p.forma === 'CartaoCredito' ? 3 : 4,
          valor: p.valor,
          troco: p.troco || 0,
          txId: p.txId,
        })),
      });

      venda.clienteNome = clienteNome;
      venda.clienteDocumento = clienteDoc;

      // Disparo automático de impressão térmica ESC/POS se configurado
      try {
        const printerRaw = localStorage.getItem('pdv_printer_config_v1');
        const printerConfig = printerRaw ? JSON.parse(printerRaw) : null;
        if (printerConfig?.imprimirAutomatico !== false) {
          const temDinheiro = pagamentosLancados.some(p => p.forma === 'Dinheiro');
          pdvApi.imprimirVenda(venda.id, temDinheiro && (printerConfig?.acionarGaveta ?? true), printerConfig);
        }
      } catch {
        // Impressão em segundo plano sem bloquear o caixa
      }

      sound.playSuccessChime();
      limparCarrinhoAbaAtual();
      onClose();
      onVendaConcluida(venda);
    } finally {
      setProcessando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 max-h-[95vh]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Pagamento Multiformas (F1) - {abaAtiva.titulo}</h2>
              <p className="text-xs text-slate-400">Suporte a divisão em múltiplas formas de pagamento (PDVOpen)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumo Financeiro Superior */}
        <div className="grid grid-cols-3 p-5 bg-slate-950/70 border-b border-slate-800 gap-4 text-center font-mono">
          <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800">
            <span className="text-xs text-slate-400 uppercase">Total da Venda</span>
            <div className="text-2xl font-bold text-white mt-0.5">R$ {total.toFixed(2)}</div>
          </div>
          <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800">
            <span className="text-xs text-slate-400 uppercase">Total Pago</span>
            <div className="text-2xl font-bold text-sky-400 mt-0.5">R$ {totalPago.toFixed(2)}</div>
          </div>
          <div className={`p-3 rounded-2xl border ${isQuitado ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400' : 'bg-amber-950/40 border-amber-800 text-amber-400'}`}>
            <span className="text-xs uppercase font-bold">{isQuitado ? 'Venda Quitada' : 'Saldo Restante'}</span>
            <div className="text-2xl font-extrabold mt-0.5">R$ {restante.toFixed(2)}</div>
          </div>
        </div>

        {/* Corpo do Modal: Divisão em 2 colunas */}
        <div className="flex-1 flex overflow-hidden">
          {/* Coluna Esquerda: Lançar Nova Parcela */}
          <div className="flex-1 p-6 border-r border-slate-800 overflow-y-auto space-y-5">
            {/* Identificação Opcional do Cliente */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-400 uppercase">
                <User className="w-3.5 h-3.5 text-sky-400" />
                <span>Identificar Cliente no Cupom (Opcional):</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nome do cliente"
                  value={clienteNome}
                  onChange={e => setClienteNome(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="CPF / CNPJ"
                  value={clienteDoc}
                  onChange={e => setClienteDoc(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            {/* Seleção de Forma de Pagamento */}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-2 uppercase font-bold">
                Escolha a forma da parcela:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['Dinheiro', 'Pix', 'CartaoCredito', 'CartaoDebito'] as FormaPagamento[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFormaSelecionada(f)}
                    className={`p-2.5 rounded-xl text-xs font-mono font-bold border transition flex flex-col items-center gap-1 ${
                      formaSelecionada === f
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                        : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {f === 'Dinheiro' && <DollarSign className="w-4 h-4" />}
                    {f === 'Pix' && <QrCode className="w-4 h-4" />}
                    {f === 'CartaoCredito' && <CreditCard className="w-4 h-4" />}
                    {f === 'CartaoDebito' && <CreditCard className="w-4 h-4" />}
                    <span>{f === 'CartaoCredito' ? 'Crédito' : f === 'CartaoDebito' ? 'Débito' : f}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Campos de Valor */}
            {formaSelecionada === 'Dinheiro' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-mono text-slate-400">Valor da Parcela (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      max={restante}
                      value={valorParcela || ''}
                      onFocus={e => e.target.select()}
                      onChange={e => setValorParcela(e.target.value === '' ? 0 : Math.min(restante, parseFloat(e.target.value) || 0))}
                      className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xl font-bold font-mono text-white mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-slate-400">Dinheiro Entregue (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={dinheiroRecebido || ''}
                      onFocus={e => e.target.select()}
                      onChange={e => setDinheiroRecebido(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xl font-bold font-mono text-white mt-1"
                    />
                  </div>
                </div>

                {trocoCalculado > 0 && (
                  <div className="p-3 bg-amber-950/40 border border-amber-800 rounded-xl flex justify-between items-center text-amber-300 font-mono text-sm">
                    <span>TROCO CALCULADO:</span>
                    <span className="font-extrabold text-lg">R$ {trocoCalculado.toFixed(2)}</span>
                  </div>
                )}

                <button
                  disabled={valorParcela <= 0}
                  onClick={() => lancarPagamento('Dinheiro', valorParcela, trocoCalculado)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-xl flex items-center justify-center gap-2 font-mono text-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Lançar R$ {valorParcela.toFixed(2)} em Dinheiro</span>
                </button>
              </div>
            )}

            {formaSelecionada === 'Pix' && (
              <div className="text-center space-y-3">
                {pixErro && (
                  <div className="p-2 bg-rose-950/60 border border-rose-800 rounded-lg text-[11px] text-rose-300">{pixErro}</div>
                )}
                {pixInfo ? (
                  <>
                    <div className="text-xs font-mono text-slate-300">
                      Cobrança <span className="text-white font-bold">{pixInfo.txId}</span> • R$ {pixInfo.valor.toFixed(2)}
                      <span className="block text-[10px] text-slate-500">Aguardando confirmação do recebimento…</span>
                    </div>

                    {pixInfo.qrCodeBase64 ? (
                      <>
                        {pixInfo.simulada && (
                          <div className="px-2 py-1 bg-amber-950/60 border border-amber-700 rounded text-[10px] text-amber-300 font-bold uppercase">
                            Simulação — este QR Code não é uma cobrança bancária
                          </div>
                        )}
                        <div className="inline-block p-2 bg-white rounded-xl shadow-lg">
                          <img src={pixInfo.qrCodeBase64} alt="QR Code" className="w-32 h-32" />
                        </div>
                        {pixInfo.copiaECola && (
                          <div className="flex justify-center">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(pixInfo.copiaECola || '');
                                setPixCopiado(true);
                                setTimeout(() => setPixCopiado(false), 1500);
                              }}
                              className="px-3 py-1.5 bg-slate-800 text-xs text-slate-300 rounded-lg flex items-center gap-1 font-mono"
                            >
                              {pixCopiado ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{pixCopiado ? 'Copiado!' : 'Copiar Chave'}</span>
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-slate-300 text-left">
                        {pixInfo.instrucoes}
                      </div>
                    )}

                    {/* Simulação: só quando o SERVIDOR habilitar (desenvolvimento/testes); confirmada pelo backend */}
                    {recursos?.pixSimulacaoHabilitada && pixInfo.simulada && (
                      <button
                        onClick={handleSimularPix}
                        className="mx-auto px-3 py-1.5 bg-sky-950 hover:bg-sky-900 border border-sky-800 text-xs text-sky-300 rounded-lg flex items-center gap-1 font-mono font-bold"
                      >
                        <Play className="w-3.5 h-3.5 text-sky-400" />
                        <span>Simular pagamento (ambiente de testes)</span>
                      </button>
                    )}

                    {/* Confirmação manual supervisionada (não bancária) */}
                    <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl space-y-2 text-left">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Confirmação manual do recebimento (Supervisor)
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Use somente após conferir o crédito no aplicativo do banco. Fica registrado como confirmação manual, não bancária.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Matrícula do Supervisor"
                          value={supMatricula}
                          onChange={e => setSupMatricula(e.target.value.toUpperCase())}
                          className="px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono"
                        />
                        <input
                          type="password"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="PIN do Supervisor"
                          value={supPin}
                          onChange={e => setSupPin(e.target.value)}
                          className="px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Observação (opcional)"
                        maxLength={300}
                        value={supObs}
                        onChange={e => setSupObs(e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                      />
                      <button
                        onClick={handleConfirmarPixManual}
                        disabled={confirmandoPix || !supMatricula.trim() || !supPin}
                        className="w-full py-1.5 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-xs text-white font-bold rounded-lg"
                      >
                        {confirmandoPix ? 'Validando…' : 'Confirmar recebimento'}
                      </button>
                    </div>
                  </>
                ) : (
                  !pixErro && <div className="text-xs text-slate-400 font-mono">Gerando cobrança Pix...</div>
                )}
                {!pixInfo && pixErro && (
                  <button
                    onClick={() => setPixErro(null)}
                    className="px-3 py-1.5 bg-slate-800 text-xs text-slate-300 rounded-lg font-mono"
                  >
                    Gerar nova cobrança
                  </button>
                )}
              </div>
            )}

            {(formaSelecionada === 'CartaoCredito' || formaSelecionada === 'CartaoDebito') && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-mono text-slate-400">Valor a passar no Cartão (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    max={restante}
                    value={valorParcela || ''}
                    onFocus={e => e.target.select()}
                    onChange={e => setValorParcela(e.target.value === '' ? 0 : Math.min(restante, parseFloat(e.target.value) || 0))}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xl font-bold font-mono text-white mt-1"
                  />
                </div>
                <button
                  disabled={valorParcela <= 0}
                  onClick={() => lancarPagamento(formaSelecionada, valorParcela)}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl flex items-center justify-center gap-2 font-mono text-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Confirmar R$ {valorParcela.toFixed(2)} no {formaSelecionada === 'CartaoCredito' ? 'Crédito' : 'Débito'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Coluna Direita: Lista de Pagamentos Lançados */}
          <div className="w-80 p-6 bg-slate-950/40 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-mono font-bold text-slate-400 uppercase mb-3">
                Pagamentos Lançados nesta Venda:
              </h3>

              {pagamentosLancados.length === 0 ? (
                <div className="p-8 text-center text-slate-600 text-xs font-mono border border-dashed border-slate-800 rounded-2xl">
                  Nenhum pagamento lançado ainda. Selecione uma forma ao lado.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {pagamentosLancados.map(p => (
                    <div key={p.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center text-xs font-mono">
                      <div>
                        <span className="font-bold text-white block">{p.forma}</span>
                        {p.confirmacaoManual && (
                          <span className="text-[10px] text-amber-300 block">{p.confirmacaoManual}</span>
                        )}
                        {p.troco && p.troco > 0 ? (
                          <span className="text-[10px] text-amber-400">Troco: R$ {p.troco.toFixed(2)}</span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">R$ {p.valor.toFixed(2)}</span>
                        <button
                          onClick={() => removerPagamento(p.id)}
                          className="p-1 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botão Final de Fechamento */}
            <div className="pt-4 border-t border-slate-800">
              <button
                disabled={!isQuitado || processando}
                onClick={handleFinalizarTudo}
                className={`w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition font-mono ${
                  isQuitado
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-95'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{isQuitado ? 'Concluir Venda (Enter)' : `Faltam R$ ${restante.toFixed(2)}`}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
