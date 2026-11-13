import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Unlock,
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  AlertCircle,
  Coins,
  Receipt,
} from 'lucide-react';
import { useCashierStore } from '../../store/useCashierStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { sound } from '../../services/sound';

interface CashierModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CashierModal: React.FC<CashierModalProps> = ({ isOpen, onClose }) => {
  const { caixa, abrirCaixa, registrarMovimentacao, fecharCaixaCego, carregarCaixa } = useCashierStore();
  const operador = useAuthStore(state => state.operador);
  const theme = useThemeStore(state => state.theme);

  const isAberto = caixa && (caixa.status === 'Aberto' || (caixa as any).status === 1);

  const [aba, setAba] = useState<'status' | 'abrir' | 'sangria' | 'suprimento' | 'fechar'>('status');

  // Form states
  const [saldoInicial, setSaldoInicial] = useState<number>(100);
  const [valorMov, setValorMov] = useState<number>(50);
  const [motivoMov, setMotivoMov] = useState('');
  const [saldoContado, setSaldoContado] = useState<number>(0);
  const [obsFechamento, setObsFechamento] = useState('');
  const [resultadoFechamento, setResultadoFechamento] = useState<any>(null);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      carregarCaixa();
      setErroMsg(null);
      setSucessoMsg(null);
      if (!isAberto) {
        setAba('abrir');
      } else {
        setAba('status');
      }
    }
  }, [isOpen, isAberto, carregarCaixa]);

  if (!isOpen) return null;

  const handleAbrir = async () => {
    setErroMsg(null);
    if (saldoInicial < 0) {
      setErroMsg('O saldo inicial não pode ser negativo.');
      sound.playErrorBeep();
      return;
    }
    setProcessando(true);
    try {
      await abrirCaixa(operador.id || 'OP01', saldoInicial);
      sound.playSuccessChime();
      setSucessoMsg('Caixa aberto com sucesso com fundo de troco!');
      setTimeout(() => {
        setSucessoMsg(null);
        setAba('status');
      }, 1500);
    } catch (err: any) {
      sound.playErrorBeep();
      const msg = err.response?.data?.message || err.message || 'Erro ao abrir caixa.';
      setErroMsg(`Falha na abertura: ${msg}`);
    } finally {
      setProcessando(false);
    }
  };

  const handleExecutarMovimentacao = async (tipo: 'Sangria' | 'Suprimento') => {
    setErroMsg(null);
    if (valorMov <= 0) {
      setErroMsg('Informe um valor maior que zero.');
      sound.playErrorBeep();
      return;
    }
    if (!motivoMov.trim()) {
      setErroMsg(`Informe a justificativa / motivo da ${tipo.toLowerCase()}.`);
      sound.playErrorBeep();
      return;
    }
    setProcessando(true);
    try {
      await registrarMovimentacao(tipo, valorMov, motivoMov.trim(), operador.id || 'OP01');
      sound.playSuccessChime();
      setSucessoMsg(`${tipo} de R$ ${valorMov.toFixed(2)} registrada com sucesso!`);
      setTimeout(() => {
        setSucessoMsg(null);
        setMotivoMov('');
        setValorMov(50);
        setAba('status');
      }, 1500);
    } catch (err: any) {
      sound.playErrorBeep();
      const msg = err.response?.data?.message || err.message || `Erro ao registrar ${tipo}.`;
      setErroMsg(msg);
    } finally {
      setProcessando(false);
    }
  };

  const handleFecharCego = async () => {
    setErroMsg(null);
    setProcessando(true);
    try {
      const res = await fecharCaixaCego(saldoContado, obsFechamento);
      sound.playSuccessChime();
      setResultadoFechamento(res);
      setSucessoMsg('Caixa fechado com sucesso!');
      await carregarCaixa();
    } catch (err: any) {
      sound.playErrorBeep();
      const msg = err.response?.data?.message || err.message || 'Erro ao fechar caixa.';
      setErroMsg(msg);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 font-sans">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-xs ${
                isAberto
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-rose-50 text-rose-600 border-rose-200'
              }`}
            >
              {isAberto ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Central de Caixa (F3)</h2>
              <p className="text-xs text-slate-500 font-medium">
                Status:{' '}
                <strong className={isAberto ? 'text-emerald-600' : 'text-rose-600'}>
                  {isAberto ? 'ABERTO' : 'FECHADO'}
                </strong>{' '}
                • Operador: <strong className="text-slate-800">{operador.nome}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback visual de Sucesso / Erro */}
        {sucessoMsg && (
          <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{sucessoMsg}</span>
          </div>
        )}

        {erroMsg && (
          <div className="px-5 py-3 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{erroMsg}</span>
          </div>
        )}

        {/* Abas */}
        <div className="flex border-b border-slate-100 bg-slate-50/40 p-2 gap-1.5 overflow-x-auto">
          <button
            onClick={() => setAba('status')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              aba === 'status'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Visão Geral</span>
          </button>

          {!isAberto && (
            <button
              onClick={() => setAba('abrir')}
              style={aba === 'abrir' ? { backgroundColor: theme.corPrimaria } : undefined}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                aba === 'abrir' ? 'text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Abrir Caixa</span>
            </button>
          )}

          {isAberto && (
            <>
              <button
                onClick={() => setAba('suprimento')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  aba === 'suprimento' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>Suprimento (Troco)</span>
              </button>

              <button
                onClick={() => setAba('sangria')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  aba === 'sangria' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Sangria (Retirada)</span>
              </button>

              <button
                onClick={() => { setAba('fechar'); setResultadoFechamento(null); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  aba === 'fechar' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Fechamento Cego</span>
              </button>
            </>
          )}
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          {aba === 'status' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Saldo Inicial (Troco)</span>
                  <p className="text-2xl font-black font-mono text-slate-900 mt-1">
                    R$ {(caixa?.saldoInicial || 0).toFixed(2)}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Movimentações do Turno</span>
                  <p className="text-2xl font-black font-mono text-indigo-600 mt-1">
                    {caixa?.movimentacoes?.length || 0} lançamentos
                  </p>
                </div>
              </div>

              {/* Histórico Recente de Sangrias e Suprimentos */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-slate-400" />
                  <span>Histórico de Lançamentos do Turno</span>
                </h4>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200/80 rounded-2xl bg-slate-50/50">
                  {caixa?.movimentacoes && caixa.movimentacoes.length > 0 ? (
                    caixa.movimentacoes.map(m => (
                      <div key={m.id} className="p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          {m.tipo === 'Suprimento' ? (
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                              <ArrowDownRight className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                              <ArrowUpRight className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-900">{m.tipo}:</span>{' '}
                            <span className="text-slate-600">{m.motivo}</span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {new Date(m.dataHora).toLocaleTimeString('pt-BR')} • {m.operadorId}
                            </span>
                          </div>
                        </div>
                        <span className={`font-mono font-black text-sm ${m.tipo === 'Suprimento' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {m.tipo === 'Suprimento' ? '+' : '-'} R$ {m.valor.toFixed(2)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-slate-400 text-xs font-medium">
                      Nenhum suprimento ou sangria registrado até o momento.
                    </div>
                  )}
                </div>
              </div>

              {!isAberto && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>O caixa está fechado no momento. Abra-o para iniciar vendas.</span>
                  </div>
                  <button
                    onClick={() => setAba('abrir')}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition"
                  >
                    Abrir Agora
                  </button>
                </div>
              )}
            </div>
          )}

          {aba === 'abrir' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Saldo Inicial de Abertura / Fundo de Troco (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={saldoInicial || ''}
                  onFocus={e => e.target.select()}
                  onChange={e => setSaldoInicial(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Valor em cédulas e moedas disponível na gaveta para iniciar os atendimentos.
                </span>
              </div>

              <button
                disabled={processando}
                onClick={handleAbrir}
                style={{ backgroundColor: theme.corPrimaria }}
                className="w-full py-4 text-white font-black text-sm rounded-2xl shadow-md hover:opacity-90 active:scale-98 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                <span>{processando ? 'Abrindo Caixa...' : 'Confirmar Abertura do Caixa'}</span>
              </button>
            </div>
          )}

          {aba === 'suprimento' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Valor do Suprimento / Troco Adicional (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorMov || ''}
                  onFocus={e => e.target.select()}
                  onChange={e => setValorMov(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black font-mono text-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Motivo / Justificativa
                </label>
                <input
                  type="text"
                  placeholder="Ex: Troco adicional para moedas"
                  value={motivoMov}
                  onChange={e => setMotivoMov(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none"
                />
              </div>

              <button
                disabled={processando}
                onClick={() => handleExecutarMovimentacao('Suprimento')}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2"
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>{processando ? 'Registrando...' : 'Confirmar Entrada de Suprimento'}</span>
              </button>
            </div>
          )}

          {aba === 'sangria' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Valor da Sangria / Retirada (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorMov || ''}
                  onFocus={e => e.target.select()}
                  onChange={e => setValorMov(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black font-mono text-amber-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Motivo / Destino da Retirada
                </label>
                <input
                  type="text"
                  placeholder="Ex: Recolhimento de excesso para o cofre"
                  value={motivoMov}
                  onChange={e => setMotivoMov(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none"
                />
              </div>

              <button
                disabled={processando}
                onClick={() => handleExecutarMovimentacao('Sangria')}
                className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>{processando ? 'Registrando...' : 'Confirmar Saída de Sangria'}</span>
              </button>
            </div>
          )}

          {aba === 'fechar' && (
            <div className="space-y-4">
              {!resultadoFechamento ? (
                <>
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs">
                    <strong>Atenção:</strong> O Fechamento Cego garante segurança para o operador e para o lojista. O operador digita apenas o valor em dinheiro físico contado na gaveta, sem ver o saldo esperado pelo sistema.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                      Total Contado na Gaveta Física (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={saldoContado || ''}
                      onFocus={e => e.target.select()}
                      onChange={e => setSaldoContado(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black font-mono text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                      Observações de Fechamento (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Turno encerrado sem ocorrências..."
                      value={obsFechamento}
                      onChange={e => setObsFechamento(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <button
                    disabled={processando}
                    onClick={handleFecharCego}
                    className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2"
                  >
                    <Calculator className="w-4 h-4" />
                    <span>{processando ? 'Processando Fechamento...' : 'Concluir Fechamento Cego'}</span>
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs">
                    <h4 className="font-bold text-sm mb-1">Turno Fechado com Sucesso!</h4>
                    <p>Relatório de conciliação gerado com as movimentações do turno.</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Informado</span>
                      <span className="font-mono font-bold text-slate-800 text-sm">
                        R$ {saldoContado.toFixed(2)}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Esperado</span>
                      <span className="font-mono font-bold text-slate-800 text-sm">
                        R$ {(resultadoFechamento.saldoEsperado || resultadoFechamento.saldoFinal || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Diferença</span>
                      <span className={`font-mono font-bold text-sm ${
                        (resultadoFechamento.diferenca || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        R$ {(resultadoFechamento.diferenca || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setResultadoFechamento(null);
                      onClose();
                    }}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl transition"
                  >
                    Fechar Janela
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
