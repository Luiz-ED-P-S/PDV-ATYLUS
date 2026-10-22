import React from 'react';
import { Trash2, Plus, Minus, ShoppingCart } from 'lucide-react';
import { useCartStore } from '../../../store/useCartStore';

export const CartTable: React.FC = () => {
  const { itens, selectedItemId, selecionarItem, incrementarQuantidade, removerItem } = useCartStore();

  if (itens.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/40 text-slate-500 p-8">
        <ShoppingCart className="w-16 h-16 text-slate-700 mb-3 animate-pulse" />
        <h3 className="text-xl font-bold text-slate-400">Caixa Livre / Carrinho Vazio</h3>
        <p className="text-sm mt-1 text-slate-500 text-center max-w-sm">
          Passe o produto no leitor de código de barras ou pressione <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-emerald-400 font-mono text-xs">F2</kbd> para buscar pelo nome.
        </p>
        <div className="mt-4 flex gap-4 text-xs text-slate-600 font-mono">
          <span>Dica: Digite <strong className="text-slate-400">3*789...</strong> para adicionar 3 unidades</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col overflow-hidden shadow-inner">
      <div className="overflow-y-auto flex-1">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-800/90 sticky top-0 z-10 border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider font-mono">
            <tr>
              <th className="py-3 px-3 w-12 text-center">Item</th>
              <th className="py-3 px-3 w-36">Cód. Barras</th>
              <th className="py-3 px-3">Descrição do Produto</th>
              <th className="py-3 px-3 w-28 text-right">Unitário</th>
              <th className="py-3 px-3 w-36 text-center">Qtd.</th>
              <th className="py-3 px-3 w-32 text-right">Subtotal</th>
              <th className="py-3 px-3 w-14 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {itens.map((item, index) => {
              const isSelected = item.id === selectedItemId;

              return (
                <tr
                  key={item.id}
                  onClick={() => selecionarItem(item.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-emerald-950/40 border-l-4 border-l-emerald-500 text-white'
                      : 'hover:bg-slate-800/40 text-slate-300'
                  }`}
                >
                  <td className="py-3 px-3 text-center text-xs text-slate-500">
                    {String(index + 1).padStart(2, '0')}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-400 font-mono">
                    {item.codigoBarras}
                  </td>
                  <td className="py-3 px-3 font-sans font-medium text-slate-200">
                    {item.nome}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">
                    R$ {item.precoUnitario.toFixed(2)}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        title="Diminuir quantidade (-)"
                        onClick={() => incrementarQuantidade(item.id, -1)}
                        className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95 transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-10 text-center font-bold text-white text-base">
                        {item.quantidade}
                      </span>
                      <button
                        title="Aumentar quantidade (+)"
                        onClick={() => incrementarQuantidade(item.id, 1)}
                        className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-400 text-base font-mono">
                    R$ {item.subtotal.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                    <button
                      title="Excluir item (Del)"
                      onClick={() => removerItem(item.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded transition"
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
