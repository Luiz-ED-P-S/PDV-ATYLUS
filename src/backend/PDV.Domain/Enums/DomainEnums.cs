namespace PDV.Domain.Enums;

public enum StatusCaixa
{
    Aberto = 1,
    Fechado = 2
}

public enum TipoMovimentacaoCaixa
{
    Suprimento = 1, // Entrada de dinheiro no caixa (troco inicial / reforço)
    Sangria = 2     // Retirada de dinheiro do caixa
}

public enum StatusVenda
{
    Concluida = 1,
    Cancelada = 2
}

public enum FormaPagamento
{
    Dinheiro = 1,
    Pix = 2,
    CartaoCredito = 3,
    CartaoDebito = 4
}

public enum PerfilOperador
{
    Operador = 1,
    Supervisor = 2
}

public enum TipoConexaoImpressora
{
    SpoolerWindows = 1,
    RedeTcp = 2,
    SerialCom = 3,
    SimuladorArquivo = 4
}

public enum LarguraBobina
{
    Mm80 = 80, // Padrão 48 colunas
    Mm58 = 58  // Padrão 32 colunas
}
