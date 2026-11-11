import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Mail,
  Bell,
  ChevronDown,
  User,
  LogOut,
  Shield,
  Settings,
  Key,
  X,
  Lock,
  ShoppingCart,
  Camera,
  Check,
  Edit3,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCashierStore } from '../store/useCashierStore';
import { useThemeStore } from '../store/useThemeStore';
import { sound } from '../services/sound';

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
  const { operador, logout, trocarOperador, atualizarPerfil } = useAuthStore();
  const { theme } = useThemeStore();
  const { caixa } = useCashierStore();

  const [busca, setBusca] = useState('');
  const [menuAberto, setMenuAberto] = useState(false);
  const [modalOperadorAberto, setModalOperadorAberto] = useState(false);
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false);
  const [modalNotificacoesAberto, setModalNotificacoesAberto] = useState(false);
  const [modalMensagensAberto, setModalMensagensAberto] = useState(false);

  // Edição de Perfil
  const [nomePerfil, setNomePerfil] = useState(operador.nome);
  const [emailPerfil, setEmailPerfil] = useState(operador.email || '');
  const [cargoPerfil, setCargoPerfil] = useState<'Operador' | 'Supervisor'>(operador.role);
  const [avatarPreview, setAvatarPreview] = useState(operador.avatarUrl || '');
  const [feedbackPerfil, setFeedbackPerfil] = useState<string | null>(null);

  // Troca de Operador por PIN
  const [matriculaInput, setMatriculaInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [erroOperador, setErroOperador] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNomePerfil(operador.nome);
    setEmailPerfil(operador.email || '');
    setCargoPerfil(operador.role);
    setAvatarPreview(operador.avatarUrl || '');
  }, [operador]);

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
      sound.playSuccessChime();
    } else {
      setErroOperador('PIN inválido! Digite 0000 para Operador ou 1234 para Supervisor.');
      sound.playErrorBeep();
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('A foto deve ter no máximo 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAvatarPreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSalvarPerfil = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomePerfil.trim()) {
      alert('Informe o nome do operador.');
      return;
    }
    atualizarPerfil({
      nome: nomePerfil.trim(),
      email: emailPerfil.trim(),
      role: cargoPerfil,
      avatarUrl: avatarPreview,
    });
    sound.playSuccessChime();
    setFeedbackPerfil('Perfil atualizado com sucesso!');
    setTimeout(() => {
      setFeedbackPerfil(null);
      setModalPerfilAberto(false);
    }, 1200);
  };

  const isCaixaAberto = caixa && caixa.status === 'Aberto';

  return (
    <header className="w-full flex items-center justify-between gap-3 sm:gap-4 py-2 sm:py-3 px-1 sm:px-2 z-30 select-none">
      {/* Botão de Menu Hamburguer para Mobile / Tablet */}
      <button
        onClick={onToggleSidebarMobile}
        className="lg:hidden w-11 h-11 bg-white border border-slate-200/90 rounded-2xl flex items-center justify-center text-slate-700 hover:text-indigo-600 shadow-sm transition shrink-0"
        title="Abrir Menu"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Barra de Pesquisa Centralizada */}
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
            className="w-full pl-11 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-white border border-slate-200/80 rounded-2xl text-slate-800 text-xs sm:text-sm placeholder-slate-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
            className="w-10 h-10 sm:w-11 sm:h-11 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-center text-slate-600 hover:text-indigo-600 shadow-xs transition active:scale-95"
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
                <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100/80">
                  <span className="font-bold text-indigo-600 block">Suporte AtylusPDV</span>
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
            className="w-10 h-10 sm:w-11 sm:h-11 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-center text-slate-600 hover:text-indigo-600 shadow-xs transition relative active:scale-95"
            title="Notificações do Sistema"
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-indigo-600 rounded-full ring-2 ring-white" />
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
                  <div className="w-2 h-2 rounded-full mt-1 shrink-0 bg-indigo-500" />
                  <div>
                    <span className="font-bold text-slate-800 block">Backup em Nuvem</span>
                    <span className="text-slate-500">Google Drive sincronizado e fila offline atualizada.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card do Perfil do Usuário com Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setMenuAberto(!menuAberto)}
            className="bg-white border border-slate-200/80 rounded-2xl pl-1.5 sm:pl-2 pr-2.5 sm:pr-3 py-1 sm:py-1.5 flex items-center gap-2 sm:gap-2.5 shadow-xs hover:border-slate-300 transition active:scale-98 cursor-pointer"
          >
            {/* Foto do Usuário */}
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl p-0.5 shadow-xs overflow-hidden flex items-center justify-center shrink-0 border"
              style={{ borderColor: `${theme.corPrimaria}40` }}
            >
              {operador.avatarUrl ? (
                <img
                  src={operador.avatarUrl}
                  alt={operador.nome}
                  className="w-full h-full object-cover rounded-[10px]"
                />
              ) : (
                <User className="w-4 h-4 text-slate-500" />
              )}
            </div>

            {/* Informações: Nome e Cargo */}
            <div className="text-left hidden md:block">
              <span className="text-xs sm:text-sm font-bold text-slate-800 block leading-tight">
                {operador.nome}
              </span>
              <span className="text-[10px] text-slate-400 font-medium block leading-tight">
                {operador.role}
              </span>
            </div>

            <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 transition-transform duration-200 ${menuAberto ? 'rotate-180' : ''}`} />
          </button>

          {/* Menu Dropdown de Ações */}
          {menuAberto && (
            <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-4 py-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 block">{operador.nome}</span>
                <span className="text-[10px] text-slate-400 block">{operador.email || 'Sem e-mail'} • {operador.role}</span>
              </div>

              <div className="p-1 space-y-0.5 text-xs">
                <button
                  onClick={() => {
                    setMenuAberto(false);
                    setModalPerfilAberto(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition font-medium"
                >
                  <Edit3 className="w-4 h-4 text-indigo-600" />
                  <span>Editar Meu Perfil</span>
                </button>

                <button
                  onClick={() => {
                    setMenuAberto(false);
                    if (onNavegarPara) onNavegarPara('pos');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl transition font-medium"
                >
                  <ShoppingCart className="w-4 h-4 text-slate-400" />
                  <span>Frente de Caixa (PDV)</span>
                </button>

                <button
                  onClick={() => {
                    setMenuAberto(false);
                    if (onNavegarPara) onNavegarPara('cashier');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl transition font-medium"
                >
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span>Controle de Caixa (F3)</span>
                </button>

                <button
                  onClick={() => {
                    setMenuAberto(false);
                    setModalOperadorAberto(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl transition font-medium"
                >
                  <Key className="w-4 h-4 text-slate-400" />
                  <span>Trocar Operador (PIN)</span>
                </button>

                <button
                  onClick={() => {
                    setMenuAberto(false);
                    if (onNavegarPara) onNavegarPara('settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl transition font-medium"
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition font-medium"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Sair da Conta</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Editar Perfil do Usuário */}
      {modalPerfilAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Editar Perfil do Usuário</h3>
              </div>
              <button onClick={() => setModalPerfilAberto(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarPerfil} className="py-4 space-y-4 text-xs font-semibold">
              {/* Foto de Perfil */}
              <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div className="relative w-16 h-16 rounded-2xl border-2 border-dashed border-indigo-200 flex items-center justify-center overflow-hidden bg-white shrink-0 shadow-inner">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-slate-400" />
                  )}
                  <label className="absolute inset-0 bg-slate-900/30 hover:bg-slate-900/50 flex items-center justify-center cursor-pointer transition opacity-0 hover:opacity-100 text-white">
                    <Camera className="w-5 h-5" />
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </label>
                </div>
                <div className="flex-1">
                  <span className="font-bold text-slate-800 block text-xs">Foto / Avatar</span>
                  <label className="cursor-pointer inline-block mt-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition">
                    <span>Escolher Imagem</span>
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </label>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={() => setAvatarPreview('')}
                      className="ml-2 text-[11px] text-rose-500 hover:underline"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Nome Completo:</label>
                <input
                  type="text"
                  value={nomePerfil}
                  onChange={e => setNomePerfil(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">E-mail de Contato:</label>
                <input
                  type="email"
                  value={emailPerfil}
                  onChange={e => setEmailPerfil(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1">Matrícula / ID:</label>
                  <input
                    type="text"
                    disabled
                    value={operador.matricula}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-mono cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Nível de Permissão:</label>
                  <select
                    value={cargoPerfil}
                    onChange={e => setCargoPerfil(e.target.value as 'Operador' | 'Supervisor')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none"
                  >
                    <option value="Operador">Operador de Caixa</option>
                    <option value="Supervisor">Supervisor / Gerente</option>
                  </select>
                </div>
              </div>

              {feedbackPerfil && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{feedbackPerfil}</span>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalPerfilAberto(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: theme.corPrimaria }}
                  className="flex-1 py-2.5 hover:opacity-90 text-white font-bold rounded-xl shadow-xs transition"
                >
                  Salvar Perfil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Troca Rápida de Operador com PIN */}
      {modalOperadorAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">Trocar Operador</h3>
              </div>
              <button onClick={() => setModalOperadorAberto(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTrocarOperador} className="py-4 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 mb-1">Matrícula do Operador:</label>
                <input
                  type="text"
                  placeholder="Ex: OP01, OP02, GER01"
                  value={matriculaInput}
                  onChange={e => setMatriculaInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono text-xs focus:bg-white focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">PIN de Acesso (4 Dígitos):</label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="0000 para operador ou 1234 supervisor"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono text-base tracking-widest focus:bg-white focus:outline-none"
                />
              </div>

              {erroOperador && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[11px]">
                  {erroOperador}
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOperadorAberto(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: theme.corPrimaria }}
                  className="flex-1 py-2 hover:opacity-90 text-white font-bold rounded-xl shadow-xs"
                >
                  Entrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
