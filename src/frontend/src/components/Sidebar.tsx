import React from 'react';
import {
  ShoppingCart,
  Package,
  History,
  Lock,
  FileSpreadsheet,
  Settings,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export type ModuloApp = 'pos' | 'products' | 'sales' | 'cashier' | 'importer' | 'settings';

interface SidebarProps {
  moduloAtivo: ModuloApp;
  onSelecionarModulo: (modulo: ModuloApp) => void;
  colapsada: boolean;
  onToggleColapso: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  moduloAtivo,
  onSelecionarModulo,
  colapsada,
  onToggleColapso,
}) => {
  const operador = useAuthStore(state => state.operador);

  const menus = [
    { id: 'pos' as ModuloApp, label: 'Frente de Caixa', icon: ShoppingCart, atalho: 'F1-F4' },
    { id: 'products' as ModuloApp, label: 'Produtos & Estoque', icon: Package, atalho: 'Catálogo' },
    { id: 'sales' as ModuloApp, label: 'Histórico de Vendas', icon: History, atalho: 'Turno' },
    { id: 'cashier' as ModuloApp, label: 'Controle de Caixa', icon: Lock, atalho: 'F3' },
    { id: 'importer' as ModuloApp, label: 'Importador IA & XML', icon: FileSpreadsheet, atalho: 'F4' },
    { id: 'settings' as ModuloApp, label: 'Configurações', icon: Settings, atalho: 'Sistema' },
  ];

  return (
    <aside
      className={`bg-[#0c141d] border-r border-[#1a2938] flex flex-col justify-between transition-all duration-200 select-none z-40 ${
        colapsada ? 'w-16' : 'w-64'
      }`}
    >
      {/* Topo da Sidebar: Navegação Principal */}
      <div className="flex flex-col">
        {/* Botão de Colapso do Menu */}
        <div className="p-3 border-b border-[#1a2938] flex items-center justify-between">
          {!colapsada && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold font-mono">
                H
              </div>
              <div>
                <span className="font-extrabold text-sm text-white tracking-wide block">HÓRUS PDV</span>
                <span className="text-[10px] text-slate-500 font-mono">Painel Comercial</span>
              </div>
            </div>
          )}

          <button
            onClick={onToggleColapso}
            title={colapsada ? 'Expandir Menu (Ctrl+B)' : 'Recolher Menu (Ctrl+B)'}
            className={`p-1.5 rounded-lg bg-[#14212e] hover:bg-[#1a2b3c] text-slate-400 hover:text-white transition ${colapsada ? 'mx-auto' : ''}`}
          >
            {colapsada ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Lista de Itens do Menu */}
        <nav className="p-2 space-y-1">
          {menus.map(item => {
            const isAtivo = moduloAtivo === item.id;
            const Icone = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => onSelecionarModulo(item.id)}
                title={colapsada ? `${item.label} (${item.atalho})` : undefined}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl font-medium text-xs transition relative group ${
                  isAtivo
                    ? 'bg-sky-600 text-white font-bold shadow-lg shadow-sky-600/30'
                    : 'text-slate-400 hover:bg-[#14212e] hover:text-slate-200'
                }`}
              >
                <Icone className={`w-5 h-5 shrink-0 ${isAtivo ? 'text-white' : 'text-slate-400 group-hover:text-sky-400'}`} />

                {!colapsada && (
                  <div className="flex-1 flex items-center justify-between truncate">
                    <span className="truncate">{item.label}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isAtivo ? 'bg-sky-700 text-white' : 'bg-[#14212e] text-slate-500'}`}>
                      {item.atalho}
                    </span>
                  </div>
                )}

                {/* Marcador lateral ativo */}
                {isAtivo && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Rodapé da Sidebar: Operador Logado */}
      <div className="p-3 border-t border-[#1a2938] bg-[#090f16]">
        <div className={`flex items-center gap-2.5 ${colapsada ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md shrink-0">
            <User className="w-5 h-5" />
          </div>

          {!colapsada && (
            <div className="truncate text-xs font-mono">
              <span className="text-white font-bold block truncate">{operador.nome}</span>
              <span className="text-[10px] text-slate-500">{operador.matricula} • {operador.role}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
