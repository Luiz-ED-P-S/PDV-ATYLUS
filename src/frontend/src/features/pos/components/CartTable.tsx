import React from 'react';
import { Trash2, Plus, Minus, ShoppingCart } from 'lucide-react';
import { useCartStore } from '../../../store/useCartStore';

export const CartTable: React.FC = () => {
  const { getItens, getSelectedItemId, selecionarItem, incrementarQuantidade, removerItem } = useCartStore();
  const itens = getItens();
  const selectedItemId = getSelectedItemId();

  if (itens.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200/90 rounded-3xl bg-white/70 text-slate-400 p-8 shadow-sm">
        <div className="w-20 h-20 rounded-3xl bg-slate-50 border border-slate-200/80 flex items-center justify-center mb-4 text-slate-300">
          <ShoppingCart className="w-10 h-10 animate-pulse text-slate-400" />
        </div>
        <h3 className="text-xl font-black text-slate-700">Caixa Livre / Venda sem Itens</h3>
        <p className="text-sm mt-1 text-slate-500 text-center max-w-sm font-medium">
          Passe o produto no leitor de código de barras ou pressione <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-lg text-[#005bf8] font-mono text-xs font-bold">F2</kbd> para buscar.
        </p>
        <div className="mt-5 flex flex-col gap-1.5 text-xs text-slate-400 font-mono text-center">
          <span>• Dica: Digite <strong className="text-slate-600">3*código</strong> para 3 unidades</span>
          <span>• Balança: Digite <strong className="text-slate-600">0.450*código</strong> para 450 gramas</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white rounded-3xl border border-slate-200/90 flex flex-col overflow-hidden shadow-sm">
      <div className="overflow-y-auto flex-1">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50/80 sticky top-0 z-10 border-b border-slate-100 text-slate-400 text-[11px] uppercase tracking-wider font-bold">
            <tr>
              <th className="py-3.5 px-3 w-12 text-center font-semibold">Item</th>
              <th className="py-3.5 px-3 w-36 font-semibold">Cód. Barras</th>
              <th className="py-3.5 px-3 font-semibold">Descrição do Produto</th>
              <th className="py-3.5 px-3 w-28 text-right font-semibold">Unitário</th>
              <th className="py-3.5 px-3 w-40 text-center font-semibold">Qtd / Peso</th>
              <th className="py-3.5 px-3 w-32 text-right font-semibold">Subtotal</th>
              <th className="py-3.5 px-3 w-14 text-center font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {itens.map((item, index) => {
              const isSelected = item.id === selectedItemId;
              const isKg = item.unidadeMedida === 'KG';

              return (
                <tr
                  key={item.id}
                  onClick={() => selecionarItem(item.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50/70 border-l-4 border-l-[#005bf8]'
                      : 'hover:bg-slate-50/70'
                  }`}
                >
                  <td className="py-3.5 px-3 text-center text-xs font-mono font-bold text-slate-400">
                    {String(index + 1).padStart(2, '0')}
                  </td>
                  <td className="py-3.5 px-3 text-xs font-mono font-bold text-slate-600">
                    {item.codigoBarras}
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-slate-900">
                    {item.nome}
                    {isKg && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-mono font-bold">
                        KG
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-600 font-medium">
                    R$ {item.precoUnitario.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        title="Diminuir quantidade (-)"
                        onClick={() => incrementarQuantidade(item.id, -1)}
                        className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center active:scale-95 transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-14 text-center font-mono font-bold text-slate-900 text-sm">
                        {isKg ? `${item.quantidade.toFixed(3)} kg` : item.quantidade}
                      </span>
                      <button
                        title="Aumentar quantidade (+)"
                        onClick={() => incrementarQuantidade(item.id, 1)}
                        className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center active:scale-95 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right font-bold text-emerald-600 text-base font-mono">
                    R$ {item.subtotal.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                    <button
                      title="Excluir item (Del)"
                      onClick={() => removerItem(item.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
