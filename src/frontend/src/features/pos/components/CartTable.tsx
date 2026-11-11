import React from 'react';
import { Trash2, Plus, Minus, ShoppingBag, Sparkles, Tag } from 'lucide-react';
import { useCartStore } from '../../../store/useCartStore';

export const CartTable: React.FC = () => {
  const { getItens, getSelectedItemId, selecionarItem, incrementarQuantidade, removerItem } = useCartStore();
  const itens = getItens();
  const selectedItemId = getSelectedItemId();

  if (itens.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200/90 rounded-3xl bg-white/70 text-slate-400 p-8 shadow-sm backdrop-blur-sm transition-all duration-300">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-slate-100 to-indigo-50/60 border border-slate-200/80 flex items-center justify-center mb-4 text-indigo-500 shadow-inner">
          <ShoppingBag className="w-10 h-10 animate-pulse text-indigo-500/80" />
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <h3 className="text-xl font-black text-slate-800 tracking-tight">Caixa Livre &bull; Pronto para Venda</h3>
        </div>
        <p className="text-sm text-slate-500 text-center max-w-sm font-medium">
          Passe o leitor de código de barras ou aperte <kbd className="px-2.5 py-1 bg-indigo-50 border border-indigo-200/70 rounded-lg text-indigo-600 font-mono text-xs font-bold shadow-sm">F2</kbd> para catálogo visual.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 max-w-md text-xs font-medium text-slate-500">
          <span className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200/60 flex items-center gap-1.5 shadow-xs">
            <Tag className="w-3.5 h-3.5 text-indigo-500" />
            <span>Múltiplos: <strong className="text-slate-800 font-mono">3*código</strong></span>
          </span>
          <span className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200/60 flex items-center gap-1.5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Balança: <strong className="text-slate-800 font-mono">0.450*código</strong></span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white rounded-3xl border border-slate-200/90 flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="overflow-y-auto flex-1 custom-scrollbar">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50/90 backdrop-blur-md sticky top-0 z-10 border-b border-slate-100 text-slate-400 text-[11px] uppercase tracking-wider font-bold">
            <tr>
              <th className="py-3.5 px-4 w-14 text-center font-semibold">#</th>
              <th className="py-3.5 px-4 w-36 font-semibold">Cód. Barras</th>
              <th className="py-3.5 px-4 font-semibold">Descrição do Produto</th>
              <th className="py-3.5 px-4 w-28 text-right font-semibold">Unitário</th>
              <th className="py-3.5 px-4 w-40 text-center font-semibold">Qtd / Peso</th>
              <th className="py-3.5 px-4 w-32 text-right font-semibold">Subtotal</th>
              <th className="py-3.5 px-4 w-16 text-center font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {itens.map((item, index) => {
              const isSelected = item.id === selectedItemId;
              const isKg = item.unidadeMedida === 'KG';

              return (
                <tr
                  key={item.id}
                  onClick={() => selecionarItem(item.id)}
                  className={`cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600 shadow-xs'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  <td className="py-3.5 px-4 text-center text-xs font-mono font-bold text-slate-400">
                    {String(index + 1).padStart(2, '0')}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-mono font-semibold text-slate-500">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200/60">
                      {item.codigoBarras}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span>{item.nome}</span>
                      {isKg && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 font-mono font-bold shadow-xs">
                          KG
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-600 font-semibold text-xs">
                    R$ {item.precoUnitario.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        title="Diminuir quantidade (-)"
                        onClick={() => incrementarQuantidade(item.id, -1)}
                        className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center active:scale-95 transition shadow-xs"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-16 text-center font-mono font-bold text-slate-900 text-sm">
                        {isKg ? `${item.quantidade.toFixed(3)} kg` : item.quantidade}
                      </span>
                      <button
                        title="Aumentar quantidade (+)"
                        onClick={() => incrementarQuantidade(item.id, 1)}
                        className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center active:scale-95 transition shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-emerald-600 text-base font-mono">
                    R$ {item.subtotal.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-center" onClick={e => e.stopPropagation()}>
                    <button
                      title="Remover produto (Delete)"
                      onClick={() => removerItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
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
