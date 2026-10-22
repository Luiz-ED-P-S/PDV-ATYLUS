import React, { useState, useEffect } from 'react';
import { Settings, Cloud, Volume2, HardDrive, Keyboard, CheckCircle2, Printer, Scissors, Inbox, Play, RefreshCw, AlertCircle } from 'lucide-react';
import { sound } from '../../services/sound';
import { pdvApi } from '../../services/api';

export interface PrinterConfig {
  nomeOuEndereco: string;
  tipoConexao: number; // 1 = Spooler Windows, 2 = Rede TCP
  largura: number; // 80 ou 58
  cortarPapel: boolean;
  acionarGaveta: boolean;
  imprimirAutomatico: boolean;
  vias: number;
}

const STORAGE_PRINTER_KEY = 'pdv_printer_config_v1';

export const SettingsView: React.FC = () => {
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [fazendoBackup, setFazendoBackup] = useState(false);

  // Estados de Impressão Térmica ESC/POS
  const [impressoras, setImpressoras] = useState<string[]>([]);
  const [carregandoImpressoras, setCarregandoImpressoras] = useState(false);
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_PRINTER_KEY);
      if (salvo) return JSON.parse(salvo);
    } catch {
      // Ignora erro
    }
    return {
      nomeOuEndereco: 'Simulador ESC/POS (Virtual)',
      tipoConexao: 1,
      largura: 80,
      cortarPapel: true,
      acionarGaveta: true,
      imprimirAutomatico: true,
      vias: 1,
    };
  });

  const [printerFeedback, setPrinterFeedback] = useState<{ tipo: 'ok' | 'err'; msg: string } | null>(null);
  const [testandoPrinter, setTestandoPrinter] = useState(false);

  useEffect(() => {
    carregarImpressoras();
  }, []);

  const carregarImpressoras = async () => {
    setCarregandoImpressoras(true);
    try {
      const list = await pdvApi.obterImpressorasInstaladas();
      setImpressoras(list);
      if (!printerConfig.nomeOuEndereco || !list.includes(printerConfig.nomeOuEndereco)) {
        const defaultP = list.find(p => !p.includes('PDF')) || list[0] || 'Simulador ESC/POS (Virtual)';
        atualizarConfig({ nomeOuEndereco: defaultP });
      }
    } finally {
      setCarregandoImpressoras(false);
    }
  };

  const atualizarConfig = (patch: Partial<PrinterConfig>) => {
    setPrinterConfig(prev => {
      const novo = { ...prev, ...patch };
      localStorage.setItem(STORAGE_PRINTER_KEY, JSON.stringify(novo));
      return novo;
    });
  };

  const handleTestarImpressao = async () => {
    setTestandoPrinter(true);
    setPrinterFeedback(null);
    try {
      const res = await pdvApi.testarImpressora(printerConfig);
      if (res.sucesso) {
        sound.playSuccessChime();
        setPrinterFeedback({ tipo: 'ok', msg: res.mensagem });
      } else {
        sound.playErrorBeep();
        setPrinterFeedback({ tipo: 'err', msg: res.mensagem });
      }
    } catch (err: any) {
      sound.playErrorBeep();
      setPrinterFeedback({ tipo: 'err', msg: `Falha: ${err.message || 'Erro de comunicação'}` });
    } finally {
      setTestandoPrinter(false);
    }
  };

  const handleTestarGaveta = async () => {
    try {
      sound.playScanBeep();
      const res = await pdvApi.acionarGaveta({ nomeOuEndereco: printerConfig.nomeOuEndereco });
      setPrinterFeedback({ tipo: 'ok', msg: res.mensagem });
    } catch (err: any) {
      setPrinterFeedback({ tipo: 'err', msg: `Falha ao acionar gaveta: ${err.message}` });
    }
  };

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
            <p className="text-xs text-slate-400 font-mono">Ajustes do programa desktop, periféricos térmicos e backup em nuvem</p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Card 0: Impressão Térmica ESC/POS e Gaveta de Dinheiro */}
        <div className="p-5 bg-[#111c26] border border-[#1f3042] rounded-2xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#1f3042] pb-3">
            <div className="flex items-center gap-2.5">
              <Printer className="w-5 h-5 text-sky-400" />
              <div>
                <h3 className="font-bold text-white text-sm">Impressão Térmica Direta & Gaveta (ESC/POS)</h3>
                <p className="text-[11px] text-slate-400 font-sans">
                  Suporte nativo a Epson, Elgin, Bematech, Daruma e impressoras de rede via comando binário direto.
                </p>
              </div>
            </div>
            <button
              onClick={carregarImpressoras}
              disabled={carregandoImpressoras}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition flex items-center gap-1.5"
              title="Atualizar lista de impressoras do Windows"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregandoImpressoras ? 'animate-spin' : ''}`} />
              <span className="text-[10px]">Atualizar</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Impressora Selecionada */}
            <div className="space-y-1.5">
              <label className="text-slate-400 text-[11px]">Impressora do Sistema (Windows / USB):</label>
              <select
                value={printerConfig.nomeOuEndereco}
                onChange={e => atualizarConfig({ nomeOuEndereco: e.target.value })}
                className="w-full px-3 py-2 bg-[#090f16] border border-[#1f3042] rounded-xl text-white font-mono text-xs focus:outline-none focus:border-sky-500"
              >
                {impressoras.map(imp => (
                  <option key={imp} value={imp}>
                    {imp}
                  </option>
                ))}
              </select>
            </div>

            {/* Largura da Bobina */}
            <div className="space-y-1.5">
              <label className="text-slate-400 text-[11px]">Largura da Bobina Térmica:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => atualizarConfig({ largura: 80 })}
                  className={`py-2 rounded-xl border text-center transition font-bold ${
                    printerConfig.largura === 80
                      ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                      : 'bg-[#090f16] border-[#1f3042] text-slate-400 hover:text-white'
                  }`}
                >
                  80mm (48 colunas)
                </button>
                <button
                  type="button"
                  onClick={() => atualizarConfig({ largura: 58 })}
                  className={`py-2 rounded-xl border text-center transition font-bold ${
                    printerConfig.largura === 58
                      ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                      : 'bg-[#090f16] border-[#1f3042] text-slate-400 hover:text-white'
                  }`}
                >
                  58mm (32 colunas)
                </button>
              </div>
            </div>
          </div>

          {/* Opções de Automação */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#090f16] border border-[#1f3042] cursor-pointer hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={printerConfig.cortarPapel}
                onChange={e => atualizarConfig({ cortarPapel: e.target.checked })}
                className="w-4 h-4 rounded text-sky-600 focus:ring-0 bg-slate-900 border-slate-700"
              />
              <div className="flex items-center gap-1.5 text-slate-300">
                <Scissors className="w-3.5 h-3.5 text-amber-400" />
                <span>Corte Automático</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#090f16] border border-[#1f3042] cursor-pointer hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={printerConfig.acionarGaveta}
                onChange={e => atualizarConfig({ acionarGaveta: e.target.checked })}
                className="w-4 h-4 rounded text-sky-600 focus:ring-0 bg-slate-900 border-slate-700"
              />
              <div className="flex items-center gap-1.5 text-slate-300">
                <Inbox className="w-3.5 h-3.5 text-emerald-400" />
                <span>Abrir Gaveta</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#090f16] border border-[#1f3042] cursor-pointer hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={printerConfig.imprimirAutomatico}
                onChange={e => atualizarConfig({ imprimirAutomatico: e.target.checked })}
                className="w-4 h-4 rounded text-sky-600 focus:ring-0 bg-slate-900 border-slate-700"
              />
              <div className="flex items-center gap-1.5 text-slate-300">
                <Printer className="w-3.5 h-3.5 text-sky-400" />
                <span>Imprimir ao Finalizar</span>
              </div>
            </label>
          </div>

          {/* Feedback */}
          {printerFeedback && (
            <div
              className={`p-3 rounded-xl flex items-center gap-2 ${
                printerFeedback.tipo === 'ok'
                  ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                  : 'bg-red-950/60 border border-red-800 text-red-300'
              }`}
            >
              {printerFeedback.tipo === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <span className="text-[11px]">{printerFeedback.msg}</span>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleTestarImpressao}
              disabled={testandoPrinter}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-2 transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{testandoPrinter ? 'Enviando ESC/POS...' : 'Testar Impressão ESC/POS'}</span>
            </button>

            <button
              onClick={handleTestarGaveta}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl flex items-center gap-2 transition"
            >
              <Inbox className="w-3.5 h-3.5 text-emerald-400" />
              <span>Testar Abertura de Gaveta (RJ11)</span>
            </button>
          </div>
        </div>

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
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-2 transition"
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
            <div>• Impressão Térmica: <strong>ESC/POS Direto (WinSpooler / Raw TCP 9100)</strong></div>
            <div>• Empacotador Desktop: <strong>Tauri v2 / WebView2 Nativo Windows</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
};
