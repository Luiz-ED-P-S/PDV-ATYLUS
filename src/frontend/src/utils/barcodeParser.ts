export interface ParsedBarcodeResult {
  isBalanca: boolean;
  codigoProduto: string;
  codigoProdutoPadrao: string;
  valorOuPesoEmbutido?: number;
  tipoEmbutido?: 'preco' | 'peso';
}

/**
 * Decodificador Inteligente de Código de Barras de Balança (Padrão Nacional EAN-13 iniciando com '2')
 * Utilizado por sistemas líderes de varejo como PDVOpen para hortifrúti, padaria e açougue.
 * Estrutura: 2 + CCCCC (código produto) + VVVVV / PPPPP (valor em centavos ou peso em gramas) + D (dígito verificador)
 */
export function decodificarCodigoBarras(codigoEntrada: string): ParsedBarcodeResult {
  const limpo = codigoEntrada.trim();

  // Verifica se é código EAN-13 de balança (inicia com '2' e possui 12 ou 13 dígitos)
  if (limpo.startsWith('2') && (limpo.length === 12 || limpo.length === 13)) {
    // Exemplo: 2 00010 001250 5 -> Código 10, R$ 12,50
    const codigoRaw = limpo.substring(1, 6);
    const codigoSemZeros = codigoRaw.replace(/^0+/, '') || codigoRaw;
    const parteDados = limpo.substring(6, 12);
    const dadosNumericos = parseInt(parteDados, 10);

    if (!isNaN(dadosNumericos)) {
      // Por padrão em supermercados e PDVOpen, o mais comum no varejo é o valor total embutido em centavos
      const valorReais = dadosNumericos / 100.0;
      return {
        isBalanca: true,
        codigoProduto: codigoSemZeros,
        codigoProdutoPadrao: codigoRaw,
        valorOuPesoEmbutido: valorReais,
        tipoEmbutido: 'preco',
      };
    }
  }

  return {
    isBalanca: false,
    codigoProduto: limpo,
    codigoProdutoPadrao: limpo,
  };
}
