import React, { useState } from 'react';
import { UserRound, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface LoginViewProps {
  onSuccess?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const [matricula, setMatricula] = useState('');
  const [pin, setPin] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      await login(matricula, pin);
      setPin('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErro(err?.message || 'Matrícula ou PIN inválidos.');
    } finally {
      setCarregando(false);
    }
  };

  // Login social exigiria internet e um provedor externo; o PDV autentica somente offline por matrícula + PIN
  const handleSocialLogin = (provedor: string) => {
    setErro(`Login com ${provedor} indisponível no modo offline. Entre com sua matrícula e PIN.`);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f0f3f8] p-4 sm:p-6 lg:p-8 font-sans">
      {/* Container Principal do Card de Login */}
      <div className="w-full max-w-5xl bg-white rounded-[28px] sm:rounded-[36px] shadow-[0_20px_60px_-15px_rgba(0,40,120,0.12)] border border-slate-100 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        
        {/* =========================================================================
            COLUNA ESQUERDA: Card Azul Royal de Apresentação e Ilustração 3D
           ========================================================================= */}
        <div className="lg:col-span-6 bg-gradient-to-br from-[#005bf8] via-[#004ce5] to-[#0034c4] text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden select-none m-2 sm:m-3 rounded-[24px] sm:rounded-[30px] shadow-inner">
          
          {/* Efeitos de Iluminação / Brilho de Fundo */}
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />

          {/* Topo: Logotipo Oficial AtylusPDV */}
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              {/* Ícone de Carrinho com Traços de Velocidade (Fiel à Imagem 1) */}
              <div className="relative flex items-center">
                <svg className="w-10 h-10 text-white fill-current" viewBox="0 0 48 48">
                  {/* Linhas de movimento atrás do carrinho */}
                  <path d="M4 14h10v3H4zm-2 7h12v3H2zm4 7h8v3H6z" fill="currentColor" opacity="0.9" />
                  {/* Cesto do carrinho moderno */}
                  <path d="M16 11h24l-3.5 14.5H20.5L16 11zm1.5-3.5H12l-1 4H4v3h5.5l5 20h23v-3.5H18.2l-.9-3.5h18.2a2 2 0 001.95-1.55l3.8-15.5a2 2 0 00-1.95-2.45H17.5z" />
                  {/* Rodas do carrinho */}
                  <circle cx="21" cy="38" r="3.5" />
                  <circle cx="35" cy="38" r="3.5" />
                </svg>
              </div>

              <div className="flex items-baseline">
                <span className="text-3xl font-extrabold tracking-tight text-white font-sans">
                  Atylus<span className="italic font-black ml-0.5">PDV</span>
                </span>
              </div>
            </div>

            {/* Texto Promocional Principal */}
            <div className="mt-8">
              <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold leading-snug tracking-tight text-white">
                Seu PDV mais <span className="underline decoration-white/40 underline-offset-4 font-black">simples</span>,<br />
                <span className="font-black text-white">rápido e eficiente</span>.
              </h1>
              <p className="text-sm sm:text-base text-blue-100/90 mt-4 leading-relaxed max-w-sm font-normal">
                Gerencie suas vendas, controle seu <span className="underline decoration-blue-200/50 underline-offset-2">estoque</span> e tenha tudo <span className="underline decoration-blue-200/50 underline-offset-2">na palma</span> da sua mão.
              </p>
            </div>
          </div>

          {/* Base: Ilustração 3D em SVG do Terminal PDV, Maquininha e Impressora Térmica */}
          <div className="relative z-10 mt-8 flex flex-col items-center justify-center">
            {/* Partículas / Faíscas decorativas */}
            <div className="absolute top-4 right-16 w-1.5 h-4 bg-white/70 rounded-full rotate-45 animate-pulse" />
            <div className="absolute top-2 right-24 w-1.5 h-3 bg-white/60 rounded-full rotate-12" />
            <div className="absolute top-6 left-12 w-1.5 h-3 bg-white/50 rounded-full -rotate-45" />

            <div className="relative w-full max-w-[340px] h-[190px] flex items-end justify-center">
              {/* Pedestal 3D Azul Oval com Sombra e Luz */}
              <div className="absolute bottom-0 w-full h-[62px] bg-gradient-to-b from-[#004cd8] to-[#002f9c] rounded-[100%] shadow-[0_12px_28px_rgba(0,20,80,0.45)] border-t border-white/20">
                <div className="w-[94%] h-[48px] mx-auto mt-1 bg-gradient-to-b from-[#0052eb] to-[#0038b8] rounded-[100%]" />
              </div>

              {/* Hardware POS: Maquininha de Cartão (Esquerda) */}
              <div className="relative z-20 mr-2 -mb-2 transform -rotate-6 transition-transform hover:scale-105 duration-200">
                <div className="w-[68px] h-[95px] bg-[#1a2336] rounded-xl p-1.5 shadow-[0_8px_16px_rgba(0,0,0,0.5)] border border-slate-700/80 flex flex-col justify-between">
                  {/* Visor da Maquininha */}
                  <div className="w-full h-8 bg-gradient-to-tr from-[#005bf8] to-[#0088ff] rounded-lg p-1 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="9" cy="21" r="1" />
                      <circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                  </div>
                  {/* Teclado Físico Numérico */}
                  <div className="grid grid-cols-3 gap-1 py-1 px-0.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <div key={n} className="h-2 bg-slate-700/80 rounded-[2px]" />
                    ))}
                  </div>
                  {/* Botões Coloridos (Verde/Amarelo/Vermelho) */}
                  <div className="flex justify-between gap-1 pt-0.5">
                    <div className="w-3 h-1.5 bg-red-500 rounded-sm" />
                    <div className="w-3 h-1.5 bg-amber-400 rounded-sm" />
                    <div className="w-4 h-1.5 bg-emerald-500 rounded-sm" />
                  </div>
                </div>
              </div>

              {/* Hardware POS: Monitor do Caixa Principal (Centro) */}
              <div className="relative z-20 -mb-1 transform transition-transform hover:scale-105 duration-200">
                <div className="flex flex-col items-center">
                  {/* Tela do Monitor */}
                  <div className="w-[130px] h-[85px] bg-[#162133] rounded-xl p-1.5 shadow-[0_12px_24px_rgba(0,0,0,0.6)] border-2 border-slate-700 flex flex-col">
                    <div className="w-full h-full bg-[#0a1220] rounded-lg border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
                      {/* Brilho da tela */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-cyan-400/20" />
                      {/* Logo no Monitor */}
                      <div className="relative z-10 flex flex-col items-center">
                        <svg className="w-8 h-8 text-[#0088ff] drop-shadow-[0_0_8px_rgba(0,136,255,0.6)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="9" cy="21" r="1" />
                          <circle cx="20" cy="21" r="1" />
                          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  {/* Base de Apoio do Monitor */}
                  <div className="w-6 h-4 bg-slate-800 border-x border-slate-700" />
                  <div className="w-16 h-3 bg-slate-900 rounded-t-md shadow-md border-t border-slate-700" />
                </div>
              </div>

              {/* Hardware POS: Impressora Térmica com Cupom Saindo (Direita) */}
              <div className="relative z-20 ml-2 -mb-2 transform rotate-3 transition-transform hover:scale-105 duration-200">
                <div className="flex flex-col items-center">
                  {/* Cupom Impresso Saindo */}
                  <div className="w-10 h-10 bg-white rounded-t-sm shadow-md border-x border-t border-slate-300 p-1 flex flex-col gap-1 -mb-1 animate-bounce duration-1000">
                    <div className="w-full h-0.5 bg-slate-300" />
                    <div className="w-3/4 h-0.5 bg-slate-300" />
                    <div className="w-4/5 h-0.5 bg-slate-300" />
                    <div className="w-2/3 h-0.5 bg-slate-300" />
                  </div>
                  {/* Bloco da Impressora Térmica */}
                  <div className="w-[62px] h-[58px] bg-[#1e283b] rounded-xl p-1.5 shadow-[0_8px_18px_rgba(0,0,0,0.5)] border border-slate-700 flex flex-col justify-between">
                    <div className="w-full h-1.5 bg-slate-900 rounded-full" />
                    <div className="flex items-center justify-between px-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                      <div className="w-3 h-1.5 bg-slate-600 rounded-sm" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            COLUNA DIREITA: Formulário Limpo e Moderno de Autenticação
           ========================================================================= */}
        <div className="lg:col-span-6 p-8 sm:p-12 lg:p-14 flex flex-col justify-between bg-white">
          <div className="w-full max-w-md mx-auto">
            
            {/* Ícone Central Superior (Carrinho Azul Royal com Traços de Velocidade) */}
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-white flex items-center justify-center text-[#005bf8] mb-2">
                <svg className="w-12 h-12 text-[#005bf8] fill-current" viewBox="0 0 48 48">
                  <path d="M4 14h10v3H4zm-2 7h12v3H2zm4 7h8v3H6z" fill="currentColor" opacity="0.9" />
                  <path d="M16 11h24l-3.5 14.5H20.5L16 11zm1.5-3.5H12l-1 4H4v3h5.5l5 20h23v-3.5H18.2l-.9-3.5h18.2a2 2 0 001.95-1.55l3.8-15.5a2 2 0 00-1.95-2.45H17.5z" />
                  <circle cx="21" cy="38" r="3.5" />
                  <circle cx="35" cy="38" r="3.5" />
                </svg>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Bem-vindo de volta!
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Faça login na sua conta para continuar
              </p>
            </div>

            {/* Mensagem de Erro Caso Ocorra */}
            {erro && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl text-center">
                {erro}
              </div>
            )}

            {/* Formulário de Acesso */}
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              
              {/* Campo Matrícula */}
              <div>
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-slate-400 pointer-events-none">
                    <UserRound className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value.toUpperCase())}
                    required
                    autoFocus
                    autoComplete="username"
                    placeholder="Matrícula"
                    className="w-full pl-12 pr-4 py-3.5 bg-[#f8fafc] border border-slate-200/90 rounded-2xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#005bf8]/20 focus:border-[#005bf8] focus:bg-white transition-all duration-150"
                  />
                </div>
              </div>

              {/* Campo PIN */}
              <div>
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-slate-400 pointer-events-none">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    required
                    inputMode="numeric"
                    autoComplete="current-password"
                    placeholder="PIN"
                    className="w-full pl-12 pr-12 py-3.5 bg-[#f8fafc] border border-slate-200/90 rounded-2xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#005bf8]/20 focus:border-[#005bf8] focus:bg-white transition-all duration-150"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-4 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
                  >
                    {mostrarSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* Link Esqueceu sua senha? */}
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => alert('Para redefinir seu PIN, solicite ao Supervisor.')}
                    className="text-xs font-semibold text-[#005bf8] hover:text-[#0047db] transition-colors"
                  >
                    Esqueceu seu PIN?
                  </button>
                </div>
              </div>

              {/* Botão de Entrar (Pill Azul Royal com Seta para a Direita) */}
              <button
                type="submit"
                disabled={carregando}
                className="w-full mt-2 py-3.5 px-6 bg-[#005bf8] hover:bg-[#004cd8] active:bg-[#003cb0] text-white font-bold text-sm rounded-2xl shadow-[0_8px_20px_-4px_rgba(0,91,248,0.38)] flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-[0_12px_24px_-4px_rgba(0,91,248,0.48)] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>{carregando ? 'Acessando...' : 'Entrar'}</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </button>
            </form>

            {/* Divisor "ou entre com" */}
            <div className="relative my-7 flex items-center justify-center">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-xs text-slate-400 font-medium absolute">
                ou entre com
              </span>
            </div>

            {/* Botões de Login Social (Google e Facebook) */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {/* Botão Google */}
              <button
                type="button"
                onClick={() => handleSocialLogin('Google')}
                className="flex items-center justify-center gap-2.5 py-3 px-4 bg-white border border-slate-200/90 rounded-2xl hover:bg-slate-50/80 active:bg-slate-100 transition-all text-xs font-bold text-slate-700 shadow-sm cursor-pointer"
              >
                {/* Ícone Multicolorido Oficial do Google */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.88c2.28-2.09 3.66-5.18 3.66-9.14z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.04c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.13C3.26 21.4 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.28c-.25-.72-.38-1.49-.38-2.28s.13-1.56.38-2.28V6.59H1.24C.45 8.16 0 9.97 0 12s.45 3.84 1.24 5.41l4.04-3.13z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.6 1.24 6.59l4.04 3.13c.95-2.83 3.6-4.97 6.72-4.97z"
                  />
                </svg>
                <span>Google</span>
              </button>

              {/* Botão Facebook */}
              <button
                type="button"
                onClick={() => handleSocialLogin('Facebook')}
                className="flex items-center justify-center gap-2.5 py-3 px-4 bg-white border border-slate-200/90 rounded-2xl hover:bg-slate-50/80 active:bg-slate-100 transition-all text-xs font-bold text-slate-700 shadow-sm cursor-pointer"
              >
                {/* Ícone Oficial do Facebook */}
                <svg className="w-4 h-4 text-[#1877F2] fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <span>Facebook</span>
              </button>
            </div>
          </div>

          {/* Rodapé: Direitos Autorais e Marca */}
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-500">
              <strong className="text-slate-700 font-bold">AtylusPDV</strong> © 2026. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
