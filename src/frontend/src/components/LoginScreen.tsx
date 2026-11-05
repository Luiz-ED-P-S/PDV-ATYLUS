import React, { useState, useEffect, useCallback } from 'react';
import { Lock, User, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { pdvApi } from '../services/api';
import { OperadorListItem } from '../types';

export const LoginScreen: React.FC = () => {
  const [matricula, setMatricula] = useState('');
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [operadores, setOperadores] = useState<OperadorListItem[]>([]);
  const [etapa, setEtapa] = useState<'matricula' | 'pin'>('matricula');

  const login = useAuthStore(state => state.login);

  useEffect(() => {
    pdvApi.listarOperadores().then(setOperadores);
  }, []);

  const handleNumeroClick = useCallback((num: string) => {
    setErro('');
    if (etapa === 'matricula') {
      // Matrícula é texto livre (pode ter letras e números)
      // mas o teclado numérico é para o PIN
    } else {
      if (pin.length < 8) {
        setPin(prev => prev + num);
      }
    }
  }, [etapa, pin]);

  const handleApagar = useCallback(() => {
    if (etapa === 'pin') {
      setPin(prev => prev.slice(0, -1));
    } else {
      setMatricula(prev => prev.slice(0, -1));
    }
    setErro('');
  }, [etapa]);

  const handleSelecionarOperador = useCallback((op: OperadorListItem) => {
    setMatricula(op.matricula);
    setEtapa('pin');
    setPin('');
    setErro('');
  }, []);

  const handleVoltar = useCallback(() => {
    setEtapa('matricula');
    setPin('');
    setErro('');
  }, []);

  const handleLogin = useCallback(async () => {
    if (!matricula.trim()) {
      setErro('Selecione um operador.');
      return;
    }
    if (pin.length < 4) {
      setErro('O PIN deve ter no mínimo 4 dígitos.');
      return;
    }

    setLoading(true);
    setErro('');

    const sucesso = await login(matricula, pin);
    if (!sucesso) {
      setErro('Matrícula ou PIN incorretos. Tente novamente.');
      setPin('');
    }

    setLoading(false);
  }, [matricula, pin, login]);

  // Captura global de teclado para entrada rápida
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading) return;

      if (e.key === 'Escape') {
        if (etapa === 'pin') {
          handleVoltar();
        }
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        handleApagar();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (etapa === 'pin' && pin.length >= 4) {
          handleLogin();
        }
        return;
      }

      if (etapa === 'pin' && /^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleNumeroClick(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [etapa, pin, loading, handleNumeroClick, handleApagar, handleVoltar, handleLogin]);

  const numPad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  const operadorSelecionado = operadores.find(o => o.matricula === matricula);

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-[#060a10] via-[#0b1320] to-[#0d1a2a] flex items-center justify-center select-none">
      <div className="w-full max-w-md mx-auto">
        {/* Logo e Título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 mb-4">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-wider">ATYLUS PDV</h1>
          <p className="text-sm text-slate-400 mt-1 font-mono">Sistema de Ponto de Venda Seguro</p>
        </div>

        {/* Card de Login */}
        <div className="bg-[#0e1724] border border-[#1f3042] rounded-3xl p-6 shadow-2xl shadow-black/50">
          {etapa === 'matricula' ? (
            <>
              {/* Etapa 1: Selecionar Operador */}
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-sky-400" />
                <h2 className="text-lg font-bold text-white">Identificação do Operador</h2>
              </div>

              {operadores.length > 0 ? (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {operadores.map((op) => (
                    <button
                      key={op.id}
                      onClick={() => handleSelecionarOperador(op)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:bg-sky-950/40 hover:border-sky-800/50 transition text-left"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        op.perfil === 'Supervisor'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      }`}>
                        {op.matricula.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-white text-sm">{op.nome}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{op.matricula} • {op.perfil}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-400" />
                  Carregando operadores...
                </div>
              )}
            </>
          ) : (
            <>
              {/* Etapa 2: Digitar PIN */}
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">PIN de Segurança</h2>
              </div>

              {/* Operador selecionado */}
              {operadorSelecionado && (
                <button
                  onClick={handleVoltar}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-sky-800/40 bg-sky-950/30 mb-4 text-left hover:bg-sky-950/50 transition"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                    operadorSelecionado.perfil === 'Supervisor'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  }`}>
                    {operadorSelecionado.matricula.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white text-sm">{operadorSelecionado.nome}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{operadorSelecionado.matricula} • Clique para trocar</p>
                  </div>
                </button>
              )}

              {/* Campo de PIN (pontos) */}
              <div className="flex justify-center gap-3 mb-5">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-all duration-150 ${
                      i < pin.length
                        ? 'bg-emerald-400 shadow-md shadow-emerald-400/40 scale-110'
                        : 'bg-slate-700 border border-slate-600'
                    }`}
                  />
                ))}
              </div>

              {/* Teclado Numérico */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {numPad.map((key, i) => {
                  if (key === '') return <div key={i} />;
                  if (key === '⌫') {
                    return (
                      <button
                        key={i}
                        onClick={handleApagar}
                        className="h-14 rounded-xl bg-rose-950/40 border border-rose-900/40 text-rose-300 text-xl font-bold hover:bg-rose-900/50 active:scale-95 transition"
                      >
                        ⌫
                      </button>
                    );
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => handleNumeroClick(key)}
                      className="h-14 rounded-xl bg-slate-800/60 border border-slate-700/50 text-white text-xl font-bold hover:bg-slate-700/60 active:scale-95 transition"
                    >
                      {key}
                    </button>
                  );
                })}
              </div>

              {/* Botão de Login */}
              <button
                onClick={handleLogin}
                disabled={loading || pin.length < 4}
                className={`w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition active:scale-[0.98] ${
                  pin.length >= 4
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    Entrar no Sistema [Enter]
                  </>
                )}
              </button>
            </>
          )}

          {/* Mensagem de Erro */}
          {erro && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-rose-950/40 border border-rose-900/40 text-rose-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <p className="text-center text-[10px] text-slate-600 mt-4 font-mono">
          Autenticação criptografada BCrypt + JWT-HMAC256 • Sessão segura de 12 horas
        </p>
      </div>
    </div>
  );
};
