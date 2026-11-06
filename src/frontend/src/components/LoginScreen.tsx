import React, { useState, useEffect, useCallback } from 'react';
import { Lock, User, ShieldCheck, AlertCircle, CheckCircle2, Mail, KeyRound, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { pdvApi } from '../services/api';
import { OperadorListItem } from '../types';

export const LoginScreen: React.FC = () => {
  // Modo principal: 'email_auth' (Cadastro/Login por E-mail com BCrypt e OTP) ou 'pin_operador' (PIN rápido de caixa)
  const [modo, setModo] = useState<'email_auth' | 'pin_operador'>('email_auth');

  // Sub-abas do modo email_auth: 'login' | 'cadastro' | 'verificar_otp'
  const [subAba, setSubAba] = useState<'login' | 'cadastro' | 'verificar_otp'>('login');

  // Formulário E-mail / Senha / Cadastro
  const [nomeCadastro, setNomeCadastro] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigoOtp, setCodigoOtp] = useState('');

  // Estados de feedback
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados do modo PIN Operador
  const [matricula, setMatricula] = useState('');
  const [pin, setPin] = useState('');
  const [operadores, setOperadores] = useState<OperadorListItem[]>([]);
  const [etapa, setEtapa] = useState<'matricula' | 'pin'>('matricula');

  const loginComPin = useAuthStore((state) => state.login);
  const loginComEmail = useAuthStore((state) => state.loginComEmail);

  useEffect(() => {
    pdvApi.listarOperadores().then(setOperadores).catch(() => {});
  }, []);

  const limparMensagens = () => {
    setErro('');
    setSucesso('');
  };

  // 1. Submissão de Login com E-mail e Senha (BCrypt)
  const handleLoginEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    limparMensagens();

    if (!email || !senha) {
      setErro('Informe o e-mail e a senha.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginComEmail(email, senha);
      if (!res.sucesso) {
        setErro(res.mensagem);
        // Se a mensagem mencionar conta não verificada, sugere ir para tela de verificação
        if (res.mensagem.toLowerCase().includes('verificad')) {
          setSubAba('verificar_otp');
        }
      }
    } catch (err: any) {
      setErro(err?.message || 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Submissão de Cadastro (gera código 6 dígitos e envia por e-mail/MailKit)
  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    limparMensagens();

    if (!nomeCadastro || !email || !senha) {
      setErro('Preencha nome, e-mail e senha.');
      return;
    }

    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const res = await pdvApi.registrarUsuario(nomeCadastro, email, senha);
      if (res.sucesso) {
        setSucesso(res.mensagem);
        setSubAba('verificar_otp');
      } else {
        setErro(res.mensagem || 'Falha ao criar conta.');
      }
    } catch (err: any) {
      setErro(err?.response?.data?.mensagem || err?.message || 'Erro ao registrar usuário.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Submissão de Verificação de Código OTP
  const handleVerificarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    limparMensagens();

    if (!email || !codigoOtp) {
      setErro('Informe o e-mail e o código numérico de 6 dígitos.');
      return;
    }

    setLoading(true);
    try {
      const res = await pdvApi.verificarCodigoOtp(email, codigoOtp.trim());
      if (res.sucesso) {
        setSucesso('Conta verificada com sucesso! Você já pode entrar com sua senha.');
        setCodigoOtp('');
        setSubAba('login');
      } else {
        setErro(res.mensagem || 'Código inválido ou expirado.');
      }
    } catch (err: any) {
      setErro(err?.response?.data?.mensagem || err?.message || 'Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  // Teclado numérico do Modo PIN Operador
  const handleNumeroClick = useCallback((num: string) => {
    setErro('');
    if (etapa === 'matricula') {
      setMatricula((prev) => (prev.length < 10 ? prev + num : prev));
    } else {
      setPin((prev) => (prev.length < 6 ? prev + num : prev));
    }
  }, [etapa]);

  const handleBackspace = () => {
    setErro('');
    if (etapa === 'matricula') {
      setMatricula((prev) => prev.slice(0, -1));
    } else {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  const handleAvancarEtapa = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!matricula.trim()) {
      setErro('Informe ou selecione a matrícula do operador');
      return;
    }
    setErro('');
    setEtapa('pin');
  };

  const handleVoltarEtapa = () => {
    setErro('');
    setPin('');
    setEtapa('matricula');
  };

  const handleLoginPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin) {
      setErro('Digite o PIN de acesso');
      return;
    }
    setLoading(true);
    setErro('');
    try {
      const ok = await loginComPin(matricula.trim(), pin);
      if (!ok) {
        setErro('PIN incorreto ou operador inativo');
        setPin('');
      }
    } catch {
      setErro('Falha na comunicação com o servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Topo do Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 mb-3 shadow-lg shadow-emerald-950/40">
            <ShieldCheck size={36} />
          </div>
          <h1 className="text-3xl font-black tracking-wider text-white">ATYLUS PDV</h1>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mt-1">
            Sistema de Autenticação Segura &bull; .NET 8 + BCrypt + OTP
          </p>
        </div>

        {/* Chaveador de Modo */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-800/80 rounded-xl border border-slate-700/60 mb-5">
          <button
            type="button"
            onClick={() => { setModo('email_auth'); limparMensagens(); }}
            className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              modo === 'email_auth'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail size={16} />
            <span>Conta & E-mail (OTP)</span>
          </button>
          <button
            type="button"
            onClick={() => { setModo('pin_operador'); limparMensagens(); }}
            className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              modo === 'pin_operador'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound size={16} />
            <span>Operador Caixa (PIN)</span>
          </button>
        </div>

        {/* Mensagens de Alerta Globais */}
        {erro && (
          <div className="mb-4 p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-300 text-sm animate-shake">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span className="leading-snug">{erro}</span>
          </div>
        )}

        {sucesso && (
          <div className="mb-4 p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-start gap-3 text-emerald-300 text-sm">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <span className="leading-snug">{sucesso}</span>
          </div>
        )}

        {/* CARD PRINCIPAL */}
        <div className="bg-slate-800/90 rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden backdrop-blur-sm">
          {modo === 'email_auth' ? (
            <div>
              {/* Abas Secundárias do Modo E-mail */}
              <div className="flex border-b border-slate-700/80 bg-slate-900/40">
                <button
                  type="button"
                  onClick={() => { setSubAba('login'); limparMensagens(); }}
                  className={`flex-1 py-3 text-xs font-bold transition-colors ${
                    subAba === 'login'
                      ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-800/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => { setSubAba('cadastro'); limparMensagens(); }}
                  className={`flex-1 py-3 text-xs font-bold transition-colors ${
                    subAba === 'cadastro'
                      ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-800/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Criar Conta
                </button>
                <button
                  type="button"
                  onClick={() => { setSubAba('verificar_otp'); limparMensagens(); }}
                  className={`flex-1 py-3 text-xs font-bold transition-colors ${
                    subAba === 'verificar_otp'
                      ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-800/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Verificar Código
                </button>
              </div>

              {/* Sub-Aba: 1. Login com Email/Senha */}
              {subAba === 'login' && (
                <form onSubmit={handleLoginEmail} className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      E-mail Cadastrado
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="usuario@empresa.com"
                        required
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Senha (Criptografada com BCrypt)
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                      <input
                        type="password"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                        required
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                    <span>{loading ? 'Validando BCrypt...' : 'Acessar PDV'}</span>
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => { setSubAba('cadastro'); limparMensagens(); }}
                      className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      Não tem conta? <span className="font-bold underline">Cadastre-se com verificação OTP</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Sub-Aba: 2. Criar Nova Conta */}
              {subAba === 'cadastro' && (
                <form onSubmit={handleCadastro} className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Nome Completo
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                      <input
                        type="text"
                        value={nomeCadastro}
                        onChange={(e) => setNomeCadastro(e.target.value)}
                        placeholder="Ex: Carlos Silva"
                        required
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      E-mail para Receber o Código OTP
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="carlos@empresa.com"
                        required
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Senha Segura
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                      <input
                        type="password"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        required
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40">
                    &bull; A senha será criptografada com <strong>BCrypt.Net-Next (work factor 12)</strong>.<br />
                    &bull; Um código de 6 dígitos será enviado via <strong>MailKit</strong>.
                  </p>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                    <span>{loading ? 'Cadastrando...' : 'Cadastrar e Gerar Código'}</span>
                  </button>
                </form>
              )}

              {/* Sub-Aba: 3. Validar Código OTP de 6 dígitos */}
              {subAba === 'verificar_otp' && (
                <form onSubmit={handleVerificarCodigo} className="p-6 space-y-4">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 leading-relaxed">
                    Digite o código de 6 dígitos enviado para o seu e-mail (válido por 15 minutos).
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      E-mail da Conta
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="usuario@empresa.com"
                        required
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Código de 6 Dígitos
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                      <input
                        type="text"
                        maxLength={6}
                        value={codigoOtp}
                        onChange={(e) => setCodigoOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        required
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white text-center font-mono tracking-[0.4em] text-lg placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || codigoOtp.length !== 6}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                    <span>{loading ? 'Verificando...' : 'Confirmar e Ativar Conta'}</span>
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => { setSubAba('login'); limparMensagens(); }}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1 mx-auto"
                    >
                      <ArrowLeft size={14} /> Voltar para Login
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* Modo Operador de Caixa (PIN rápido) */
            <div className="p-6">
              {etapa === 'matricula' ? (
                <form onSubmit={handleAvancarEtapa} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Matrícula do Operador
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                      <input
                        type="text"
                        value={matricula}
                        onChange={(e) => setMatricula(e.target.value.toUpperCase())}
                        placeholder="Ex: OP01, GER01"
                        required
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white uppercase font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                      />
                    </div>
                  </div>

                  {operadores.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-400 mb-2 font-medium">Selecione rápido:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {operadores.map((op) => (
                          <button
                            key={op.id}
                            type="button"
                            onClick={() => {
                              setMatricula(op.matricula);
                              setEtapa('pin');
                            }}
                            className="p-2.5 bg-slate-900/60 border border-slate-700/60 hover:border-blue-500/60 rounded-xl text-left transition-all hover:bg-blue-600/10"
                          >
                            <p className="font-bold text-xs text-white">{op.nome}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{op.matricula} &bull; {op.perfil}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-950/60 flex items-center justify-center gap-2"
                  >
                    <span>Continuar para o PIN</span>
                    <ArrowRight size={18} />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLoginPin} className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                    <div>
                      <p className="text-xs text-slate-400">Operador</p>
                      <p className="text-sm font-bold text-white font-mono">{matricula}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleVoltarEtapa}
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                    >
                      <ArrowLeft size={14} /> Trocar
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 text-center">
                      Digite seu PIN (Teclado ou Tela)
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        maxLength={6}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="&bull;&bull;&bull;&bull;"
                        autoFocus
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-3 text-center text-white tracking-[0.5em] text-2xl font-mono focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Teclado numérico touch */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((btn) => (
                      <button
                        key={btn}
                        type="button"
                        onClick={() => {
                          if (btn === 'C') setPin('');
                          else if (btn === '⌫') handleBackspace();
                          else handleNumeroClick(btn);
                        }}
                        className="py-3 bg-slate-900/80 hover:bg-slate-700/80 text-white font-bold text-lg rounded-xl border border-slate-700/60 active:scale-95 transition-all shadow-sm"
                      >
                        {btn}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !pin}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-950/60 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
                    <span>{loading ? 'Entrando...' : 'Entrar no Caixa'}</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Rodapé informativo */}
        <div className="text-center mt-5 text-[11px] text-slate-500">
          ATYLUS PDV &bull; C# ASP.NET Core (.NET 8) Web API &bull; React TypeScript
        </div>
      </div>
    </div>
  );
};
