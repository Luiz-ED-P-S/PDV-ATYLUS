import React, { useState } from 'react';
import { POSView } from './features/pos/POSView';
import { ImporterView } from './features/importer/ImporterView';

export const App: React.FC = () => {
  const [telaAtual, setTelaAtual] = useState<'pos' | 'importer'>('pos');

  return (
    <main className="w-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {telaAtual === 'pos' ? (
        <POSView onAbrirImportador={() => setTelaAtual('importer')} />
      ) : (
        <ImporterView onVoltarParaPdv={() => setTelaAtual('pos')} />
      )}
    </main>
  );
};

export default App;
