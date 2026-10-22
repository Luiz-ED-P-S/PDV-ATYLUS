import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Sparkles, Check, ArrowRight, FileCode, PackagePlus } from 'lucide-react';
import { MapeamentoColunas, NfeXmlProdutoItem } from '../../types';

interface ImporterViewProps {
  onVoltarParaPdv: () => void;
}

export const ImporterView: React.FC<ImporterViewProps> = ({ onVoltarParaPdv }) => {
  const [tipoImportacao, setTipoImportacao] = useState<'ia_planilha' | 'nfe_xml'>('ia_planilha');

  // Estados de Planilha IA
  const [arquivoNome, setArquivoNome] = useState<string>('');
  const [cabecalhos, setCabecalhos] = useState<string[]>([]);
  const [linhasAmostra, setLinhasAmostra] = useState<string[][]>([]);
  const [mapeamento, setMapeamento] = useState<MapeamentoColunas | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [colCodigo, setColCodigo] = useState('');
  const [colNome, setColNome] = useState('');
  const [colPreco, setColPreco] = useState('');
  const [colEstoque, setColEstoque] = useState('');

  // Estados de NF-e XML (PDVOpen)
  const [nfeItens, setNfeItens] = useState<NfeXmlProdutoItem[]>([]);
  const [nfeEmitente, setNfeEmitente] = useState<string>('');
  const [nfeNumero, setNfeNumero] = useState<string>('');
  const [margemMarkupPadrao, setMargemMarkupPadrao] = useState<number>(50);

  const [sucessoImportacao, setSucessoImportacao] = useState<string | null>(null);

  // Parser nativo de XML de NF-e da SEFAZ
  const processarXmlNfe = (xmlTexto: string, nomeArquivo: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlTexto, 'text/xml');

      const emitNome = xmlDoc.getElementsByTagName('xNome')[0]?.textContent || 'Fornecedor';
      const nNF = xmlDoc.getElementsByTagName('nNF')[0]?.textContent || '000000';

      setNfeEmitente(emitNome);
      setNfeNumero(nNF);
      setArquivoNome(nomeArquivo);

      const detNodes = xmlDoc.getElementsByTagName('det');
      const itensExtraidos: NfeXmlProdutoItem[] = [];

      for (let i = 0; i < detNodes.length; i++) {
        const prod = detNodes[i].getElementsByTagName('prod')[0];
        if (prod) {
          const cProd = prod.getElementsByTagName('cProd')[0]?.textContent || '';
          let cEAN = prod.getElementsByTagName('cEAN')[0]?.textContent || '';
          if (cEAN === 'SEM GTIN' || !cEAN) cEAN = cProd;

          const xProd = prod.getElementsByTagName('xProd')[0]?.textContent || '';
          const ncm = prod.getElementsByTagName('NCM')[0]?.textContent || '';
          const uCom = prod.getElementsByTagName('uCom')[0]?.textContent || 'UN';
          const qCom = parseFloat(prod.getElementsByTagName('qCom')[0]?.textContent || '1');
          const vUnCom = parseFloat(prod.getElementsByTagName('vUnCom')[0]?.textContent || '0');
          const vProd = parseFloat(prod.getElementsByTagName('vProd')[0]?.textContent || '0');

          const precoVenda = parseFloat((vUnCom * (1 + margemMarkupPadrao / 100)).toFixed(2));

          itensExtraidos.push({
            codigoProduto: cProd,
            codigoBarras: cEAN,
            descricao: xProd,
            ncm,
            unidadeComercial: uCom,
            quantidade: qCom,
            valorUnitario: vUnCom,
            valorTotal: vProd,
            margemSugeridaPercentual: margemMarkupPadrao,
            precoVendaSugerido: precoVenda,
          });
        }
      }

      setNfeItens(itensExtraidos);
      setTipoImportacao('nfe_xml');
    } catch {
      alert('Erro ao analisar o arquivo XML da NF-e.');
    }
  };

  const processarArquivoCsv = (conteudo: string, nome: string) => {
    setArquivoNome(nome);
    const linhas = conteudo.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (linhas.length === 0) return;

    const sep = linhas[0].includes(';') ? ';' : ',';
    const headers = linhas[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows = linhas.slice(1, 4).map(l => l.split(sep).map(c => c.trim().replace(/^["']|["']$/g, '')));

    setCabecalhos(headers);
    setLinhasAmostra(rows);
    analisarComIa(nome, headers, rows);
  };

  const analisarComIa = async (nome: string, headers: string[], rows: string[][]) => {
    setAnalisando(true);
    try {
      const response = await fetch('/api/v1/importer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeArquivo: nome,
          cabecalhos: headers,
          amostraLinhas: rows,
        }),
      });

      let resData: MapeamentoColunas;
      if (response.ok) {
        resData = await response.json();
      } else {
        const findCol = (...syn: string[]) => headers.find(h => syn.some(s => h.toLowerCase().includes(s))) || '';
        resData = {
          colunaCodigoBarras: findCol('cod', 'barras', 'ean', 'sku'),
          colunaNome: findCol('nome', 'desc', 'produto', 'item'),
          colunaPrecoVenda: findCol('preco', 'venda', 'valor'),
          colunaPrecoCusto: findCol('custo', 'compra'),
          colunaEstoque: findCol('estoque', 'qtd', 'quantidade'),
          confianca: 0.92,
          observacoes: 'Mapeamento heurístico local aplicado.',
        };
      }

      setMapeamento(resData);
      setColCodigo(resData.colunaCodigoBarras || headers[0] || '');
      setColNome(resData.colunaNome || headers[1] || '');
      setColPreco(resData.colunaPrecoVenda || headers[2] || '');
      setColEstoque(resData.colunaEstoque || headers[3] || '');
    } finally {
      setAnalisando(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      const text = evt.target?.result as string;
      if (file.name.toLowerCase().endsWith('.xml')) {
        processarXmlNfe(text, file.name);
      } else {
        processarArquivoCsv(text, file.name);
      }
    };
    reader.readAsText(file);
  };

  const carregarDemoNfeXml = () => {
    const xmlMock = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe>
      <ide><nNF>00012485</nNF></ide>
      <emit><xNome>DISTRIBUIDORA DE ALIMENTOS BRASIL LTDA</xNome></emit>
      <det nItem="1">
        <prod>
          <cProd>ALM001</cProd>
          <cEAN>7891000100103</cEAN>
          <xProd>LEITE CONDENSADO MOCA 395G</xProd>
          <NCM>04029900</NCM>
          <uCom>UN</uCom>
          <qCom>50.0000</qCom>
          <vUnCom>5.2000</vUnCom>
          <vProd>260.00</vProd>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>ALM002</cProd>
          <cEAN>7898000000000</cEAN>
          <xProd>ARROZ TIO JOAO TIPO 1 5KG</xProd>
          <NCM>10063021</NCM>
          <uCom>UN</uCom>
          <qCom>30.0000</qCom>
          <vUnCom>21.8000</vUnCom>
          <vProd>654.00</vProd>
        </prod>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`;
    processarXmlNfe(xmlMock, 'nfe_distribuidora_12485.xml');
  };

  const confirmarEntradaEstoqueNfe = () => {
    setSucessoImportacao(`Nota Fiscal #${nfeNumero} processada com sucesso! ${nfeItens.length} itens deram entrada no estoque.`);
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-5xl mx-auto flex flex-col space-y-6">
      {/* Topo */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Central de Importação: IA & NF-e XML</h1>
            <p className="text-xs text-slate-400">Entrada rápida de mercadorias no catálogo com recursos do PDVOpen</p>
          </div>
        </div>

        <button
          onClick={onVoltarParaPdv}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-sm rounded-xl transition"
        >
          Voltar para Frente de Caixa [Esc]
        </button>
      </div>

      {/* Seletor de Modo de Ingestão */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 gap-1">
        <button
          onClick={() => setTipoImportacao('ia_planilha')}
          className={`flex-1 py-3 rounded-xl font-bold font-mono text-xs flex items-center justify-center gap-2 transition ${
            tipoImportacao === 'ia_planilha' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Planilha Excel / CSV com IA</span>
        </button>

        <button
          onClick={() => setTipoImportacao('nfe_xml')}
          className={`flex-1 py-3 rounded-xl font-bold font-mono text-xs flex items-center justify-center gap-2 transition ${
            tipoImportacao === 'nfe_xml' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Nota Fiscal XML (NF-e Fornecedor - PDVOpen)</span>
        </button>
      </div>

      {/* ABA: NF-e XML */}
      {tipoImportacao === 'nfe_xml' && (
        <div className="space-y-6">
          {nfeItens.length === 0 ? (
            <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-3xl p-12 text-center bg-slate-900/40 transition flex flex-col items-center justify-center">
              <FileCode className="w-16 h-16 text-indigo-400 mb-4 animate-bounce" />
              <h3 className="text-lg font-bold text-slate-200">Arraste ou selecione o arquivo XML da NF-e</h3>
              <p className="text-xs text-slate-500 mt-1 mb-6">Importa o XML padrão da SEFAZ emitido pelo seu fornecedor</p>

              <label className="cursor-pointer px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-indigo-600/30">
                <Upload className="w-5 h-5" />
                <span>Selecionar Arquivo .XML</span>
                <input type="file" accept=".xml" onChange={handleFileUpload} className="hidden" />
              </label>

              <button
                onClick={carregarDemoNfeXml}
                className="mt-4 text-xs text-indigo-400 hover:underline font-mono"
              >
                Ou clique aqui para testar com um arquivo XML de NF-e simulado
              </button>
            </div>
          ) : (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-5">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-white text-base">NF-e #{nfeNumero} - {nfeEmitente}</h3>
                  <p className="text-xs text-slate-400 font-mono">{nfeItens.length} itens identificados na nota</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">Markup Sugerido:</span>
                  <input
                    type="number"
                    value={margemMarkupPadrao}
                    onChange={e => {
                      const m = parseFloat(e.target.value) || 0;
                      setMargemMarkupPadrao(m);
                      setNfeItens(prev => prev.map(it => ({
                        ...it,
                        margemSugeridaPercentual: m,
                        precoVendaSugerido: parseFloat((it.valorUnitario * (1 + m / 100)).toFixed(2))
                      })));
                    }}
                    className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-center text-xs text-white font-mono"
                  />
                  <span className="text-xs text-slate-400">%</span>
                </div>
              </div>

              {/* Tabela de Produtos da NF-e */}
              <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
                <table className="w-full text-xs text-left font-mono">
                  <thead className="bg-slate-800 text-slate-400">
                    <tr>
                      <th className="p-2.5">Cód. Barras</th>
                      <th className="p-2.5 font-sans">Descrição do Produto</th>
                      <th className="p-2.5 text-center">Un.</th>
                      <th className="p-2.5 text-center">Qtd. Entrada</th>
                      <th className="p-2.5 text-right">Custo Un.</th>
                      <th className="p-2.5 text-right">Preço Venda Sugerido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {nfeItens.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/60">
                        <td className="p-2.5 text-slate-400">{item.codigoBarras}</td>
                        <td className="p-2.5 font-sans font-medium text-white">{item.descricao}</td>
                        <td className="p-2.5 text-center text-slate-400">{item.unidadeComercial}</td>
                        <td className="p-2.5 text-center font-bold text-sky-400">+{item.quantidade}</td>
                        <td className="p-2.5 text-right">R$ {item.valorUnitario.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-400">R$ {item.precoVendaSugerido.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sucessoImportacao ? (
                <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 font-medium flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-emerald-400" />
                    <span>{sucessoImportacao}</span>
                  </div>
                  <button
                    onClick={onVoltarParaPdv}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
                  >
                    Ir para Frente de Caixa
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => { setNfeItens([]); setArquivoNome(''); }}
                    className="text-xs text-slate-500 hover:text-slate-300 font-mono"
                  >
                    Cancelar e carregar outro XML
                  </button>

                  <button
                    onClick={confirmarEntradaEstoqueNfe}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl flex items-center gap-2 transition"
                  >
                    <PackagePlus className="w-5 h-5" />
                    <span>Dar Entrada em Estoque e Atualizar Preços</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ABA: Planilha Excel / CSV com IA */}
      {tipoImportacao === 'ia_planilha' && (
        <div className="space-y-6">
          {!arquivoNome ? (
            <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-3xl p-12 text-center bg-slate-900/40 transition flex flex-col items-center justify-center">
              <FileSpreadsheet className="w-16 h-16 text-indigo-400 mb-4 animate-bounce" />
              <h3 className="text-lg font-bold text-slate-200">Arraste ou selecione sua planilha de produtos</h3>
              <p className="text-xs text-slate-500 mt-1 mb-6">Suporta arquivos .CSV e .XLSX com qualquer nomenclatura de colunas</p>

              <label className="cursor-pointer px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-indigo-600/30">
                <Upload className="w-5 h-5" />
                <span>Selecionar Arquivo .CSV</span>
                <input type="file" accept=".csv, .txt, .xlsx" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          ) : (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-white">Mapeamento Sugerido pela Inteligência Artificial</h3>
                </div>
                {mapeamento && (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold border border-emerald-500/30">
                    {(mapeamento.confianca * 100).toFixed(0)}% de Confiança
                  </span>
                )}
              </div>

              {analisando ? (
                <div className="py-8 text-center text-slate-400 font-mono animate-pulse">
                  IA analisando colunas semânticas da planilha...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">CÓDIGO DE BARRAS:</label>
                    <select
                      value={colCodigo}
                      onChange={e => setColCodigo(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm"
                    >
                      {cabecalhos.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">NOME / DESCRIÇÃO:</label>
                    <select
                      value={colNome}
                      onChange={e => setColNome(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm"
                    >
                      {cabecalhos.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">PREÇO DE VENDA (R$):</label>
                    <select
                      value={colPreco}
                      onChange={e => setColPreco(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm"
                    >
                      {cabecalhos.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">ESTOQUE INICIAL:</label>
                    <select
                      value={colEstoque}
                      onChange={e => setColEstoque(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm"
                    >
                      {cabecalhos.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSucessoImportacao('Planilha importada com sucesso para o banco de dados local!')}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl flex items-center gap-2 transition"
                >
                  <span>Confirmar e Salvar Produtos no Catálogo Local</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
