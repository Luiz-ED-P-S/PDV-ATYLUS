import React, { useState, useEffect } from 'react';
import { Clock, Cloud, CloudOff, RefreshCw, User, LogOut } from 'lucide-react';
import { pdvApi } from '../services/api';
import { StatusSincronizacao } from '../types';
import { useAuthStore } from '../store/useAuthStore';

export const DesktopTitlebar: React.FC = () => {
  const [hora, setHora] = useState(new Date().toLocaleTimeString('pt-BR'));
  const [syncStatus, setSyncStatus] = useState<StatusSincronizacao | null>(null);
  const [sincronizandoManual, setSincronizandoManual] = useState(false);
  const operador = useAuthStore(state => state.operador);

  const carregarStatusSync = async () => {
    try {
      const status = await pdvApi.obterStatusSync();
      setSyncStatus(status);
    } catch {
      // API backend offline momentaneamente
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setHora(new Date().toLocaleTimeString('pt-BR'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    carregarStatusSync();
    const interval = setInterval(carregarStatusSync, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleForcarSync = async () => {
    if (sincronizandoManual) return;
    try {
      setSincronizandoManual(true);
      await pdvApi.forcarSincronizacao();
      await carregarStatusSync();
    } catch (err) {
      console.error(err);
    } finally {
      setSincronizandoManual(false);
    }
  };

  return (
    <div className="h-8 bg-[#070c12] border-b border-[#162330] flex items-center justify-between px-3 select-none text-xs font-mono text-slate-400 z-50">
      {/* Lado Esquerdo: Identidade do Software */}
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
        <span className="font-extrabold text-slate-100 tracking-wider">ATYLUS PDV</span>
        <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-900/50">
          Frente de Caixa
        </span>
        {syncStatus && (
          <span className="text-[10px] text-sky-400 bg-sky-950/60 px-1.5 py-0.2 rounded border border-sky-900/50">
            Terminal: {syncStatus.terminalId}
          </span>
        )}
      </div>

      {/* Lado Direito: Status de Operação Offline-First e Relógio */}
      <div className="flex items-center gap-3 text-[11px]">
        {syncStatus && (
          <button
            onClick={handleForcarSync}
            disabled={sincronizandoManual}
            title={
              syncStatus.online
                ? `Nuvem Conectada: ${syncStatus.pendentes} pendente(s). Clique para sincronizar agora.`
                : 'Modo Offline: Registros mantidos em fila local Standby. Clique para tentar reconectar.'
            }
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border transition cursor-pointer ${
              syncStatus.online
                ? syncStatus.pendentes === 0
                  ? 'bg-emerald-950/50 border-emerald-900/60 text-emerald-300 hover:bg-emerald-900/40'
                  : 'bg-amber-950/50 border-amber-900/60 text-amber-300 hover:bg-amber-900/40'
                : 'bg-rose-950/50 border-rose-900/60 text-rose-300 hover:bg-rose-900/40'
            }`}
          >
            {sincronizandoManual ? (
              <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
            ) : syncStatus.online ? (
              <Cloud className="w-3 h-3 text-emerald-400" />
            ) : (
              <CloudOff className="w-3 h-3 text-rose-400" />
            )}

            <span>
              {sincronizandoManual
                ? 'Sincronizando...'
                : syncStatus.online
                ? syncStatus.pendentes === 0
                  ? 'Nuvem Conectada'
                  : `Standby Nuvem (${syncStatus.pendentes} pendentes)`
                : `Offline (Standby Ativo: ${syncStatus.pendentes})`}
            </span>
          </button>
        )}

        <div className="flex items-center gap-1.5 text-slate-400">
          <Clock className="w-3 h-3 text-sky-400" />
          <span className="font-bold text-slate-300">{hora}</span>
        </div>

        {operador && (
          <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-2 py-0.5 rounded-md text-slate-300">
            <User className="w-3 h-3 text-sky-400" />
            <span className="font-bold text-slate-200">{operador.nome}</span>
            <span className="text-[10px] text-slate-500 font-mono">({operador.matricula})</span>
            <button
              onClick={() => useAuthStore.getState().logout()}
              title="Bloquear / Trocar Operador"
              className="ml-1 p-0.5 text-rose-400 hover:text-rose-300 transition"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
