import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { Produto } from '../../../types';
import { pdvApi } from '../../../services/api';
import { useCartStore } from '../../../store/useCartStore';

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProductSearchModal: React.FC<ProductSearchModalProps> = ({ isOpen, onClose }) => {
  const [termo, setTermo] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const adicionarProduto = useCartStore(state => state.adicionarProduto);

  useEffect(() => {
    if (isOpen) {
      setTermo('');
      setSelectedIndex(0);
      buscar('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const buscar = async (q: string) => {
    setCarregando(true);
    try {
      const res = await pdvApi.buscarProdutos(q);
      setProdutos(res);
      setSelectedIndex(0);
    } finally {
      setCarregando(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < produtos.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (produtos[selectedIndex]) {
        selecionar(produtos[selectedIndex]);
      }
    }
  };

  const selecionar = (p: Produto) => {
    adicionarProduto(p, 1);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDown}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center gap-2 text-slate-200 font-bold">
            <Search className="w-5 h-5 text-sky-400" />
            <span>Consultar Produtos (F2)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Campo de Busca */}
        <div className="p-4 border-b border-slate-800 bg-slate-900">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Digite o nome ou código do produto..."
              value={termo}
              onChange={e => {
                setTermo(e.target.value);
                buscar(e.target.value);
              }}
              className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-medium placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono text-base"
            />
          </div>
        </div>

        {/* Lista de Resultados */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800 p-2">
          {carregando ? (
            <div className="p-8 text-center text-slate-500 font-mono">Buscando catálogo...</div>
          ) : produtos.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Nenhum produto localizado para "{termo}".</div>
          ) : (
            produtos.map((p, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={p.id}
                  onClick={() => selecionar(p)}
                  className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition ${
                    isSelected
                      ? 'bg-sky-950/60 border border-sky-500/40 text-white'
                      : 'hover:bg-slate-800/50 text-slate-300'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-slate-100 flex items-center gap-2">
                      <span>{p.nome}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 font-mono text-slate-400">
                        {p.codigoBarras}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Estoque Atual: <strong className="text-slate-400">{p.estoqueAtual} un</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold font-mono text-emerald-400">
                      R$ {p.precoVenda.toFixed(2)}
                    </span>
                    <button className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé com dicas de teclas */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-500 flex justify-between font-mono">
          <span>[↑/↓] Navegar • [Enter] Adicionar • [Esc] Fechar</span>
          <span>{produtos.length} produtos listados</span>
        </div>
      </div>
    </div>
  );
};
