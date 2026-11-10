import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Lock,
  History,
  Wrench,
  FileBarChart,
  Users,
  Package,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export type ModuloApp =
  | 'dashboard'
  | 'pos'
  | 'cashier'
  | 'sales'
  | 'orders'
  | 'reports'
  | 'customers'
  | 'products'
  | 'importer'
  | 'settings';

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
  const menusPrincipais = [
    { id: 'dashboard' as ModuloApp, label: 'Painel', icon: LayoutDashboard },
    { id: 'pos' as ModuloApp, label: 'Nova Venda', icon: ShoppingCart },
    { id: 'cashier' as ModuloApp, label: 'Caixa', icon: Lock },
    { id: 'sales' as ModuloApp, label: 'Vendas', icon: History },
    { id: 'orders' as ModuloApp, label: 'Ordens de Serviço', icon: Wrench },
    { id: 'reports' as ModuloApp, label: 'Relatórios', icon: FileBarChart },
  ];

  const menusLoja = [
    { id: 'customers' as ModuloApp, label: 'Clientes', icon: Users },
    { id: 'products' as ModuloApp, label: 'Produtos', icon: Package },
  ];

  return (
    <aside
      className={`bg-white border-r border-slate-200/90 flex flex-col justify-between transition-all duration-300 select-none z-30 shadow-sm ${
        colapsada ? 'w-20' : 'w-64'
      }`}
    >
      {/* Topo: Logo Oficial e Menus */}
      <div className="flex flex-col">
        {/* Logo Atylus PDV */}
        <div className="p-5 flex items-center justify-between border-b border-slate-100/80">
          {!colapsada ? (
            <div className="flex items-center gap-3">
              {/* Ícone de Carrinho Azul Royal com Linhas de Movimento */}
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#005bf8] flex items-center justify-center shrink-0 shadow-sm border border-blue-100/60">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 48 48">
                  <path d="M4 14h10v3H4zm-2 7h12v3H2zm4 7h8v3H6z" opacity="0.9" />
                  <path d="M16 11h24l-3.5 14.5H20.5L16 11zm1.5-3.5H12l-1 4H4v3h5.5l5 20h23v-3.5H18.2l-.9-3.5h18.2a2 2 0 001.95-1.55l3.8-15.5a2 2 0 00-1.95-2.45H17.5z" />
                  <circle cx="21" cy="38" r="3.5" />
                  <circle cx="35" cy="38" r="3.5" />
                </svg>
              </div>
              <div className="leading-none">
                <span className="font-extrabold text-base tracking-tight text-slate-900 block">
                  PDV <span className="text-[#005bf8]">ATYLUS</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider flex items-center gap-1 mt-0.5 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  OPEN
                </span>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#005bf8] flex items-center justify-center mx-auto shadow-sm">
              <ShoppingCart className="w-5 h-5" />
            </div>
          )}

          <button
            onClick={onToggleColapso}
            className="hidden lg:flex p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
            title={colapsada ? 'Expandir Menu' : 'Recolher Menu'}
          >
            {colapsada ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Grupo 1: MENU */}
        <div className="px-3 pt-4">
          {!colapsada && (
            <span className="px-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase block mb-2">
              Menu
            </span>
          )}
          <nav className="space-y-1">
            {menusPrincipais.map((item) => {
              const isAtivo = moduloAtivo === item.id;
              const Icone = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelecionarModulo(item.id)}
                  title={colapsada ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all relative ${
                    isAtivo
                      ? 'bg-blue-50 text-[#005bf8] font-bold shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  } ${colapsada ? 'justify-center px-0' : ''}`}
                >
                  <Icone
                    className={`w-5 h-5 shrink-0 ${
                      isAtivo ? 'text-[#005bf8]' : 'text-slate-500'
                    }`}
                  />
                  {!colapsada && <span>{item.label}</span>}
                  {isAtivo && !colapsada && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#005bf8] rounded-r-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Grupo 2: LOJA */}
        <div className="px-3 pt-6">
          {!colapsada && (
            <span className="px-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase block mb-2">
              Loja
            </span>
          )}
          <nav className="space-y-1">
            {menusLoja.map((item) => {
              const isAtivo = moduloAtivo === item.id;
              const Icone = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelecionarModulo(item.id)}
                  title={colapsada ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all relative ${
                    isAtivo
                      ? 'bg-blue-50 text-[#005bf8] font-bold shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  } ${colapsada ? 'justify-center px-0' : ''}`}
                >
                  <Icone
                    className={`w-5 h-5 shrink-0 ${
                      isAtivo ? 'text-[#005bf8]' : 'text-slate-500'
                    }`}
                  />
                  {!colapsada && <span>{item.label}</span>}
                  {isAtivo && !colapsada && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#005bf8] rounded-r-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Rodapé da Sidebar: Card Gradiente Azul Escuro com Estrelas */}
      <div className="p-3">
        {!colapsada ? (
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0c1833] via-[#0b1736] to-[#071026] text-white rounded-3xl p-4 shadow-lg border border-slate-800/40">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white tracking-tight">
                Nova versão disponível
              </span>
            </div>
            <p className="text-[11px] text-slate-300/90 leading-tight">
              Obtenha as melhores funcionalidades.
            </p>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0c1833] to-[#071026] text-blue-400 flex items-center justify-center mx-auto shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
        )}
      </div>
    </aside>
  );
};
