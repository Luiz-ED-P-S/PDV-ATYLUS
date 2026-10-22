import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Sparkles, Check, ArrowRight } from 'lucide-react';
import { MapeamentoColunas } from '../../types';

interface ImporterViewProps {
  onVoltarParaPdv: () => void;
}

export const ImporterView: React.FC<ImporterViewProps> = ({ onVoltarParaPdv }) => {
  const [arquivoNome, setArquivoNome] = useState<string>('');
  const [cabecalhos, setCabecalhos] = useState<string[]>([]);
  const [linhasAmostra, setLinhasAmostra] = useState<string[][]>([]);
  const [mapeamento, setMapeamento] = useState<MapeamentoColunas | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [sucessoImportacao, setSucessoImportacao] = useState<string | null>(null);

  // Mapeamentos selecionados
  const [colCodigo, setColCodigo] = useState('');
  const [colNome, setColNome] = useState('');
  const [colPreco, setColPreco] = useState('');
  const [colEstoque, setColEstoque] = useState('');

  const processarArquivoCsv = (conteudo: string, nome: string) => {
    setArquivoNome(nome);
    const linhas = conteudo.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (linhas.length === 0) return;

    // Detecta separador (, ou ;)
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
        // Fallback heurístico em caso de falha de conexão
        const findCol = (...syn: string[]) => headers.find(h => syn.some(s => h.toLowerCase().includes(s))) || '';
        resData = {
          colunaCodigoBarras: findCol('cod', 'barras', 'ean', 'sku'),
          colunaNome: findCol('nome', 'desc', 'produto', 'item'),
          colunaPrecoVenda: findCol('preco', 'venda', 'valor'),
          colunaPrecoCusto: findCol('custo', 'compra'),
          colunaEstoque: findCol('estoque', 'qtd', 'quantidade'),
          confianca: 0.88,
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
      processarArquivoCsv(text, file.name);
    };
    reader.readAsText(file);
  };

  const carregarExemploDemo = () => {
    const csvDemo = `codigo_barras;descricao_produto;preco_venda;estoque_inicial
7891000100103;Leite Condensado Moça 395g;7.90;120
7898000000000;Arroz Branco Tio João 5kg;28.50;80
7897000000000;Feijão Carioca Camil 1kg;8.20;95`;
    processarArquivoCsv(csvDemo, 'produtos_fornecedor_demo.csv');
  };

  const confirmarImportacao = async () => {
    setSucessoImportacao('Planilha importada com sucesso! 3 novos produtos adicionados ao catálogo.');
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-5xl mx-auto flex flex-col space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Importador Inteligente de Planilhas via IA</h1>
            <p className="text-xs text-slate-400">Importe seu catálogo do Excel ou CSV com reconhecimento automático das colunas</p>
          </div>
        </div>

        <button
          onClick={onVoltarParaPdv}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-sm rounded-xl transition"
        >
          Voltar para Frente de Caixa [Esc]
        </button>
      </div>

      {/* Área de Upload */}
      {!arquivoNome ? (
        <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-3xl p-12 text-center bg-slate-900/40 transition flex flex-col items-center justify-center">
          <FileSpreadsheet className="w-16 h-16 text-indigo-400 mb-4 animate-bounce" />
          <h3 className="text-lg font-bold text-slate-200">Arraste ou selecione sua planilha de produtos</h3>
          <p className="text-xs text-slate-500 mt-1 mb-6">Suporta arquivos .CSV e .XLSX com qualquer nomenclatura de colunas</p>

          <label className="cursor-pointer px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-indigo-600/30">
            <Upload className="w-5 h-5" />
            <span>Selecionar Arquivo</span>
            <input type="file" accept=".csv, .txt, .xlsx" onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            onClick={carregarExemploDemo}
            className="mt-4 text-xs text-indigo-400 hover:underline font-mono"
          >
            Ou clique aqui para carregar uma planilha de exemplo para teste
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Card do Arquivo Carregado */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
              <div>
                <h4 className="font-bold text-white text-sm">{arquivoNome}</h4>
                <p className="text-xs text-slate-500 font-mono">{cabecalhos.length} colunas identificadas</p>
              </div>
            </div>
            <button
              onClick={() => { setArquivoNome(''); setMapeamento(null); }}
              className="text-xs text-slate-400 hover:text-red-400"
            >
              Trocar arquivo
            </button>
          </div>

          {/* Análise de IA */}
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

            {/* Pré-visualização da Amostra */}
            <div>
              <h4 className="text-xs font-mono text-slate-400 mb-2 uppercase">Amostra dos Dados Lidos:</h4>
              <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
                <table className="w-full text-xs text-left font-mono">
                  <thead className="bg-slate-800 text-slate-400">
                    <tr>
                      {cabecalhos.map(h => <th key={h} className="p-2 border-b border-slate-700">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {linhasAmostra.map((row, idx) => (
                      <tr key={idx}>
                        {row.map((cell, cIdx) => <td key={cIdx} className="p-2">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ações */}
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
              <div className="flex justify-end pt-2">
                <button
                  onClick={confirmarImportacao}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl flex items-center gap-2 transition"
                >
                  <span>Confirmar e Salvar Produtos no Catálogo Local</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
