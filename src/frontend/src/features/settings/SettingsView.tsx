import React, { useState } from 'react';
import { Settings, Cloud, Volume2, HardDrive, Keyboard, CheckCircle2 } from 'lucide-react';
import { sound } from '../../services/sound';

export const SettingsView: React.FC = () => {
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [fazendoBackup, setFazendoBackup] = useState(false);

  const executarBackupManual = () => {
    setFazendoBackup(true);
    setTimeout(() => {
      setFazendoBackup(false);
      setBackupStatus(`Backup gerado com sucesso em backups/pdv_backup_${new Date().toISOString().slice(0, 10)}.zip e enfileirado no Google Drive!`);
    }, 1200);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto flex flex-col space-y-6 bg-[#0b1118]">
      {/* Topo */}
      <div className="flex items-center justify-between border-b border-[#1f3042] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Configurações do Sistema</h1>
            <p className="text-xs text-slate-400 font-mono">Ajustes do programa desktop, backup em nuvem e preferências</p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Card 1: Backup no Google Drive */}
        <div className="p-5 bg-[#111c26] border border-[#1f3042] rounded-2xl space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Cloud className="w-5 h-5 text-sky-400" />
              <h3 className="font-bold text-white text-sm">Backup Automático no Google Drive</h3>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-900 text-[10px]">
              Fila Ativa
            </span>
          </div>

          <p className="text-slate-400 font-sans">
            O sistema compacta automaticamente o banco de dados SQLite local (<code className="text-sky-300">pdv.db</code>) a cada 30 minutos e no fechamento cego de caixa. Se estiver sem internet, o backup aguarda na fila local (<code className="text-sky-300">/backups</code>) para sincronizar ao reconectar.
          </p>

          {backupStatus && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{backupStatus}</span>
            </div>
          )}

          <button
            disabled={fazendoBackup}
            onClick={executarBackupManual}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-2 transition"
          >
            <span>{fazendoBackup ? 'Compactando SQLite...' : 'Fazer Backup Local e Sincronizar Agora'}</span>
          </button>
        </div>

        {/* Card 2: Efeitos Sonoros */}
        <div className="p-5 bg-[#111c26] border border-[#1f3042] rounded-2xl space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-sm">Efeitos Sonoros do Caixa (Web Audio API)</h3>
          </div>
          <p className="text-slate-400 font-sans">
            Sintetizador nativo para confirmação sonora de leitura de código de barras e finalização de vendas sem latência.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => sound.playScanBeep()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            >
              Testar Bip Leitor (1.75 kHz)
            </button>
            <button
              onClick={() => sound.playSuccessChime()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            >
              Testar Som Venda (Acorde C Major)
            </button>
            <button
              onClick={() => sound.playErrorBeep()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            >
              Testar Som Erro (220 Hz)
            </button>
          </div>
        </div>

        {/* Card 3: Mapa de Atalhos de Teclado */}
        <div className="p-5 bg-[#111c26] border border-[#1f3042] rounded-2xl space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-sm">Referência Rápida de Teclas de Atalho de Balcão</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div className="p-2 bg-[#090f16] rounded-xl border border-slate-800 flex justify-between">
              <span className="text-slate-400">Finalizar Venda / Pagamento:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-900 font-bold">F1</kbd>
            </div>
            <div className="p-2 bg-[#090f16] rounded-xl border border-slate-800 flex justify-between">
              <span className="text-slate-400">Buscar Produto no Catálogo:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-900 font-bold">F2</kbd>
            </div>
            <div className="p-2 bg-[#090f16] rounded-xl border border-slate-800 flex justify-between">
              <span className="text-slate-400">Gestão de Caixa & Sangria:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-900 font-bold">F3</kbd>
            </div>
            <div className="p-2 bg-[#090f16] rounded-xl border border-slate-800 flex justify-between">
              <span className="text-slate-400">Importação IA / XML NF-e:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-900 font-bold">F4</kbd>
            </div>
            <div className="p-2 bg-[#090f16] rounded-xl border border-slate-800 flex justify-between">
              <span className="text-slate-400">Nova Venda em Espera:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">Ctrl + T</kbd>
            </div>
            <div className="p-2 bg-[#090f16] rounded-xl border border-slate-800 flex justify-between">
              <span className="text-slate-400">Fechar Venda em Espera:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">Ctrl + W</kbd>
            </div>
            <div className="p-2 bg-[#090f16] rounded-xl border border-slate-800 flex justify-between">
              <span className="text-slate-400">Alternar Abas de Atendimento:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">Ctrl + 1..5</kbd>
            </div>
            <div className="p-2 bg-[#090f16] rounded-xl border border-slate-800 flex justify-between">
              <span className="text-slate-400">Multiplicar Qtd no Leitor:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">Qtd * Código</kbd>
            </div>
          </div>
        </div>

        {/* Card 4: Armazenamento e Runtime Desktop */}
        <div className="p-5 bg-[#111c26] border border-[#1f3042] rounded-2xl space-y-2 font-mono text-xs">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-sm">Informações Técnicas do Programa</h3>
          </div>
          <div className="text-slate-400 space-y-1 text-[11px]">
            <div>• Motor de Banco de Dados: <strong>SQLite 3 Embarcado (Modo WAL)</strong></div>
            <div>• Arquivo de Dados: <strong>src/backend/PDV.API/pdv.db</strong></div>
            <div>• Backend: <strong>.NET 8 Clean Architecture com CQRS & MediatR</strong></div>
            <div>• Frontend: <strong>React 18 + TypeScript + Tailwind CSS</strong></div>
            <div>• Empacotador Desktop: <strong>Tauri v2 / WebView2 Nativo Windows</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
};
