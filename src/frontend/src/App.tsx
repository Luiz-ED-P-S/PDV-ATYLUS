import React, { useState, useEffect } from 'react';
import { Sidebar, ModuloApp } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginView } from './features/auth/LoginView';
import { useAuthStore } from './store/useAuthStore';

// Módulos do Sistema:
import { DashboardView } from './features/dashboard/DashboardView';
import { POSView } from './features/pos/POSView';
import { ProductsView } from './features/products/ProductsView';
import { SalesHistoryView } from './features/sales/SalesHistoryView';
import { CustomersView } from './features/customers/CustomersView';
import { ServiceOrdersView } from './features/orders/ServiceOrdersView';
import { ReportsView } from './features/reports/ReportsView';
import { CashierView } from './features/cashier/CashierView';
import { ImporterView } from './features/importer/ImporterView';
import { SettingsView } from './features/settings/SettingsView';
import { CashierModal } from './features/cashier/CashierModal';

// Módulos administrativos: a API também exige perfil Supervisor nas operações correspondentes
const MODULOS_SOMENTE_SUPERVISOR: ModuloApp[] = ['importer', 'settings'];

const AcessoRestrito: React.FC<{ onVoltar: () => void }> = ({ onVoltar }) => (
  <div className="h-full flex items-center justify-center p-6">
    <div className="max-w-sm w-full bg-white border border-slate-200 rounded-3xl shadow-sm p-6 text-center">
      <h2 className="text-base font-bold text-slate-900">Acesso restrito</h2>
      <p className="text-sm text-slate-500 mt-2">
        Este módulo é exclusivo para Supervisores. Use "Trocar Operador" com uma matrícula de Supervisor para continuar.
      </p>
      <button
        type="button"
        onClick={onVoltar}
        className="mt-5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl"
      >
        Voltar ao Painel
      </button>
    </div>
  </div>
);

export const App: React.FC = () => {
  const { autenticado, operador } = useAuthStore();
  const isSupervisor = operador.role === 'Supervisor';
  const [moduloAtivo, setModuloAtivo] = useState<ModuloApp>('dashboard');
  const [sidebarColapsada, setSidebarColapsada] = useState(false);
  const [sidebarMobileAberta, setSidebarMobileAberta] = useState(false);
  const [isCashierModalOpen, setIsCashierModalOpen] = useState(false);

  // Atalho global Ctrl+B para colapsar menu lateral
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setSidebarColapsada((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelecionarModulo = (modulo: ModuloApp) => {
    setSidebarMobileAberta(false);
    if (modulo === 'cashier') {
      setModuloAtivo('cashier');
      return;
    }
    setModuloAtivo(modulo);
  };

  // 1. Se não estiver autenticado, exibe a tela de Login exatamente fiel ao vídeo (LoginView)
  if (!autenticado) {
    return <LoginView />;
  }

  // 2. Se autenticado, exibe a interface com visual clean, Sidebar branca e Header moderno
  return (
    <div className="w-screen h-screen flex bg-[#f5f7fb] text-slate-800 overflow-hidden font-sans select-none">
      {/* Menu Lateral Desktop */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar
          moduloAtivo={moduloAtivo}
          onSelecionarModulo={handleSelecionarModulo}
          colapsada={sidebarColapsada}
          onToggleColapso={() => setSidebarColapsada(!sidebarColapsada)}
        />
      </div>

      {/* Menu Lateral Mobile Drawer */}
      {sidebarMobileAberta && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarMobileAberta(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-2xl z-10">
            <Sidebar
              moduloAtivo={moduloAtivo}
              onSelecionarModulo={handleSelecionarModulo}
              colapsada={false}
              onToggleColapso={() => setSidebarMobileAberta(false)}
            />
          </div>
        </div>
      )}

      {/* Área Central de Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f5f7fb]">
        {/* Barra Superior Header (Fiel ao Vídeo) */}
        <div className="p-4 pb-0">
          <Header
            onToggleSidebarMobile={() => setSidebarMobileAberta(true)}
            onNavegarPara={(m) => handleSelecionarModulo(m as ModuloApp)}
          />
        </div>

        {/* Módulo Selecionado */}
        <main className="flex-1 p-4 overflow-y-auto custom-scrollbar">
          {moduloAtivo === 'dashboard' && (
            <DashboardView
              onNavegarPara={(m) => handleSelecionarModulo(m)}
              onAbrirConfigImpressora={() => setModuloAtivo('settings')}
              onAbrirBackupNuvem={() => setModuloAtivo('settings')}
            />
          )}

          {moduloAtivo === 'pos' && (
            <POSView onAbrirImportador={() => setModuloAtivo('importer')} />
          )}

          {moduloAtivo === 'cashier' && <CashierView />}

          {moduloAtivo === 'sales' && <SalesHistoryView />}

          {moduloAtivo === 'orders' && <ServiceOrdersView />}

          {moduloAtivo === 'reports' && <ReportsView />}

          {moduloAtivo === 'customers' && (
            <CustomersView onIniciarVendaCliente={() => setModuloAtivo('pos')} />
          )}

          {moduloAtivo === 'products' && <ProductsView />}

          {MODULOS_SOMENTE_SUPERVISOR.includes(moduloAtivo) && !isSupervisor && (
            <AcessoRestrito onVoltar={() => setModuloAtivo('dashboard')} />
          )}

          {moduloAtivo === 'importer' && isSupervisor && (
            <ImporterView onVoltarParaPdv={() => setModuloAtivo('pos')} />
          )}

          {moduloAtivo === 'settings' && isSupervisor && <SettingsView />}
        </main>
      </div>

      {/* Modal de Gestão de Caixa (acessível quando solicitado) */}
      <CashierModal
        isOpen={isCashierModalOpen}
        onClose={() => setIsCashierModalOpen(false)}
      />
    </div>
  );
};

export default App;
