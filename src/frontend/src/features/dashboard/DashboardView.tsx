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
  Package,
  Users,
  Play,
  QrCode,
  Check,
} from 'lucide-react';
import { ModuloApp } from '../../components/Sidebar';
import { useClientsAndOrdersStore } from '../../store/useClientsAndOrdersStore';
import { pdvApi } from '../../services/api';
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
  const { passosConcluidos, concluirPasso } = useClientsAndOrdersStore();

  const [onboardingVisivel, setOnboardingVisivel] = useState(true);
  const [vendasHoje, setVendasHoje] = useState<Venda[]>([]);

  // Modais de Ação Rápida dos Primeiros Passos
  const [modalAtivo, setModalAtivo] = useState<string | null>(null);

  useEffect(() => {
    carregarVendas();
  }, []);

  const carregarVendas = async () => {
    try {
      const lista = await pdvApi.listarTodasVendas();
      const hoje = new Date().toISOString().split('T')[0];
      const vendasDoDia = lista.filter(v => v.dataVenda?.startsWith(hoje) && v.status === 'Concluida');
      setVendasHoje(vendasDoDia.length > 0 ? vendasDoDia : lista.slice(0, 5));
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
  const ticketMedioHoje = vendasHoje.length > 0 ? totalFaturadoHoje / vendasHoje.length : 0;

  // 8 Ações Obrigatórias de "Primeiros Passos" (Fiel à Imagem 2)
  const itensPrimeirosPassos = [
    {
      id: 'primeira-venda',
      titulo: 'Primeira venda',
      descricao: 'Abra o caixa e registre uma venda de v...',
      icone: ShoppingCart,
      acao: () => {
        concluirPasso('primeira-venda');
        onNavegarPara('pos');
      },
    },
    {
      id: 'impressora',
      titulo: 'Impressora',
      descricao: 'Escolha a impressora deste caixa e imp...',
      icone: Printer,
      acao: () => {
        concluirPasso('impressora');
        if (onAbrirConfigImpressora) {
          onAbrirConfigImpressora();
        } else {
          setModalAtivo('impressora');
        }
      },
    },
    {
      id: 'seus-dados',
      titulo: 'Seus dados',
      descricao: 'Mande a planilha do sistema amigo do...',
      icone: Database,
      acao: () => {
        concluirPasso('seus-dados');
        onNavegarPara('importer');
      },
    },
    {
      id: 'vender-celular',
      titulo: 'Vender no celular',
      descricao: 'Leia o QR Code e venda do salão, da m...',
      icone: Smartphone,
      acao: () => {
        concluirPasso('vender-celular');
        setModalAtivo('vender-celular');
      },
    },
    {
      id: 'mercado-pago',
      titulo: 'Mercado Pago',
      descricao: 'Conecte a conta do Mercado Pago: o P...',
      icone: CreditCard,
      acao: () => {
        concluirPasso('mercado-pago');
        setModalAtivo('mercado-pago');
      },
    },
    {
      id: 'fiscal',
      titulo: 'Fiscal',
      descricao: 'Emita a nota fiscal ao finalizar a venda. ...',
      icone: FileText,
      acao: () => {
        concluirPasso('fiscal');
        setModalAtivo('fiscal');
      },
    },
    {
      id: 'backup-nuvem',
      titulo: 'Backup na nuvem',
      descricao: 'As vendas e o cadastro copiados para ...',
      icone: Cloud,
      acao: () => {
        concluirPasso('backup-nuvem');
        if (onAbrirBackupNuvem) {
          onAbrirBackupNuvem();
        } else {
          setModalAtivo('backup-nuvem');
        }
      },
    },
    {
      id: 'logo-cores',
      titulo: 'Logo e cores',
      descricao: 'Logo e cores da loja no sistema e no c...',
      icone: Palette,
      acao: () => {
        concluirPasso('logo-cores');
        setModalAtivo('logo-cores');
      },
    },
  ];

  return (
    <div className="w-full h-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 select-none font-sans space-y-6">
      
      {/* =========================================================================
          CABEÇALHO DO PAINEL (Fiel à Imagem 2)
         ========================================================================= */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Painel
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          O que precisa da sua atenção agora — caixa, estoque, fiado e o movimento do dia.
        </p>
      </div>

      {/* =========================================================================
          CARD "PRIMEIROS PASSOS" (Fiel à Imagem 2)
         ========================================================================= */}
      {onboardingVisivel && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/70 relative">
          
          {/* Topo do Card de Primeiros Passos */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              {/* Ícone de Calendário Azul */}
              <div className="w-10 h-10 rounded-2xl bg-[#eaf1ff] text-[#005bf8] flex items-center justify-center shrink-0">
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

            {/* Contador de Progresso e Botão Fechar (0 de 8 X) */}
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

          {/* Linha do Link da Playlist do YouTube (Fiel à Imagem 2) */}
          <div className="py-3 flex items-center gap-2 text-xs">
            {/* Ícone Vermelho do YouTube */}
            <div className="w-4 h-3.5 bg-red-600 rounded flex items-center justify-center text-white shrink-0">
              <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
            </div>
            <button
              onClick={() => setModalAtivo('video-tutorial')}
              className="font-semibold text-slate-700 hover:text-[#005bf8] transition-colors text-left cursor-pointer"
            >
              Assista à playlist curta que ensina a usar o PDV Open
            </button>
          </div>

          {/* Grid de 8 Cards de Ação (2 Colunas, Fiel à Imagem 2) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-1">
            {itensPrimeirosPassos.map((item) => {
              const Icone = item.icone;
              const concluido = passosConcluidos.includes(item.id);

              return (
                <div
                  key={item.id}
                  className="bg-[#f8faff] hover:bg-white border border-slate-100 hover:border-blue-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all duration-150 group shadow-sm hover:shadow"
                >
                  {/* Ícone e Textos da Ação */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-[#eaf1ff] text-[#005bf8] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
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

                  {/* Botão Azul "Fazer agora ->" (Fiel à Imagem 2) */}
                  <button
                    onClick={item.acao}
                    className="py-2 px-3 sm:px-4 bg-[#005bf8] hover:bg-[#0047db] active:bg-[#003cb0] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 shadow-sm shadow-blue-500/25 transition-all duration-150 cursor-pointer"
                  >
                    <span>Fazer agora</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          SEÇÃO "SITUAÇÃO DO DIA" (Fiel à Imagem 2)
         ========================================================================= */}
      <div>
        <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-3 tracking-tight">
          Situação do dia
        </h2>

        {/* 4 Cards de Métricas em Linha */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Card 1: Vendas hoje */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/70 flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#eaf1ff] text-[#005bf8] flex items-center justify-center shrink-0">
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

          {/* Card 2: Ticket médio */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/70 flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#eaf1ff] text-[#005bf8] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="truncate">
                <span className="text-xs text-slate-500 font-medium block">
                  Ticket médio
                </span>
                <span className="text-lg sm:text-xl font-extrabold text-slate-900 block truncate">
                  R$ {ticketMedioHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="flex justify-end items-center gap-1 mt-3 text-emerald-500 text-xs font-bold">
              <span>↑ 0%</span>
            </div>
          </div>

          {/* Card 3: Produtos vendidos */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/70 flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#eaf1ff] text-[#005bf8] flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
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

          {/* Card 4: Clientes atendidos */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/70 flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#eaf1ff] text-[#005bf8] flex items-center justify-center shrink-0">
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

      {/* =========================================================================
          MODAIS INTERATIVOS DOS PASSOS
         ========================================================================= */}
      {/* Modal Vender no Celular */}
      {modalAtivo === 'vender-celular' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#005bf8]" />
                <h3 className="font-bold text-slate-900">Vender no Celular / Tablet</h3>
              </div>
              <button onClick={() => setModalAtivo(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 text-center space-y-4">
              <p className="text-xs text-slate-600">
                Acesse o AtylusPDV diretamente de qualquer celular conectado na mesma rede Wi-Fi do caixa.
              </p>

              {/* QR Code Simulado em Alta Resolução */}
              <div className="w-48 h-48 mx-auto bg-slate-50 border-2 border-dashed border-[#005bf8]/30 rounded-2xl p-3 flex flex-col items-center justify-center shadow-inner">
                <QrCode className="w-32 h-32 text-[#005bf8]" />
                <span className="text-[10px] font-mono font-bold text-slate-500 mt-1">http://192.168.1.100:5173</span>
              </div>

              <p className="text-xs text-slate-500">
                Aponte a câmera do celular para ler o QR Code ou digite o endereço acima no navegador.
              </p>

              <button
                onClick={() => setModalAtivo(null)}
                className="w-full py-2.5 bg-[#005bf8] hover:bg-[#0047db] text-white text-xs font-bold rounded-xl"
              >
                Entendido
              </button>
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
                <CreditCard className="w-5 h-5 text-[#005bf8]" />
                <h3 className="font-bold text-slate-900">Integração Pix & Mercado Pago</h3>
              </div>
              <button onClick={() => setModalAtivo(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <p className="text-slate-600">
                O AtylusPDV possui gateway Pix Integrado nativo com simulação offline e suporte a chaves dinâmicas BR Code EMV.
              </p>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Chave Pix ou Access Token</label>
                <input
                  type="text"
                  defaultValue="atylus-pdv-mercadopago-live"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
                ✓ Simulador local habilitado: você pode testar pagamentos Pix sem necessidade de cobrança real!
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => setModalAtivo(null)}
                  className="w-full py-2.5 bg-[#005bf8] hover:bg-[#0047db] text-white font-bold rounded-xl"
                >
                  Salvar Configuração
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
                <FileText className="w-5 h-5 text-[#005bf8]" />
                <h3 className="font-bold text-slate-900">Dados Fiscais & Cupom</h3>
              </div>
              <button onClick={() => setModalAtivo(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Razão Social</label>
                <input
                  type="text"
                  defaultValue="ATYLUS COMÉRCIO E SERVIÇOS LTDA"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">CNPJ</label>
                <input
                  type="text"
                  defaultValue="12.345.678/0001-90"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Inscrição Estadual (IE)</label>
                <input
                  type="text"
                  defaultValue="123.456.789.000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <button
                onClick={() => setModalAtivo(null)}
                className="w-full py-2.5 bg-[#005bf8] hover:bg-[#0047db] text-white font-bold rounded-xl mt-2"
              >
                Salvar Dados Fiscais
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Logo e Cores */}
      {modalAtivo === 'logo-cores' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#005bf8]" />
                <h3 className="font-bold text-slate-900">Personalização de Logo e Cores</h3>
              </div>
              <button onClick={() => setModalAtivo(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <p className="text-slate-600">
                O AtylusPDV já vem configurado com a paleta oficial azul royal e tema claro moderno das referências.
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#005bf8] shadow-md border-2 border-white ring-2 ring-blue-500" />
                <div>
                  <span className="font-bold text-slate-800 block">Azul Royal AtylusPDV</span>
                  <span className="text-slate-500">Cor primária do sistema</span>
                </div>
              </div>

              <button
                onClick={() => setModalAtivo(null)}
                className="w-full py-2.5 bg-[#005bf8] hover:bg-[#0047db] text-white font-bold rounded-xl"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Vídeo Tutorial */}
      {modalAtivo === 'video-tutorial' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-red-600 fill-current" />
                <h3 className="font-bold text-slate-900">Tutorial Rápido do AtylusPDV</h3>
              </div>
              <button onClick={() => setModalAtivo(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="w-full aspect-video bg-slate-900 rounded-2xl flex flex-col items-center justify-center text-white p-6 text-center">
                <Play className="w-16 h-16 text-white/80 hover:text-white transition cursor-pointer" />
                <span className="font-bold text-sm mt-3">Playlist: Como Operar o AtylusPDV com Alta Produtividade</span>
                <span className="text-xs text-slate-400 mt-1">Atalhos rápidos: F1 (Nova Venda), F2 (Buscar), F3 (Caixa), F4 (Finalizar), Esc (Cancelar)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
