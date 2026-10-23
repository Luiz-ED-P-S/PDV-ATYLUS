import React, { useState, useEffect } from 'react';
import { Minus, Square, X, WifiOff, Clock } from 'lucide-react';

export const DesktopTitlebar: React.FC = () => {
  const [hora, setHora] = useState(new Date().toLocaleTimeString('pt-BR'));
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setHora(new Date().toLocaleTimeString('pt-BR'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleMinimize = () => {
    // Integração futura com Tauri window.minimize()
    console.log('Minimizar janela');
  };

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
    // Integração futura com Tauri window.toggleMaximize()
  };

  const handleClose = () => {
    if (confirm('Deseja realmente fechar o sistema PDV? O caixa permanecerá salvo localmente.')) {
      window.close();
    }
  };

  return (
    <div className="h-8 bg-[#070c12] border-b border-[#162330] flex items-center justify-between px-3 select-none text-xs font-mono text-slate-400 z-50">
      {/* Lado Esquerdo: Identidade do Software */}
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
        <span className="font-extrabold text-slate-100 tracking-wider">ATYLUS PDV</span>
        <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-900/50">
          Desktop Pro
        </span>
      </div>

      {/* Centro: Status de Operação Offline e Relógio */}
      <div className="flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-900/60">
          <WifiOff className="w-3 h-3 text-emerald-400" />
          <span>Operação 100% Offline-First</span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          <Clock className="w-3 h-3 text-sky-400" />
          <span className="font-bold text-slate-300">{hora}</span>
        </div>
      </div>

      {/* Lado Direito: Botões de Janela Desktop */}
      <div className="flex items-center gap-1 -mr-1">
        <button
          onClick={handleMinimize}
          className="w-7 h-6 flex items-center justify-center hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
          title="Minimizar"
        >
          <Minus className="w-3 h-3" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-7 h-6 flex items-center justify-center hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
          title="Maximizar / Restaurar"
        >
          <Square className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={handleClose}
          className="w-7 h-6 flex items-center justify-center hover:bg-red-600 rounded text-slate-400 hover:text-white transition"
          title="Fechar Aplicativo"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
