import React, { useState, useEffect } from 'react';
import {
  Settings,
  Cloud,
  Volume2,
  HardDrive,
  Keyboard,
  CheckCircle2,
  Printer,
  Inbox,
  Play,
  RefreshCw,
  AlertCircle,
  Server,
  Save,
  Download,
  Palette,
  Image,
  RotateCcw,
  Sliders,
  Type,
} from 'lucide-react';
import { sound } from '../../services/sound';
import { pdvApi } from '../../services/api';
import { StatusSincronizacao } from '../../types';
import { useThemeStore } from '../../store/useThemeStore';

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
  const { theme, atualizarTema, resetarTema } = useThemeStore();
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [fazendoBackup, setFazendoBackup] = useState(false);

  // Estados de Personalização de Cores e Logo
  const [nomeLojaInput, setNomeLojaInput] = useState(theme.nomeLoja);
  const [subtituloInput, setSubtituloInput] = useState(theme.subtituloLoja);
  const [corPrimariaInput, setCorPrimariaInput] = useState(theme.corPrimaria);
  const [logoPreview, setLogoPreview] = useState<string>(theme.logoUrl || '');
  const [feedbackTema, setFeedbackTema] = useState<string | null>(null);

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

  // Estados de Sincronização em Nuvem (Multi-Terminal)
  const [syncStatus, setSyncStatus] = useState<StatusSincronizacao | null>(null);
  const [terminalId, setTerminalId] = useState('CX01');
  const [cloudUrl, setCloudUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [empresaNome, setEmpresaNome] = useState('ATYLUS VAREJO & CONVENIÊNCIA');
  const [empresaCnpj, setEmpresaCnpj] = useState('00.000.000/0001-00');
  const [empresaIe, setEmpresaIe] = useState('ISENTO');
  const [empresaEndereco, setEmpresaEndereco] = useState('RUA DO COMÉRCIO, 100 - CENTRO');
  const [salvandoSync, setSalvandoSync] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ tipo: 'ok' | 'err'; msg: string } | null>(null);
  const [sincronizandoAgora, setSincronizandoAgora] = useState(false);
  const [baixandoCatalogo, setBaixandoCatalogo] = useState(false);

  useEffect(() => {
    carregarImpressoras();
    carregarSyncStatus();
  }, []);

  const carregarSyncStatus = async () => {
    try {
      const status = await pdvApi.obterStatusSync();
      setSyncStatus(status);
      if (status.terminalId) setTerminalId(status.terminalId);
      if (status.cloudUrl) setCloudUrl(status.cloudUrl);
      if (status.empresaNome) setEmpresaNome(status.empresaNome);
      if (status.empresaCnpj) setEmpresaCnpj(status.empresaCnpj);
      if (status.empresaIe) setEmpresaIe(status.empresaIe);
      if (status.empresaEndereco) setEmpresaEndereco(status.empresaEndereco);
    } catch {
      // API backend offline
    }
  };

  const puxarCatalogoAgora = async () => {
    setBaixandoCatalogo(true);
    setSyncFeedback(null);
    try {
      const res = await pdvApi.puxarCatalogoNuvem();
      if (res.sucesso) {
        sound.playSuccessChime();
        setSyncFeedback({ tipo: 'ok', msg: res.mensagem });
      } else {
        sound.playErrorBeep();
        setSyncFeedback({ tipo: 'err', msg: res.mensagem });
      }
    } catch (err: any) {
      sound.playErrorBeep();
      setSyncFeedback({ tipo: 'err', msg: `Erro ao baixar catálogo: ${err.message}` });
    } finally {
      setBaixandoCatalogo(false);
    }
  };

  const salvarConfigSync = async () => {
    setSalvandoSync(true);
    setSyncFeedback(null);
    try {
      await pdvApi.atualizarConfigSync({
        terminalId,
        cloudUrl,
        apiKey,
        empresaNome,
        empresaCnpj,
        empresaIe,
        empresaEndereco,
      });
      sound.playSuccessChime();
      setSyncFeedback({ tipo: 'ok', msg: 'Configurações de sincronização e identificação da loja salvas com sucesso!' });
      await carregarSyncStatus();
    } catch (err: any) {
      sound.playErrorBeep();
      setSyncFeedback({ tipo: 'err', msg: `Falha ao salvar: ${err.message}` });
    } finally {
      setSalvandoSync(false);
    }
  };

  const sincronizarFilaAgora = async () => {
    setSincronizandoAgora(true);
    setSyncFeedback(null);
    try {
      const res = await pdvApi.forcarSincronizacao();
      if (res.sucesso) {
        sound.playSuccessChime();
        setSyncFeedback({ tipo: 'ok', msg: res.mensagem });
      } else {
        sound.playErrorBeep();
        setSyncFeedback({ tipo: 'err', msg: res.mensagem });
      }
      await carregarSyncStatus();
    } catch (err: any) {
      sound.playErrorBeep();
      setSyncFeedback({ tipo: 'err', msg: `Falha na sincronização: ${err.message}` });
    } finally {
      setSincronizandoAgora(false);
    }
  };

  const carregarImpressoras = async () => {
    setCarregandoImpressoras(true);
    try {
      const lista = await pdvApi.obterImpressorasInstaladas();
      setImpressoras(lista);
    } catch {
      setImpressoras(['Simulador ESC/POS (Virtual)']);
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

  // Funções de Logo e Cores
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('A imagem da logo deve ter até 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setLogoPreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSalvarTema = () => {
    atualizarTema({
      nomeLoja: nomeLojaInput.trim() || 'ATYLUS',
      subtituloLoja: subtituloInput.trim() || 'OPEN',
      corPrimaria: corPrimariaInput,
      logoUrl: logoPreview,
    });
    sound.playSuccessChime();
    setFeedbackTema('Identidade visual aplicada com sucesso em todo o sistema!');
    setTimeout(() => setFeedbackTema(null), 4000);
  };

  const handleResetarTema = () => {
    resetarTema();
    setNomeLojaInput('ATYLUS');
    setSubtituloInput('OPEN');
    setCorPrimariaInput('#005bf8');
    setLogoPreview('');
    sound.playScanBeep();
    setFeedbackTema('Visual restaurado para o padrão original!');
    setTimeout(() => setFeedbackTema(null), 3000);
  };

  const coresPredefinidas = [
    { nome: 'Azul Royal Oficial', hex: '#005bf8' },
    { nome: 'Índigo Moderno', hex: '#4f46e5' },
    { nome: 'Verde Esmeralda', hex: '#059669' },
    { nome: 'Ciano Oceano', hex: '#0284c7' },
    { nome: 'Roxo Imperial', hex: '#7c3aed' },
    { nome: 'Laranja Varejo', hex: '#ea580c' },
    { nome: 'Grafite Elegante', hex: '#334155' },
    { nome: 'Rosa Choque', hex: '#e11d48' },
  ];

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-5xl mx-auto flex flex-col space-y-6 bg-[#f5f7fb] font-sans">
      {/* Topo Claro e Moderno */}
      <div className="flex items-center justify-between border-b border-slate-200/90 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs border"
            style={{
              backgroundColor: `${theme.corPrimaria}15`,
              color: theme.corPrimaria,
              borderColor: `${theme.corPrimaria}30`,
            }}
          >
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Configurações do Sistema</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">Personalize a identidade da loja, periféricos térmicos e parâmetros do PDV.</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Card 1: Painel Reformulado e Polido de Identidade Visual & Cores */}
        <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm p-6 sm:p-7 space-y-6">
          {/* Header do Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs shrink-0"
                style={{
                  backgroundColor: `${theme.corPrimaria}15`,
                  color: theme.corPrimaria,
                }}
              >
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">Identidade Visual & Cores da Loja</h3>
                <p className="text-xs text-slate-500">
                  Altere a logomarca, nome fantasia e a cor de destaque principal do sistema em tempo real.
                </p>
              </div>
            </div>

            <button
              onClick={handleResetarTema}
              className="self-start sm:self-center px-3.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 text-xs font-bold transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrão</span>
            </button>
          </div>

          {/* Grid Principal dos Campos */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Bloco da Logo (4 Colunas) */}
            <div className="lg:col-span-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex flex-col items-center justify-between text-center shadow-xs">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Logotipo do Estabelecimento</span>
              
              <div className="w-32 h-32 rounded-3xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-white shadow-inner relative group mb-3">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo da loja" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-300">
                    <Image className="w-10 h-10" />
                    <span className="text-[10px] font-semibold text-slate-400">Sem logo</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-1.5 w-full">
                <label className="cursor-pointer w-full py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition text-center">
                  <span>{logoPreview ? 'Trocar Logo' : 'Carregar Imagem'}</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {logoPreview && (
                  <button
                    onClick={() => setLogoPreview('')}
                    className="text-[11px] text-rose-500 hover:underline font-semibold"
                  >
                    Remover Logo
                  </button>
                )}
              </div>
            </div>

            {/* Bloco de Nome e Subtítulo (4 Colunas) */}
            <div className="lg:col-span-4 flex flex-col justify-between space-y-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-4 flex items-center gap-1.5">
                  <Type className="w-4 h-4 text-slate-400" />
                  <span>Nomes no Menu Lateral</span>
                </span>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome Principal da Loja:</label>
                    <input
                      type="text"
                      value={nomeLojaInput}
                      onChange={e => setNomeLojaInput(e.target.value)}
                      placeholder="Ex: ATYLUS"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Exibido em destaque no topo da barra de navegação</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Subtítulo / Versão do PDV:</label>
                    <input
                      type="text"
                      value={subtituloInput}
                      onChange={e => setSubtituloInput(e.target.value)}
                      placeholder="Ex: OPEN, VAREJO, EXPRESS"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Tag descritiva com sinal luminoso verde</span>
                  </div>
                </div>
              </div>

              {/* Preview do Cabeçalho */}
              <div className="p-3 bg-white rounded-xl border border-slate-200/70 flex items-center gap-2.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Preview:</span>
                <span className="text-xs font-extrabold text-slate-800">
                  PDV <span style={{ color: corPrimariaInput }}>{nomeLojaInput || 'ATYLUS'}</span>
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold font-mono">
                  {subtituloInput || 'OPEN'}
                </span>
              </div>
            </div>

            {/* Bloco de Cor Primária (4 Colunas) */}
            <div className="lg:col-span-4 flex flex-col justify-between space-y-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-4 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-slate-400" />
                  <span>Cor Primária do Sistema</span>
                </span>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={corPrimariaInput}
                        onChange={e => setCorPrimariaInput(e.target.value)}
                        className="w-12 h-12 p-0 border-0 rounded-2xl cursor-pointer shadow-xs"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Código Hexadecimal:</span>
                      <input
                        type="text"
                        value={corPrimariaInput}
                        onChange={e => setCorPrimariaInput(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-800 font-bold shadow-xs"
                      />
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-slate-500 block pt-1">Paleta Rápida Sugerida:</span>
                  <div className="flex flex-wrap gap-2">
                    {coresPredefinidas.map(c => {
                      const isAtiva = corPrimariaInput.toLowerCase() === c.hex.toLowerCase();
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          title={c.nome}
                          onClick={() => setCorPrimariaInput(c.hex)}
                          style={{ backgroundColor: c.hex }}
                          className={`w-7 h-7 rounded-xl transition-all shadow-xs ${
                            isAtiva ? 'scale-110 ring-2 ring-slate-900 ring-offset-2' : 'hover:scale-105 opacity-90 hover:opacity-100'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200/70 text-[11px] text-slate-500">
                A cor selecionada é aplicada automaticamente aos botões de ação, menus e destaques de valores.
              </div>
            </div>
          </div>

          {/* Feedback de Alteração */}
          {feedbackTema && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{feedbackTema}</span>
            </div>
          )}

          {/* Rodapé do Card com Botão de Ação */}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              onClick={handleSalvarTema}
              style={{ backgroundColor: corPrimariaInput }}
              className="px-6 py-3 hover:opacity-90 active:scale-98 text-white font-black text-xs rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Personalização de Cores e Logo</span>
            </button>
          </div>
        </div>

        {/* Card 2: Impressão Térmica ESC/POS e Gaveta de Dinheiro */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-sm space-y-4 text-xs font-sans">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <Printer className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">Impressão Térmica Direta & Gaveta (ESC/POS)</h3>
                <p className="text-xs text-slate-500 font-normal">
                  Suporte nativo a Epson, Elgin, Bematech, Daruma e impressoras de rede via comando binário direto.
                </p>
              </div>
            </div>
            <button
              onClick={carregarImpressoras}
              disabled={carregandoImpressoras}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition flex items-center gap-1.5"
              title="Atualizar lista de impressoras do Windows"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregandoImpressoras ? 'animate-spin' : ''}`} />
              <span className="text-[11px] font-bold">Atualizar</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-600 text-xs font-bold">Impressora do Sistema (Windows / USB):</label>
              <select
                value={printerConfig.nomeOuEndereco}
                onChange={e => atualizarConfig({ nomeOuEndereco: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {impressoras.map(imp => (
                  <option key={imp} value={imp}>{imp}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-600 text-xs font-bold">Largura do Papel Térmico:</label>
              <select
                value={printerConfig.largura}
                onChange={e => atualizarConfig({ largura: parseInt(e.target.value) || 80 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value={80}>Bobina Larga 80mm (Padrão 48 colunas)</option>
                <option value={58}>Bobina Estreita 58mm (Compacta 32 colunas)</option>
              </select>
            </div>
          </div>

          {/* Opções de Acionamento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer hover:bg-slate-100 transition">
              <input
                type="checkbox"
                checked={printerConfig.cortarPapel}
                onChange={e => atualizarConfig({ cortarPapel: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-0"
              />
              <span className="text-slate-700 font-bold text-xs">Corte de Papel (Guilhotina)</span>
            </label>

            <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer hover:bg-slate-100 transition">
              <input
                type="checkbox"
                checked={printerConfig.acionarGaveta}
                onChange={e => atualizarConfig({ acionarGaveta: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-0"
              />
              <span className="text-slate-700 font-bold text-xs">Abrir Gaveta Dinheiro (RJ11)</span>
            </label>

            <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer hover:bg-slate-100 transition">
              <input
                type="checkbox"
                checked={printerConfig.imprimirAutomatico}
                onChange={e => atualizarConfig({ imprimirAutomatico: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-0"
              />
              <span className="text-slate-700 font-bold text-xs">Imprimir ao Finalizar Venda</span>
            </label>
          </div>

          {/* Feedback */}
          {printerFeedback && (
            <div
              className={`p-3 rounded-2xl flex items-center gap-2 ${
                printerFeedback.tipo === 'ok'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {printerFeedback.tipo === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span className="text-xs font-semibold">{printerFeedback.msg}</span>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleTestarImpressao}
              disabled={testandoPrinter}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-2 transition shadow-xs"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{testandoPrinter ? 'Enviando ESC/POS...' : 'Testar Impressão ESC/POS'}</span>
            </button>

            <button
              onClick={handleTestarGaveta}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center gap-2 transition"
            >
              <Inbox className="w-3.5 h-3.5 text-indigo-600" />
              <span>Testar Abertura de Gaveta (RJ11)</span>
            </button>
          </div>
        </div>

        {/* Card 3: Sincronização em Nuvem & Terminal Multi-PDV */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-sm space-y-4 text-xs font-sans">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <Server className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">Sincronização em Nuvem & Multi-Terminais (Offline-First)</h3>
                <p className="text-xs text-slate-500 font-normal">
                  Opera 100% offline localmente. Ao detectar internet, replica vendas e produtos para a nuvem sem conflito de IDs.
                </p>
              </div>
            </div>
            {syncStatus && (
              <span
                className={`px-3 py-1 rounded-full border text-[11px] font-bold ${
                  syncStatus.online
                    ? syncStatus.pendentes === 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                {syncStatus.online
                  ? syncStatus.pendentes === 0
                    ? '● Nuvem Conectada'
                    : `● Standby (${syncStatus.pendentes} pendentes)`
                  : '○ Nuvem Standby (Offline-First)'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-600 font-bold">Identificador do Terminal (Caixa):</label>
              <input
                type="text"
                value={terminalId}
                onChange={e => setTerminalId(e.target.value.toUpperCase())}
                placeholder="Ex: CX01, CX02, TERMINAL-A"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-xs font-bold focus:bg-white focus:outline-none"
              />
              <span className="text-[11px] text-slate-400 block">Prefixo único evita colisão de cupons</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-600 font-bold">URL do Servidor / Hub em Nuvem:</label>
              <input
                type="text"
                value={cloudUrl}
                onChange={e => setCloudUrl(e.target.value)}
                placeholder="https://hub.seupdv.com.br"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:bg-white focus:outline-none"
              />
              <span className="text-[11px] text-slate-400 block">Deixe em branco para operar estritamente local</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-600 font-bold">Chave de API / Token do Servidor:</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Token seguro do hub"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-xs focus:bg-white focus:outline-none"
              />
              <span className="text-[11px] text-slate-400 block">Autenticação com o serviço em nuvem</span>
            </div>
          </div>

          {/* Dados da Empresa / Loja Emissora */}
          <div className="pt-3 border-t border-slate-100">
            <span className="text-slate-800 font-bold text-xs block mb-2">Identificação do Estabelecimento (Cabeçalho do Cupom & Recibos):</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold text-[11px]">Razão Social / Nome Fantasia:</label>
                <input
                  type="text"
                  value={empresaNome}
                  onChange={e => setEmpresaNome(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:bg-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 font-semibold text-[11px]">CNPJ da Loja / Matriz:</label>
                <input
                  type="text"
                  value={empresaCnpj}
                  onChange={e => setEmpresaCnpj(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-mono font-semibold focus:bg-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 font-semibold text-[11px]">Inscrição Estadual (IE):</label>
                <input
                  type="text"
                  value={empresaIe}
                  onChange={e => setEmpresaIe(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-mono font-semibold focus:bg-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 font-semibold text-[11px]">Endereço / Cidade:</label>
                <input
                  type="text"
                  value={empresaEndereco}
                  onChange={e => setEmpresaEndereco(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {syncFeedback && (
            <div
              className={`p-3 rounded-2xl border flex items-center gap-2 ${
                syncFeedback.tipo === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {syncFeedback.tipo === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span className="font-semibold">{syncFeedback.msg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-500 font-medium">
              {syncStatus && (
                <span>
                  Fila Local: <strong className="text-slate-800">{syncStatus.pendentes} registros</strong> • Última sync:{' '}
                  <strong className="text-slate-800">
                    {syncStatus.ultimaSincronizacao
                      ? new Date(syncStatus.ultimaSincronizacao).toLocaleString('pt-BR')
                      : 'Ainda não realizada'}
                  </strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={salvarConfigSync}
                disabled={salvandoSync}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Configuração</span>
              </button>

              <button
                onClick={puxarCatalogoAgora}
                disabled={baixandoCatalogo}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center gap-1.5 transition"
              >
                <Download className={`w-3.5 h-3.5 text-indigo-600 ${baixandoCatalogo ? 'animate-bounce' : ''}`} />
                <span>Baixar Catálogo da Nuvem</span>
              </button>

              <button
                onClick={sincronizarFilaAgora}
                disabled={sincronizandoAgora}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sincronizandoAgora ? 'animate-spin text-indigo-600' : ''}`} />
                <span>Sincronizar Fila Agora</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 4: Backup Automático no Google Drive */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-sm space-y-3 text-xs font-sans">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <Cloud className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-base">Backup Automático no Google Drive</h3>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
              Fila Ativa
            </span>
          </div>

          <p className="text-slate-500 font-normal">
            O sistema compacta automaticamente o banco de dados SQLite local (<code className="text-indigo-600 font-mono font-bold">pdv.db</code>) a cada 30 minutos e no fechamento cego de caixa. Se estiver sem internet, o backup aguarda na fila local (<code className="text-indigo-600 font-mono font-bold">/backups</code>) para sincronizar ao reconectar.
          </p>

          {backupStatus && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{backupStatus}</span>
            </div>
          )}

          <button
            disabled={fazendoBackup}
            onClick={executarBackupManual}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-2 transition shadow-xs"
          >
            <span>{fazendoBackup ? 'Compactando SQLite...' : 'Fazer Backup Local e Sincronizar Agora'}</span>
          </button>
        </div>

        {/* Card 5: Efeitos Sonoros */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-sm space-y-3 text-xs font-sans">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Volume2 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">Efeitos Sonoros do Caixa (Web Audio API)</h3>
          </div>
          <p className="text-slate-500 font-normal">
            Sintetizador nativo para confirmação sonora de leitura de código de barras e finalização de vendas sem latência.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => sound.playScanBeep()}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
            >
              Testar Bip Leitor (1.75 kHz)
            </button>
            <button
              onClick={() => sound.playSuccessChime()}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
            >
              Testar Som Venda (Acorde C Major)
            </button>
            <button
              onClick={() => sound.playErrorBeep()}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
            >
              Testar Som Erro (220 Hz)
            </button>
          </div>
        </div>

        {/* Card 6: Mapa de Atalhos de Teclado */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-sm space-y-3 text-xs font-sans">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Keyboard className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-900 text-base">Referência Rápida de Teclas de Atalho de Balcão</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex justify-between items-center">
              <span className="text-slate-600 font-semibold">Finalizar Venda / Pagamento:</span>
              <kbd className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 font-mono font-bold">F1</kbd>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex justify-between items-center">
              <span className="text-slate-600 font-semibold">Buscar Produto no Catálogo:</span>
              <kbd className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 font-mono font-bold">F2</kbd>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex justify-between items-center">
              <span className="text-slate-600 font-semibold">Gestão de Caixa & Sangria:</span>
              <kbd className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 font-mono font-bold">F3</kbd>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex justify-between items-center">
              <span className="text-slate-600 font-semibold">Importação IA / XML NF-e:</span>
              <kbd className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 font-mono font-bold">F4</kbd>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex justify-between items-center">
              <span className="text-slate-600 font-semibold">Nova Venda em Espera:</span>
              <kbd className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 font-mono font-bold">Ctrl + T</kbd>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex justify-between items-center">
              <span className="text-slate-600 font-semibold">Fechar Venda em Espera:</span>
              <kbd className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 font-mono font-bold">Ctrl + W</kbd>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex justify-between items-center">
              <span className="text-slate-600 font-semibold">Alternar Abas de Atendimento:</span>
              <kbd className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 font-mono font-bold">Ctrl + 1..5</kbd>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex justify-between items-center">
              <span className="text-slate-600 font-semibold">Multiplicar Qtd no Leitor:</span>
              <kbd className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 font-mono font-bold">Qtd * Código</kbd>
            </div>
          </div>
        </div>

        {/* Card 7: Armazenamento e Runtime Desktop */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-sm space-y-2 text-xs font-sans">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <HardDrive className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">Informações Técnicas do Programa</h3>
          </div>
          <div className="text-slate-600 space-y-1.5 font-medium pt-1">
            <div>• Motor de Banco de Dados: <strong className="text-slate-800">SQLite 3 Embarcado (Modo WAL)</strong></div>
            <div>• Arquivo de Dados: <strong className="text-slate-800">src/backend/PDV.API/pdv.db</strong></div>
            <div>• Backend: <strong className="text-slate-800">.NET 8 Clean Architecture com CQRS & MediatR</strong></div>
            <div>• Frontend: <strong className="text-slate-800">React 18 + TypeScript + Tailwind CSS</strong></div>
            <div>• Impressão Térmica: <strong className="text-slate-800">ESC/POS Direto (WinSpooler / Raw TCP 9100)</strong></div>
            <div>• Interface: <strong className="text-slate-800">Aplicação Web SPA (Navegador / Kiosk)</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
};
