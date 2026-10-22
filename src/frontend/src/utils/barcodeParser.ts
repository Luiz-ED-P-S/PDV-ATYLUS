export interface ParsedBarcodeResult {
  isBalanca: boolean;
  codigoProduto: string;
  valorOuPesoEmbutido?: number;
  tipoEmbutido?: 'preco' | 'peso';
}

/**
 * Decodificador de Código de Barras de Balança (Padrão Nacional EAN-13 iniciando com '2')
 * Estrutura comum: 2 + CCCCC (código produto) + VVVVV (valor ou peso) + D (dígito verificador)
 */
export function decodificarCodigoBarras(codigoEntrada: string): ParsedBarcodeResult {
  const limpo = codigoEntrada.trim();

  // Verifica se é código EAN-13 de balança (inicia com '2' e possui 12 ou 13 dígitos)
  if (limpo.startsWith('2') && (limpo.length === 12 || limpo.length === 13)) {
    // Exemplo clássico: 2 00010 001250 5 -> Código 10, R$ 12,50
    const codigoItem = limpo.substring(1, 6).replace(/^0+/, ''); // Remove zeros à esquerda
    const parteValor = limpo.substring(6, 12);
    const valorCentavos = parseInt(parteValor, 10);

    if (!isNaN(valorCentavos)) {
      const valorReais = valorCentavos / 100.0;
      return {
        isBalanca: true,
        codigoProduto: codigoItem,
        valorOuPesoEmbutido: valorReais,
        tipoEmbutido: 'preco',
      };
    }
  }

  return {
    isBalanca: false,
    codigoProduto: limpo,
  };
}
