import React, { useState, useEffect } from 'react';
import { DesktopTitlebar } from './components/DesktopTitlebar';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar, ModuloApp } from './components/Sidebar';
import { POSView } from './features/pos/POSView';
import { ProductsView } from './features/products/ProductsView';
import { SalesHistoryView } from './features/sales/SalesHistoryView';
import { ImporterView } from './features/importer/ImporterView';
import { SettingsView } from './features/settings/SettingsView';
import { CashierModal } from './features/cashier/CashierModal';
import { useAuthStore } from './store/useAuthStore';

export const App: React.FC = () => {
  const [moduloAtivo, setModuloAtivo] = useState<ModuloApp>('pos');
  const [sidebarColapsada, setSidebarColapsada] = useState(false);
  const [isCashierModalOpen, setIsCashierModalOpen] = useState(false);

  const autenticado = useAuthStore(state => state.autenticado);
  const carregando = useAuthStore(state => state.carregando);
  const restaurarSessao = useAuthStore(state => state.restaurarSessao);

  // Restaurar sessão JWT ao carregar o app
  useEffect(() => {
    restaurarSessao();
  }, [restaurarSessao]);

  // Escutar evento de sessão expirada (401 interceptor)
  useEffect(() => {
    const handler = () => {
      useAuthStore.getState().logout();
    };
    window.addEventListener('atylus:session-expired', handler);
    return () => window.removeEventListener('atylus:session-expired', handler);
  }, []);

  // Atalho global Ctrl+B para colapsar menu lateral
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setSidebarColapsada(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelecionarModulo = (modulo: ModuloApp) => {
    if (modulo === 'cashier') {
      setIsCashierModalOpen(true);
      return;
    }
    setModuloAtivo(modulo);
  };

  // Tela de carregamento enquanto verifica token JWT salvo
  if (carregando) {
    return (
      <div className="w-screen h-screen bg-[#060a10] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm font-mono">Verificando sessão segura...</p>
        </div>
      </div>
    );
  }

  // Se não autenticado, mostra tela de login
  if (!autenticado) {
    return <LoginScreen />;
  }

  // App principal (operador autenticado)
  return (
    <div className="w-screen h-screen flex flex-col bg-[#0b1118] text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. Barra de Título com Status de Nuvem */}
      <DesktopTitlebar />

      {/* 2. Área de Trabalho Principal com Sidebar Colapsável */}
      <div className="flex-1 flex overflow-hidden">
        {/* Menu Lateral Atylus PDV */}
        <Sidebar
          moduloAtivo={moduloAtivo}
          onSelecionarModulo={handleSelecionarModulo}
          colapsada={sidebarColapsada}
          onToggleColapso={() => setSidebarColapsada(!sidebarColapsada)}
        />

        {/* Visualização do Módulo Ativo */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#070c12]">
          {moduloAtivo === 'pos' && (
            <POSView onAbrirImportador={() => setModuloAtivo('importer')} />
          )}

          {moduloAtivo === 'products' && (
            <ProductsView />
          )}

          {moduloAtivo === 'sales' && (
            <SalesHistoryView />
          )}

          {moduloAtivo === 'importer' && (
            <ImporterView onVoltarParaPdv={() => setModuloAtivo('pos')} />
          )}

          {moduloAtivo === 'settings' && (
            <SettingsView />
          )}
        </main>
      </div>

      {/* Modal de Gestão de Caixa (acessível de qualquer lugar) */}
      <CashierModal
        isOpen={isCashierModalOpen}
        onClose={() => setIsCashierModalOpen(false)}
      />
    </div>
  );
};

export default App;
