import React from 'react';
import { Printer, X } from 'lucide-react';
import { Venda } from '../../../types';

interface ReceiptPrintModalProps {
  venda: Venda | null;
  onClose: () => void;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({ venda, onClose }) => {
  if (!venda) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Topo do Modal */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center gap-2 text-white font-bold">
            <Printer className="w-5 h-5 text-emerald-400" />
            <span>Comprovante de Venda Não-Fiscal</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visualizador da Bobina Térmica 80mm */}
        <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-slate-950">
          <div
            id="printable-receipt"
            className="w-[80mm] bg-amber-50/95 text-slate-900 p-4 font-mono text-xs shadow-xl rounded-sm border border-slate-300 select-text"
          >
            {/* Cabeçalho do Cupom */}
            <div className="text-center border-b border-dashed border-slate-400 pb-2 mb-2">
              <h1 className="font-extrabold text-sm tracking-wider">PDV ATYLUS COMERCIAL</h1>
              <p className="text-[10px] text-slate-600">Rua do Comércio, 1000 - Centro</p>
              <p className="text-[10px] text-slate-600">CNPJ: 00.000.000/0001-00</p>
              <p className="text-[10px] font-bold mt-1">*** CUPOM NÃO FISCAL ***</p>
            </div>

            {/* Metadados da Venda */}
            <div className="text-[10px] space-y-0.5 border-b border-dashed border-slate-400 pb-2 mb-2">
              <div className="flex justify-between">
                <span>Venda: #{venda.id.slice(-6).toUpperCase()}</span>
                <span>{new Date(venda.dataVenda).toLocaleDateString('pt-BR')} {new Date(venda.dataVenda).toLocaleTimeString('pt-BR')}</span>
              </div>
              <div className="flex justify-between">
                <span>Operador: {venda.operadorId}</span>
                <span>Terminal: 01</span>
              </div>
            </div>

            {/* Tabela de Itens */}
            <div className="border-b border-dashed border-slate-400 pb-2 mb-2">
              <div className="flex justify-between font-bold text-[10px] border-b border-slate-300 pb-1 mb-1">
                <span>ITEM DESC</span>
                <span>QTD x UN</span>
                <span>TOTAL</span>
              </div>

              {venda.itens.map((item, idx) => (
                <div key={idx} className="mb-1 text-[10px]">
                  <div className="font-semibold">{item.produtoNome}</div>
                  <div className="flex justify-between text-slate-700">
                    <span>{item.quantidade} x R$ {item.precoUnitario.toFixed(2)}</span>
                    <span className="font-bold">R$ {item.subtotal.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totais e Pagamentos */}
            <div className="space-y-1 text-xs border-b border-dashed border-slate-400 pb-2 mb-2">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>R$ {venda.valorTotal.toFixed(2)}</span>
              </div>
              {venda.desconto > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>DESCONTO:</span>
                  <span>- R$ {venda.desconto.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-slate-300">
                <span>TOTAL:</span>
                <span>R$ {venda.valorLiquido.toFixed(2)}</span>
              </div>

              <div className="pt-2 text-[10px]">
                {venda.pagamentos.map((pag, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>FORMA ({pag.formaPagamento}):</span>
                    <span>R$ {pag.valor.toFixed(2)}</span>
                  </div>
                ))}
                {venda.pagamentos.some(p => p.troco > 0) && (
                  <div className="flex justify-between font-bold">
                    <span>TROCO:</span>
                    <span>R$ {venda.pagamentos.find(p => p.troco > 0)?.troco.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé e Código de Barras */}
            <div className="text-center pt-2 text-[10px] text-slate-600">
              <p>Obrigado pela preferência!</p>
              <p>Volte sempre!</p>
              <div className="mt-2 tracking-widest font-mono text-[9px] text-slate-800">
                |||||||||||||||||||||||||||||||||||||||||||||
              </div>
              <p className="text-[8px] text-slate-500 mt-1">{venda.id}</p>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-sm"
          >
            [Esc] Fechar e Nova Venda
          </button>

          <button
            onClick={handlePrint}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/25"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Cupom</span>
          </button>
        </div>
      </div>
    </div>
  );
};
