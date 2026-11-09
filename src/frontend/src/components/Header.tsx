import React, { useState, useRef, useEffect } from 'react';
import { Search, Mail, Bell, ChevronDown, User, LogOut, Shield, Settings, Key, X, Lock, ShoppingCart } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCashierStore } from '../store/useCashierStore';

interface HeaderProps {
  onToggleSidebarMobile?: () => void;
  onNavegarPara?: (modulo: string) => void;
  onPesquisar?: (termo: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebarMobile,
  onNavegarPara,
  onPesquisar,
}) => {
  const { operador, logout, trocarOperador } = useAuthStore();
  const { caixa } = useCashierStore();

  const [busca, setBusca] = useState('');
  const [menuAberto, setMenuAberto] = useState(false);
  const [modalOperadorAberto, setModalOperadorAberto] = useState(false);
  const [modalNotificacoesAberto, setModalNotificacoesAberto] = useState(false);
  const [modalMensagensAberto, setModalMensagensAberto] = useState(false);

  // Troca de Operador
  const [matriculaInput, setMatriculaInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [erroOperador, setErroOperador] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (onPesquisar) onPesquisar(busca);
  };

  const handleTrocarOperador = (e: React.FormEvent) => {
    e.preventDefault();
    setErroOperador(null);
    const sucesso = trocarOperador(matriculaInput.toUpperCase(), pinInput);
    if (sucesso) {
      setModalOperadorAberto(false);
      setMatriculaInput('');
      setPinInput('');
      setMenuAberto(false);
    } else {
      setErroOperador('PIN inválido! Digite 0000 para Operador ou 1234 para Supervisor.');
    }
  };

  const isCaixaAberto = caixa && caixa.status === 'Aberto';

  return (
    <header className="w-full flex items-center justify-between gap-3 sm:gap-4 py-2 sm:py-3 px-1 sm:px-2 z-30 select-none">
      
      {/* Botão de Menu Hamburguer para Mobile / Tablet */}
      <button
        onClick={onToggleSidebarMobile}
        className="lg:hidden w-11 h-11 bg-white border border-slate-200/90 rounded-2xl flex items-center justify-center text-slate-700 hover:text-[#005bf8] shadow-sm transition shrink-0"
        title="Abrir Menu"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Barra de Pesquisa Centralizada (Fiel à Imagem 2) */}
      <form onSubmit={handleBuscar} className="flex-1 max-w-md">
        <div className="relative flex items-center">
          <div className="absolute left-4 text-slate-400 pointer-events-none">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
          </div>
          <input
            type="text"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              if (onPesquisar) onPesquisar(e.target.value);
            }}
            placeholder="Pesquisar no sistema..."
            className="w-full pl-11 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-white border border-slate-200/80 rounded-2xl text-slate-800 text-xs sm:text-sm placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#005bf8]/20 focus:border-[#005bf8] transition-all"
          />
          {busca && (
            <button
              type="button"
              onClick={() => {
                setBusca('');
                if (onPesquisar) onPesquisar('');
              }}
              className="absolute right-3.5 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </form>

      {/* Ações da Direita: Mensagens, Notificações e Perfil do Usuário */}
      <div className="flex items-center gap-2 sm:gap-3">
        
        {/* Botão de Mensagens / Suporte */}
        <div className="relative">
          <button
            onClick={() => setModalMensagensAberto(!modalMensagensAberto)}
            className="w-10 h-10 sm:w-11 sm:h-11 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-center text-slate-600 hover:text-[#005bf8] hover:border-[#005bf8]/30 shadow-sm transition active:scale-95"
            title="Mensagens e Suporte"
          >
            <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Popover de Mensagens */}
          {modalMensagensAberto && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-bold text-sm text-slate-900">Mensagens & Avisos</span>
                <button onClick={() => setModalMensagensAberto(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="py-3 text-xs text-slate-500 space-y-2">
                <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-100/80">
                  <span className="font-bold text-[#005bf8] block">Suporte AtylusPDV</span>
                  <span>Sistema operacional offline-first pronto para uso. Versão 2.4.0 ativa.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Botão de Notificações com Indicador */}
        <div className="relative">
          <button
            onClick={() => setModalNotificacoesAberto(!modalNotificacoesAberto)}
            className="w-10 h-10 sm:w-11 sm:h-11 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-center text-slate-600 hover:text-[#005bf8] hover:border-[#005bf8]/30 shadow-sm transition relative active:scale-95"
            title="Notificações do Sistema"
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#005bf8] rounded-full ring-2 ring-white" />
          </button>

          {/* Popover de Notificações */}
          {modalNotificacoesAberto && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-bold text-sm text-slate-900">Notificações</span>
                <button onClick={() => setModalNotificacoesAberto(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="py-2 space-y-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl flex items-start gap-2.5">
                  <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${isCaixaAberto ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <div>
                    <span className="font-bold text-slate-800 block">Status do Caixa</span>
                    <span className="text-slate-500">{isCaixaAberto ? 'Caixa em operação normal' : 'Caixa fechado. Abra para iniciar vendas.'}</span>
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full mt-1 shrink-0 bg-blue-500" />
                  <div>
                    <span className="font-bold text-slate-800 block">Backup em Nuvem</span>
                    <span className="text-slate-500">Google Drive sincronizado e fila offline atualizada.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            CARD DO PERFIL DO USUÁRIO (Fiel à Imagem 2: Kim Jiwon - Administrador)
           ========================================================================= */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setMenuAberto(!menuAberto)}
            className="bg-white border border-slate-200/80 rounded-2xl pl-1.5 sm:pl-2 pr-2.5 sm:pr-3 py-1 sm:py-1.5 flex items-center gap-2 sm:gap-2.5 shadow-sm hover:border-slate-300 transition active:scale-98 cursor-pointer"
          >
            {/* Foto / Ilustração do Usuário com Borda Azul */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-sm overflow-hidden flex items-center justify-center shrink-0">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80"
                alt={operador.nome}
                className="w-full h-full object-cover rounded-[10px]"
                onError={(e) => {
                  // Fallback se imagem não carregar
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <User className="w-4 h-4 text-white" />
            </div>

            {/* Informações: Nome e Cargo (Fiel ao Modelo Visual da Imagem 2) */}
            <div className="text-left hidden md:block">
              <span className="text-xs sm:text-sm font-bold text-slate-800 block leading-tight">
                {operador.nome}
              </span>
              <span className="text-[10px] text-slate-400 font-medium block leading-tight">
                {operador.role}
              </span>
            </div>

            {/* Seta Dropdown */}
            <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 transition-transform duration-200 ${menuAberto ? 'rotate-180' : ''}`} />
          </button>

          {/* Menu Dropdown de Ações do Usuário */}
          {menuAberto && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-4 py-2 border-b border-slate-100 md:hidden">
                <span className="text-xs font-bold text-slate-800 block">{operador.nome}</span>
                <span className="text-[10px] text-slate-400 block">{operador.role} • Mat: {operador.matricula}</span>
              </div>

              <div className="p-1 space-y-0.5 text-xs">
                <button
                  onClick={() => {
                    setMenuAberto(false);
                    if (onNavegarPara) onNavegarPara('pos');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-[#005bf8] rounded-xl transition font-medium"
                >
                  <ShoppingCart className="w-4 h-4 text-slate-400" />
                  <span>Frente de Caixa (PDV)</span>
                </button>

                <button
                  onClick={() => {
                    setMenuAberto(false);
                    if (onNavegarPara) onNavegarPara('cashier');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-[#005bf8] rounded-xl transition font-medium"
                >
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span>Controle de Caixa (F3)</span>
                </button>

                <button
                  onClick={() => {
                    setMenuAberto(false);
                    setModalOperadorAberto(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-[#005bf8] rounded-xl transition font-medium"
                >
                  <Key className="w-4 h-4 text-slate-400" />
                  <span>Trocar Operador (PIN)</span>
                </button>

                <button
                  onClick={() => {
                    setMenuAberto(false);
                    if (onNavegarPara) onNavegarPara('settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-[#005bf8] rounded-xl transition font-medium"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Configurações do PDV</span>
                </button>

                <div className="border-t border-slate-100 my-1" />

                <button
                  onClick={() => {
                    setMenuAberto(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition font-medium"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  <span>Sair da Conta</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Troca Rápida de Operador com PIN */}
      {modalOperadorAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#005bf8]" />
                <h3 className="font-bold text-sm text-slate-900">Trocar Operador</h3>
              </div>
              <button onClick={() => setModalOperadorAberto(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {erroOperador && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl">
                {erroOperador}
              </div>
            )}

            <form onSubmit={handleTrocarOperador} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Matrícula</label>
                <input
                  type="text"
                  required
                  value={matriculaInput}
                  onChange={(e) => setMatriculaInput(e.target.value)}
                  placeholder="Ex: OP02 ou GER01"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm uppercase focus:outline-none focus:border-[#005bf8]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">PIN de Acesso</label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="0000 (Operador) ou 1234 (Supervisor)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#005bf8]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOperadorAberto(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#005bf8] hover:bg-[#0047db] text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
