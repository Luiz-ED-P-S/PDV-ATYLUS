import React, { useState, useEffect } from 'react';
import { DesktopTitlebar } from './components/DesktopTitlebar';
import { Sidebar, ModuloApp } from './components/Sidebar';
import { POSView } from './features/pos/POSView';
import { ProductsView } from './features/products/ProductsView';
import { SalesHistoryView } from './features/sales/SalesHistoryView';
import { ImporterView } from './features/importer/ImporterView';
import { SettingsView } from './features/settings/SettingsView';
import { CashierModal } from './features/cashier/CashierModal';

export const App: React.FC = () => {
  const [moduloAtivo, setModuloAtivo] = useState<ModuloApp>('pos');
  const [sidebarColapsada, setSidebarColapsada] = useState(false);
  const [isCashierModalOpen, setIsCashierModalOpen] = useState(false);

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

  return (
    <div className="w-screen h-screen flex flex-col bg-[#0b1118] text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. Barra de Título Desktop Integrada */}
      <DesktopTitlebar />

      {/* 2. Área de Trabalho Principal com Sidebar Colapsável */}
      <div className="flex-1 flex overflow-hidden">
        {/* Menu Lateral Estilo Hórus PDV */}
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
