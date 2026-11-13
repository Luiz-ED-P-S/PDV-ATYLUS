import React, { useState } from 'react';
import { ShieldAlert, Lock, Eye, EyeOff, CheckCircle2, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

const REGRAS = [
  'De 4 a 8 dígitos, apenas números',
  'Diferente do PIN atual e dos PINs de fábrica (0000 e 1234)',
  'Sem sequências (1234, 4321, 7890) nem repetições (1111, 1212)',
];

/**
 * Tela exibida no lugar do sistema enquanto o operador usa um PIN temporário (de fábrica ou trivial).
 * A regra é imposta pela API (ela recusa qualquer outra operação com 403 PIN_TEMPORARIO); esta tela só guia a troca.
 */
export const TrocaPinObrigatoria: React.FC = () => {
  const { operador, alterarPin, logout } = useAuthStore();
  const [pinAtual, setPinAtual] = useState('');
  const [novoPin, setNovoPin] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const soNumeros = (valor: string) => valor.replace(/\D/g, '').slice(0, 8);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!/^\d{4,8}$/.test(novoPin)) {
      setErro('O novo PIN deve ter de 4 a 8 dígitos numéricos.');
      return;
    }
    if (novoPin !== confirmacao) {
      setErro('A confirmação não confere com o novo PIN.');
      return;
    }

    setSalvando(true);
    try {
      // A API valida tudo de novo, devolve um novo token e a tela some quando o PIN deixa de ser temporário
      await alterarPin(pinAtual, novoPin, confirmacao);
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível alterar o PIN.');
      setSalvando(false);
      setPinAtual('');
    }
  };

  const tipo = mostrar ? 'text' : 'password';
  const classeCampo =
    'w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono tracking-widest focus:bg-white focus:border-blue-500 focus:outline-none';

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f0f3f8] p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-[28px] shadow-[0_20px_60px_-15px_rgba(0,40,120,0.12)] border border-slate-100 p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 leading-tight">Defina um novo PIN</h1>
            <p className="text-xs text-slate-500">
              {operador.nome ? `${operador.nome} (${operador.matricula})` : operador.matricula}
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Você entrou com um PIN temporário. Por segurança, troque-o agora para continuar usando o sistema.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off">
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type={tipo}
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="PIN atual (temporário)"
              value={pinAtual}
              onChange={(e) => setPinAtual(soNumeros(e.target.value))}
              required
              className={classeCampo}
            />
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type={tipo}
              inputMode="numeric"
              autoComplete="new-password"
              placeholder="Novo PIN"
              value={novoPin}
              onChange={(e) => setNovoPin(soNumeros(e.target.value))}
              required
              className={classeCampo}
            />
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type={tipo}
              inputMode="numeric"
              autoComplete="new-password"
              placeholder="Confirmar novo PIN"
              value={confirmacao}
              onChange={(e) => setConfirmacao(soNumeros(e.target.value))}
              required
              className={classeCampo}
            />
            <button
              type="button"
              onClick={() => setMostrar((v) => !v)}
              aria-label={mostrar ? 'Ocultar PINs' : 'Mostrar PINs'}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {mostrar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <ul className="text-[11px] text-slate-500 space-y-1 pt-1">
            {REGRAS.map((regra) => (
              <li key={regra} className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mt-px shrink-0" />
                <span>{regra}</span>
              </li>
            ))}
          </ul>

          {erro && (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={salvando}
            className="w-full py-3.5 bg-[#005bf8] hover:bg-[#004ce5] disabled:opacity-60 text-white text-sm font-bold rounded-2xl transition-colors"
          >
            {salvando ? 'Salvando...' : 'Salvar novo PIN e continuar'}
          </button>
        </form>

        <button
          type="button"
          onClick={logout}
          className="mt-4 w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <LogOut className="w-3.5 h-3.5" /> Sair
        </button>
      </div>
    </div>
  );
};
