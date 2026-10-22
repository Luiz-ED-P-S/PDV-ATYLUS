using PDV.Domain.Enums;
using PDV.Domain.Exceptions;

namespace PDV.Domain.Entities;

public class Caixa : BaseEntity
{
    public string OperadorId { get; private set; } = string.Empty;
    public DateTime DataAbertura { get; private set; } = DateTime.UtcNow;
    public DateTime? DataFechamento { get; private set; }
    public decimal SaldoInicial { get; private set; }
    public decimal? SaldoFinalInformado { get; private set; }
    public StatusCaixa Status { get; private set; } = StatusCaixa.Aberto;
    public string? ObservacoesFechamento { get; private set; }

    private readonly List<MovimentacaoCaixa> _movimentacoes = new();
    public IReadOnlyCollection<MovimentacaoCaixa> Movimentacoes => _movimentacoes.AsReadOnly();

    protected Caixa() { }

    public Caixa(string operadorId, decimal saldoInicial = 0)
    {
        if (saldoInicial < 0)
            throw new DomainException("O saldo inicial não pode ser negativo.");

        OperadorId = string.IsNullOrWhiteSpace(operadorId) ? "OPERADOR_PADRAO" : operadorId.Trim();
        DataAbertura = DateTime.UtcNow;
        SaldoInicial = saldoInicial;
        Status = StatusCaixa.Aberto;

        if (saldoInicial > 0)
        {
            _movimentacoes.Add(new MovimentacaoCaixa(Id, TipoMovimentacaoCaixa.Suprimento, saldoInicial, "Saldo inicial de abertura", OperadorId));
        }
    }

    public void AdicionarMovimentacao(TipoMovimentacaoCaixa tipo, decimal valor, string motivo, string operadorId)
    {
        if (Status != StatusCaixa.Aberto)
            throw new DomainException("Não é possível realizar movimentações em um caixa fechado.");

        var movimentacao = new MovimentacaoCaixa(Id, tipo, valor, motivo, operadorId);
        _movimentacoes.Add(movimentacao);
        RegistrarAtualizacao();
    }

    public void FecharCego(decimal saldoInformado, string? observacoes = null)
    {
        if (Status != StatusCaixa.Aberto)
            throw new DomainException("Este caixa já se encontra fechado.");

        if (saldoInformado < 0)
            throw new DomainException("O saldo final informado não pode ser negativo.");

        SaldoFinalInformado = saldoInformado;
        ObservacoesFechamento = observacoes?.Trim();
        DataFechamento = DateTime.UtcNow;
        Status = StatusCaixa.Fechado;
        RegistrarAtualizacao();
    }
}
