import React, { useState, useEffect } from 'react';
import {
  Calendar,
  X,
  ExternalLink,
  ArrowRight,
  ShoppingCart,
  Printer,
  Database,
  Smartphone,
  CreditCard,
  FileText,
  Cloud,
  Palette,
  Users,
  QrCode,
  Check,
  Image,
} from 'lucide-react';
import { ModuloApp } from '../../components/Sidebar';
import { useClientsAndOrdersStore } from '../../store/useClientsAndOrdersStore';
import { useThemeStore } from '../../store/useThemeStore';
import { pdvApi } from '../../services/api';
import { sound } from '../../services/sound';
import { Venda } from '../../types';

interface DashboardViewProps {
  onNavegarPara: (modulo: ModuloApp) => void;
  onAbrirConfigImpressora?: () => void;
  onAbrirBackupNuvem?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavegarPara,
  onAbrirConfigImpressora,
  onAbrirBackupNuvem,
}) => {
  const { theme, atualizarTema } = useThemeStore();
  const { passosConcluidos, concluirPasso } = useClientsAndOrdersStore();

  const [onboardingVisivel, setOnboardingVisivel] = useState(true);
  const [vendasHoje, setVendasHoje] = useState<Venda[]>([]);

  // Modais de Ação Rápida dos Primeiros Passos
  const [modalAtivo, setModalAtivo] = useState<string | null>(null);

  // Estados dos formulários de modais para validação de requisitos reais
  const [chavePixInput, setChavePixInput] = useState(() => localStorage.getItem('pdv_pix_key') || '');
  const [fiscalRazao, setFiscalRazao] = useState(() => localStorage.getItem('pdv_fiscal_razao') || '');
  const [fiscalCnpj, setFiscalCnpj] = useState(() => localStorage.getItem('pdv_fiscal_cnpj') || '');
  const [fiscalIe, setFiscalIe] = useState(() => localStorage.getItem('pdv_fiscal_ie') || '');

  // Estados do Modal Logo e Cores
  const [nomeLojaModal, setNomeLojaModal] = useState(theme.nomeLoja);
  const [subtituloModal, setSubtituloModal] = useState(theme.subtituloLoja);
  const [corPrimariaModal, setCorPrimariaModal] = useState(theme.corPrimaria);
  const [logoPreviewModal, setLogoPreviewModal] = useState(theme.logoUrl || '');
  const [feedbackTemaModal, setFeedbackTemaModal] = useState<string | null>(null);

  useEffect(() => {
    carregarVendas();
  }, []);

  const carregarVendas = async () => {
    try {
      const lista = await pdvApi.listarTodasVendas();
      const hoje = new Date().toISOString().split('T')[0];
      const vendasDoDia = lista.filter(v => v.dataVenda?.startsWith(hoje) && v.status === 'Concluida');
      setVendasHoje(vendasDoDia.length > 0 ? vendasDoDia : lista.slice(0, 5));

      // Requisito real: Se tiver pelo menos 1 venda concluída no banco, marca 'primeira-venda'
      if (lista.some(v => v.status === 'Concluida')) {
        concluirPasso('primeira-venda');
      }

      // Requisito real: Se tiver impressora configurada
      const impressoraSalva = localStorage.getItem('pdv_printer_config_v1');
      if (impressoraSalva) {
        try {
          const cfg = JSON.parse(impressoraSalva);
          if (cfg.nomeOuEndereco) concluirPasso('impressora');
        } catch {}
      }

      // Requisito real: Se tiver produtos cadastrados (importação ou manual)
      const prods = await pdvApi.buscarProdutos();
      if (prods && prods.length > 0) {
        concluirPasso('seus-dados');
      }
    } catch {
      // Offline fallback
    }
  };

  // Cálculo das Métricas da Situação do Dia
  const totalFaturadoHoje = vendasHoje.reduce((acc, v) => acc + (v.valorLiquido || 0), 0);
  const totalProdutosVendidos = vendasHoje.reduce((acc, v) => {
    return acc + (v.itens?.reduce((sub, i) => sub + (i.quantidade || 1), 0) || 0);
  }, 0);
  const totalClientesHoje = Math.max(vendasHoje.length, vendasHoje.filter(v => v.clienteNome).length);

  // 8 Ações de "Primeiros Passos"
  const itensPrimeirosPassos = [
    {
      id: 'primeira-venda',
      titulo: 'Primeira venda',
      descricao: 'Abra o caixa e registre uma venda de v...',
      icone: ShoppingCart,
      acao: () => {
        // Redireciona para o POS; o check só será ativado quando uma venda for concluída de verdade
        onNavegarPara('pos');
      },
    },
    {
      id: 'impressora',
      titulo: 'Impressora',
      descricao: 'Escolha a impressora deste caixa e imp...',
      icone: Printer,
      acao: () => {
        if (onAbrirConfigImpressora) {
          onAbrirConfigImpressora();
        } else {
          onNavegarPara('settings');
        }
      },
    },
    {
      id: 'seus-dados',
      titulo: 'Seus dados',
      descricao: 'Mande a planilha do sistema amigo do...',
      icone: Database,
      acao: () => {
        onNavegarPara('importer');
      },
    },
    {
      id: 'vender-celular',
      titulo: 'Vender no celular',
      descricao: 'Leia o QR Code e venda do salão, da m...',
      icone: Smartphone,
      acao: () => {
        setModalAtivo('vender-celular');
      },
    },
    {
      id: 'mercado-pago',
      titulo: 'Mercado Pago',
      descricao: 'Conecte a conta do Mercado Pago: o P...',
      icone: CreditCard,
      acao: () => {
        setModalAtivo('mercado-pago');
      },
    },
    {
      id: 'fiscal',
      titulo: 'Fiscal',
      descricao: 'Emita a nota fiscal ao finalizar a venda. ...',
      icone: FileText,
      acao: () => {
        setModalAtivo('fiscal');
      },
    },
    {
      id: 'backup-nuvem',
      titulo: 'Backup na nuvem',
      descricao: 'As vendas e o cadastro copiados para ...',
      icone: Cloud,
      acao: () => {
        if (onAbrirBackupNuvem) {
          onAbrirBackupNuvem();
        } else {
          onNavegarPara('settings');
        }
      },
    },
    {
      id: 'logo-cores',
      titulo: 'Logo e cores',
      descricao: 'Logo e cores da loja no sistema e no c...',
      icone: Palette,
      acao: () => {
        setNomeLojaModal(theme.nomeLoja);
        setSubtituloModal(theme.subtituloLoja);
        setCorPrimariaModal(theme.corPrimaria);
        setLogoPreviewModal(theme.logoUrl || '');
        setModalAtivo('logo-cores');
      },
    },
  ];

  // Ações de salvamento com validação real
  const handleSalvarMercadoPago = () => {
    if (!chavePixInput.trim()) {
      alert('Informe a sua Chave Pix ou Token para concluir este passo.');
      return;
    }
    localStorage.setItem('pdv_pix_key', chavePixInput.trim());
    concluirPasso('mercado-pago');
    sound.playSuccessChime();
    setModalAtivo(null);
  };

  const handleSalvarFiscal = () => {
    if (!fiscalRazao.trim() || !fiscalCnpj.trim()) {
      alert('Preencha ao menos Razão Social e CNPJ para validar as configurações fiscais.');
      return;
    }
    localStorage.setItem('pdv_fiscal_razao', fiscalRazao.trim());
    localStorage.setItem('pdv_fiscal_cnpj', fiscalCnpj.trim());
    localStorage.setItem('pdv_fiscal_ie', fiscalIe.trim());
    concluirPasso('fiscal');
    sound.playSuccessChime();
    setModalAtivo(null);
  };

  const handleLogoUploadModal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setLogoPreviewModal(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSalvarTemaModal = () => {
    atualizarTema({
      nomeLoja: nomeLojaModal.trim() || 'ATYLUS',
      subtituloLoja: subtituloModal.trim() || 'OPEN',
      corPrimaria: corPrimariaModal,
      logoUrl: logoPreviewModal,
    });
    concluirPasso('logo-cores');
    sound.playSuccessChime();
    setFeedbackTemaModal('Identidade visual aplicada com sucesso!');
    setTimeout(() => {
      setFeedbackTemaModal(null);
      setModalAtivo(null);
    }, 1200);
  };

  const coresOpcoes = [
    { nome: 'Azul Royal (Padrão)', hex: '#005bf8' },
    { nome: 'Índigo Moderno', hex: '#4f46e5' },
    { nome: 'Verde Esmeralda', hex: '#059669' },
    { nome: 'Ciano Oceano', hex: '#0284c7' },
    { nome: 'Roxo Imperial', hex: '#7c3aed' },
    { nome: 'Laranja Varejo', hex: '#ea580c' },
  ];

  return (
    <div className="w-full h-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 select-none font-sans space-y-6">
      {/* Cabeçalho do Painel */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Painel
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          O que precisa da sua atenção agora — caixa, estoque, fiado e o movimento do dia.
        </p>
      </div>

      {/* Card Primeiros Passos */}
      {onboardingVisivel && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/70 relative">
          {/* Topo do Card de Primeiros Passos */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs border"
                style={{
                  backgroundColor: `${theme.corPrimaria}15`,
                  color: theme.corPrimaria,
                  borderColor: `${theme.corPrimaria}30`,
                }}
              >
                <Calendar className="w-5 h-5" />
              </div>

              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  Primeiros passos
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-tight">
                  O próximo é: <span className="font-semibold text-slate-700">Sua primeira venda.</span>
                </p>
              </div>
            </div>

            {/* Contador de Progresso e Botão Fechar */}
            <div className="flex items-center gap-3 self-end sm:self-center">
              <span className="text-xs font-bold text-slate-700 bg-slate-100/90 px-3 py-1 rounded-full">
                {passosConcluidos.length} de 8
              </span>
              <button
                onClick={() => setOnboardingVisivel(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
                title="Ocultar Primeiros Passos"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* Grid de 8 Cards de Ação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-4">
            {itensPrimeirosPassos.map((item) => {
              const Icone = item.icone;
              const concluido = passosConcluidos.includes(item.id);

              return (
                <div
                  key={item.id}
                  className="bg-[#f8faff] hover:bg-white border border-slate-100 hover:border-indigo-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all duration-150 group shadow-sm hover:shadow"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
                      style={{
                        backgroundColor: concluido ? '#ecfdf5' : `${theme.corPrimaria}15`,
                        color: concluido ? '#059669' : theme.corPrimaria,
                      }}
                    >
                      {concluido ? <Check className="w-5 h-5 text-emerald-600" /> : <Icone className="w-5 h-5" />}
                    </div>

                    <div className="truncate">
                      <div className="flex items-center gap-1">
                        <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                          {item.titulo}
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {item.descricao}
                      </p>
                    </div>
                  </div>

                  {concluido ? (
                    <span className="py-1.5 px-3 bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-bold rounded-xl flex items-center gap-1 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                      <span>Feito</span>
                    </span>
                  ) : (
                    <button
                      onClick={item.acao}
                      style={{ backgroundColor: theme.corPrimaria }}
                      className="py-2 px-3 sm:px-4 hover:opacity-90 active:scale-98 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 shadow-sm transition-all duration-150 cursor-pointer"
                    >
                      <span>Fazer agora</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Seção Situação do Dia */}
      <div>
        <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-3 tracking-tight">
          Situação do dia
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/70 flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${theme.corPrimaria}15`, color: theme.corPrimaria }}
              >
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="truncate">
                <span className="text-xs text-slate-500 font-medium block">
                  Vendas hoje
                </span>
                <span className="text-lg sm:text-xl font-extrabold text-slate-900 block truncate">
                  R$ {totalFaturadoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="flex justify-end items-center gap-1 mt-3 text-emerald-500 text-xs font-bold">
              <span>↑ 0%</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/70 flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${theme.corPrimaria}15`, color: theme.corPrimaria }}
              >
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="truncate">
                <span className="text-xs text-slate-500 font-medium block">
                  Ticket médio
                </span>
                <span className="text-lg sm:text-xl font-extrabold text-slate-900 block truncate">
                  R$ {(vendasHoje.length > 0 ? totalFaturadoHoje / vendasHoje.length : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="flex justify-end items-center gap-1 mt-3 text-emerald-500 text-xs font-bold">
              <span>↑ 0%</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/70 flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${theme.corPrimaria}15`, color: theme.corPrimaria }}
              >
                <Database className="w-5 h-5" />
              </div>
              <div className="truncate">
                <span className="text-xs text-slate-500 font-medium block">
                  Produtos vendidos
                </span>
                <span className="text-lg sm:text-xl font-extrabold text-slate-900 block truncate">
                  {totalProdutosVendidos}
                </span>
              </div>
            </div>
            <div className="flex justify-end items-center gap-1 mt-3 text-emerald-500 text-xs font-bold">
              <span>↑ 0%</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/70 flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${theme.corPrimaria}15`, color: theme.corPrimaria }}
              >
                <Users className="w-5 h-5" />
              </div>
              <div className="truncate">
                <span className="text-xs text-slate-500 font-medium block">
                  Clientes atendidos
                </span>
                <span className="text-lg sm:text-xl font-extrabold text-slate-900 block truncate">
                  {totalClientesHoje}
                </span>
              </div>
            </div>
            <div className="flex justify-end items-center gap-1 mt-3 text-emerald-500 text-xs font-bold">
              <span>↑ 0%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modais Interativos */}
      {/* Modal Vender no Celular */}
      {modalAtivo === 'vender-celular' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" style={{ color: theme.corPrimaria }} />
                <h3 className="font-bold text-slate-900">Vender no Celular / Tablet</h3>
              </div>
              <button onClick={() => setModalAtivo(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 text-center space-y-4">
              <p className="text-xs text-slate-600">
                Aponte a câmera do seu celular ou tablet conectado na mesma rede Wi-Fi para operar o caixa móvel:
              </p>

              <div className="w-48 h-48 mx-auto bg-slate-50 border-2 border-dashed border-indigo-200 rounded-2xl p-3 flex flex-col items-center justify-center shadow-inner">
                <QrCode className="w-32 h-32 text-indigo-600" />
                <span className="text-[10px] font-mono font-bold text-slate-500 mt-1">http://localhost:5000</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setModalAtivo(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    concluirPasso('vender-celular');
                    sound.playSuccessChime();
                    setModalAtivo(null);
                  }}
                  style={{ backgroundColor: theme.corPrimaria }}
                  className="flex-1 py-2.5 hover:opacity-90 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  Confirmar Acesso
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mercado Pago / Pix */}
      {modalAtivo === 'mercado-pago' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" style={{ color: theme.corPrimaria }} />
                <h3 className="font-bold text-slate-900">Integração Pix & Mercado Pago</h3>
              </div>
              <button onClick={() => setModalAtivo(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <p className="text-slate-600">
                Informe a Chave Pix ou Access Token de produção/teste para validar os recebimentos automáticos:
              </p>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Chave Pix ou Access Token:</label>
                <input
                  type="text"
                  placeholder="Ex: financeiro@sualoja.com.br ou APP_USR-..."
                  value={chavePixInput}
                  onChange={e => setChavePixInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => setModalAtivo(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarMercadoPago}
                  style={{ backgroundColor: theme.corPrimaria }}
                  className="flex-1 py-2.5 hover:opacity-90 text-white font-bold rounded-xl shadow-xs"
                >
                  Salvar e Concluir Passo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fiscal */}
      {modalAtivo === 'fiscal' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" style={{ color: theme.corPrimaria }} />
                <h3 className="font-bold text-slate-900">Dados Fiscais & Cupom</h3>
              </div>
              <button onClick={() => setModalAtivo(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Razão Social / Nome Fantasia:</label>
                <input
                  type="text"
                  value={fiscalRazao}
                  onChange={e => setFiscalRazao(e.target.value)}
                  placeholder="Ex: ATYLUS COMÉRCIO E SERVIÇOS LTDA"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">CNPJ:</label>
                <input
                  type="text"
                  value={fiscalCnpj}
                  onChange={e => setFiscalCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Inscrição Estadual (IE):</label>
                <input
                  type="text"
                  value={fiscalIe}
                  onChange={e => setFiscalIe(e.target.value)}
                  placeholder="ISENTO ou número estadual"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => setModalAtivo(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarFiscal}
                  style={{ backgroundColor: theme.corPrimaria }}
                  className="flex-1 py-2.5 hover:opacity-90 text-white font-bold rounded-xl shadow-xs"
                >
                  Salvar Dados Fiscais
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Logo e Cores Realmente Personalizável */}
      {modalAtivo === 'logo-cores' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5" style={{ color: theme.corPrimaria }} />
                <h3 className="font-bold text-slate-900">Personalizar Logo & Cores</h3>
              </div>
              <button onClick={() => setModalAtivo(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              {/* Imagem de Logo */}
              <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div className="w-16 h-16 rounded-xl border border-slate-300 flex items-center justify-center overflow-hidden bg-white shrink-0 shadow-inner">
                  {logoPreviewModal ? (
                    <img src={logoPreviewModal} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Image className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div className="flex-1">
                  <span className="font-bold text-slate-800 block mb-1">Logo da Loja</span>
                  <label className="cursor-pointer inline-block px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition">
                    <span>{logoPreviewModal ? 'Trocar Imagem' : 'Carregar Imagem'}</span>
                    <input type="file" accept="image/*" onChange={handleLogoUploadModal} className="hidden" />
                  </label>
                  {logoPreviewModal && (
                    <button
                      onClick={() => setLogoPreviewModal('')}
                      className="ml-2 text-[11px] text-rose-500 hover:underline"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nome no Menu Lateral:</label>
                <input
                  type="text"
                  value={nomeLojaModal}
                  onChange={e => setNomeLojaModal(e.target.value)}
                  placeholder="Ex: ATYLUS"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Cor Primária do Sistema:</label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="color"
                    value={corPrimariaModal}
                    onChange={e => setCorPrimariaModal(e.target.value)}
                    className="w-9 h-9 p-0 border-0 rounded-xl cursor-pointer"
                  />
                  <input
                    type="text"
                    value={corPrimariaModal}
                    onChange={e => setCorPrimariaModal(e.target.value)}
                    className="w-28 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {coresOpcoes.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.nome}
                      onClick={() => setCorPrimariaModal(c.hex)}
                      style={{ backgroundColor: c.hex }}
                      className={`w-5 h-5 rounded-full transition-transform ${corPrimariaModal === c.hex ? 'scale-125 ring-2 ring-slate-800 ring-offset-2' : ''}`}
                    />
                  ))}
                </div>
              </div>

              {feedbackTemaModal && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{feedbackTemaModal}</span>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => setModalAtivo(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarTemaModal}
                  style={{ backgroundColor: corPrimariaModal }}
                  className="flex-1 py-2.5 hover:opacity-90 text-white font-bold rounded-xl shadow-xs transition"
                >
                  Salvar Personalização
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
