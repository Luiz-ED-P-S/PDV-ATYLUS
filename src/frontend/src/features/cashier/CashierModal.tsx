import React, { useState } from 'react';
import { X, Lock, Unlock, ArrowDownRight, ArrowUpRight, Calculator, CheckCircle2 } from 'lucide-react';
import { useCashierStore } from '../../store/useCashierStore';
import { useAuthStore } from '../../store/useAuthStore';

interface CashierModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CashierModal: React.FC<CashierModalProps> = ({ isOpen, onClose }) => {
  const { caixa, abrirCaixa, registrarMovimentacao, fecharCaixaCego } = useCashierStore();
  const operador = useAuthStore(state => state.operador);

  const [aba, setAba] = useState<'status' | 'abrir' | 'sangria' | 'suprimento' | 'fechar'>('status');

  // Form states
  const [saldoInicial, setSaldoInicial] = useState<number>(100);
  const [valorMov, setValorMov] = useState<number>(50);
  const [motivoMov, setMotivoMov] = useState('');
  const [saldoContado, setSaldoContado] = useState<number>(0);
  const [obsFechamento, setObsFechamento] = useState('');
  const [resultadoFechamento, setResultadoFechamento] = useState<any>(null);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAberto = caixa && caixa.status === 'Aberto';

  const handleAbrir = async () => {
    await abrirCaixa(operador.id, saldoInicial);
    setSucessoMsg('Caixa aberto com sucesso com fundo de troco inicial!');
    setTimeout(() => setSucessoMsg(null), 3000);
    setAba('status');
  };

  const handleExecutarMovimentacao = async (tipo: 'Sangria' | 'Suprimento') => {
    if (valorMov <= 0 || !motivoMov) return;
    await registrarMovimentacao(tipo, valorMov, motivoMov, operador.id);
    setSucessoMsg(`${tipo} de R$ ${valorMov.toFixed(2)} registrada e comprovante emitido!`);
    setTimeout(() => setSucessoMsg(null), 3500);
    setMotivoMov('');
    setValorMov(50);
    setAba('status');
  };

  const handleFecharCego = async () => {
    const res = await fecharCaixaCego(saldoContado, obsFechamento);
    setResultadoFechamento(res);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAberto ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
              {isAberto ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Central de Caixa (F2) — ATYLUS PDV</h2>
              <p className="text-xs text-slate-400">
                Status: <strong className={isAberto ? 'text-emerald-400' : 'text-red-400'}>{isAberto ? 'ABERTO' : 'FECHADO'}</strong> • Operador: {operador.nome}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem de Sucesso Flutuante */}
        {sucessoMsg && (
          <div className="px-5 py-2.5 bg-emerald-950/70 border-b border-emerald-800 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{sucessoMsg}</span>
          </div>
        )}

        {/* Abas Estilo PDVOpen */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 p-2 gap-1.5 overflow-x-auto">
          <button
            onClick={() => setAba('status')}
            className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 ${aba === 'status' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Visão Geral
          </button>

          {!isAberto && (
            <button
              onClick={() => setAba('abrir')}
              className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold transition ${aba === 'abrir' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Abrir Caixa
            </button>
          )}

          {isAberto && (
            <>
              <button
                onClick={() => setAba('sangria')}
                className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 ${aba === 'sangria' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-amber-400'}`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" /> Sangria (Retirada)
              </button>
              <button
                onClick={() => setAba('suprimento')}
                className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 ${aba === 'suprimento' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-400'}`}
              >
                <ArrowDownRight className="w-3.5 h-3.5" /> Suprimento (Troco)
              </button>
              <button
                onClick={() => { setAba('fechar'); setResultadoFechamento(null); }}
                className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 ${aba === 'fechar' ? 'bg-red-600/90 text-white' : 'text-slate-400 hover:text-red-400'}`}
              >
                <Calculator className="w-3.5 h-3.5" /> Fechamento Cego
              </button>
            </>
          )}
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          {aba === 'status' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-xs text-slate-500 font-mono">SALDO INICIAL</span>
                  <p className="text-2xl font-bold font-mono text-slate-200 mt-1">
                    R$ {(caixa?.saldoInicial || 0).toFixed(2)}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-xs text-slate-500 font-mono">TOTAL MOVIMENTAÇÕES</span>
                  <p className="text-2xl font-bold font-mono text-sky-400 mt-1">
                    {caixa?.movimentacoes.length || 0} registros
                  </p>
                </div>
              </div>

              {/* Histórico Recente de Sangrias e Suprimentos */}
              <div className="mt-4">
                <h4 className="text-xs font-bold font-mono text-slate-400 mb-2 uppercase">Histórico de Sangrias e Suprimentos do Turno:</h4>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-950">
                  {caixa?.movimentacoes && caixa.movimentacoes.length > 0 ? (
                    caixa.movimentacoes.map(m => (
                      <div key={m.id} className="p-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {m.tipo === 'Suprimento' ? (
                            <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 text-amber-400" />
                          )}
                          <div>
                            <span className="font-bold text-slate-200">{m.tipo}:</span> {m.motivo}
                          </div>
                        </div>
                        <span className={`font-mono font-bold ${m.tipo === 'Suprimento' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {m.tipo === 'Suprimento' ? '+' : '-'} R$ {m.valor.toFixed(2)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-500 text-xs">Nenhuma sangria ou suprimento registrado até o momento.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {aba === 'abrir' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
                  Saldo Inicial de Abertura / Fundo de Troco (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={saldoInicial}
                  onChange={e => setSaldoInicial(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-xl font-bold font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                onClick={handleAbrir}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition"
              >
                Confirmar Abertura do Caixa
              </button>
            </div>
          )}

          {aba === 'sangria' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300">
                <strong>Sangria de Caixa:</strong> Retirada de numerário em dinheiro da gaveta por segurança (ex: envio para cofre ou sangria preventiva).
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Valor a Retirar (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorMov}
                  onChange={e => setValorMov(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-2xl font-bold font-mono text-amber-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Motivo / Destino da Sangria</label>
                <input
                  type="text"
                  placeholder="Ex: Recolhimento de excesso para o cofre central"
                  value={motivoMov}
                  onChange={e => setMotivoMov(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                disabled={valorMov <= 0 || !motivoMov}
                onClick={() => handleExecutarMovimentacao('Sangria')}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
              >
                <ArrowUpRight className="w-5 h-5" />
                <span>Confirmar e Emitir Comprovante de Sangria</span>
              </button>
            </div>
          )}

          {aba === 'suprimento' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300">
                <strong>Suprimento de Caixa:</strong> Entrada extra de dinheiro na gaveta durante o turno (ex: reforço de troco ou moedas).
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Valor do Suprimento (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorMov}
                  onChange={e => setValorMov(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-2xl font-bold font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Motivo / Origem do Suprimento</label>
                <input
                  type="text"
                  placeholder="Ex: Reforço de troco em moedas de 1 real"
                  value={motivoMov}
                  onChange={e => setMotivoMov(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                disabled={valorMov <= 0 || !motivoMov}
                onClick={() => handleExecutarMovimentacao('Suprimento')}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
              >
                <ArrowDownRight className="w-5 h-5" />
                <span>Confirmar e Registrar Suprimento</span>
              </button>
            </div>
          )}

          {aba === 'fechar' && (
            <div className="space-y-4">
              {!resultadoFechamento ? (
                <>
                  <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300">
                    <strong>Fechamento Cego:</strong> O operador deve contar as cédulas físicas da gaveta e digitar o total. O sistema fará o cruzamento com as vendas e registrará qualquer sobra ou falta.
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
                      Total Contado na Gaveta em Dinheiro (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={saldoContado}
                      onChange={e => setSaldoContado(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-2xl font-bold font-mono text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Observações Finais</label>
                    <textarea
                      rows={2}
                      placeholder="Observações do fechamento de turno..."
                      value={obsFechamento}
                      onChange={e => setObsFechamento(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    onClick={handleFecharCego}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <Calculator className="w-5 h-5" />
                    <span>Realizar Fechamento Cego e Compactar Backup</span>
                  </button>
                </>
              ) : (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                  <h3 className="text-lg font-bold text-white">Caixa Fechado com Sucesso!</h3>
                  <div className="grid grid-cols-2 gap-3 text-left font-mono text-xs">
                    <div className="p-3 bg-slate-900 rounded-xl">
                      <span className="text-slate-400">ESPERADO PELO SISTEMA:</span>
                      <p className="text-base font-bold text-slate-200 mt-1">R$ {resultadoFechamento.saldoEsperadoSistema.toFixed(2)}</p>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-xl">
                      <span className="text-slate-400">INFORMADO PELO OPERADOR:</span>
                      <p className="text-base font-bold text-slate-200 mt-1">R$ {resultadoFechamento.saldoInformadoOperador.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-sm font-bold font-mono">
                    Resultado: <span className={resultadoFechamento.diferenca === 0 ? 'text-emerald-400' : 'text-amber-400'}>{resultadoFechamento.statusConferencia}</span>
                  </div>
                  <p className="text-xs text-slate-500">Backup automático compactado e salvo na fila do Google Drive.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
