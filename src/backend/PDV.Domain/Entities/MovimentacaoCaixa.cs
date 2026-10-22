using PDV.Domain.Enums;
using PDV.Domain.Exceptions;

namespace PDV.Domain.Entities;

public class MovimentacaoCaixa : BaseEntity
{
    public Guid CaixaId { get; private set; }
    public TipoMovimentacaoCaixa Tipo { get; private set; }
    public decimal Valor { get; private set; }
    public string Motivo { get; private set; } = string.Empty;
    public string OperadorId { get; private set; } = string.Empty;
    public DateTime DataHora { get; private set; } = DateTime.UtcNow;

    protected MovimentacaoCaixa() { }

    public MovimentacaoCaixa(Guid caixaId, TipoMovimentacaoCaixa tipo, decimal valor, string motivo, string operadorId)
    {
        if (caixaId == Guid.Empty)
            throw new DomainException("O identificador do caixa é obrigatório para registrar movimentação.");

        if (valor <= 0)
            throw new DomainException("O valor da movimentação deve ser maior que zero.");

        if (string.IsNullOrWhiteSpace(motivo))
            throw new DomainException("O motivo da movimentação é obrigatório.");

        CaixaId = caixaId;
        Tipo = tipo;
        Valor = valor;
        Motivo = motivo.Trim();
        OperadorId = string.IsNullOrWhiteSpace(operadorId) ? "SISTEMA" : operadorId.Trim();
        DataHora = DateTime.UtcNow;
    }
}
