using PDV.Domain.Enums;
using PDV.Domain.Exceptions;

namespace PDV.Domain.Entities;

public class PagamentoVenda : BaseEntity
{
    public Guid VendaId { get; private set; }
    public FormaPagamento FormaPagamento { get; private set; }
    public decimal Valor { get; private set; }
    public decimal Troco { get; private set; }
    public string? TxId { get; private set; }

    protected PagamentoVenda() { }

    public PagamentoVenda(Guid vendaId, FormaPagamento formaPagamento, decimal valor, decimal troco = 0, string? txId = null)
    {
        if (vendaId == Guid.Empty)
            throw new DomainException("O identificador da venda é obrigatório para registrar o pagamento.");

        if (valor <= 0)
            throw new DomainException("O valor do pagamento deve ser maior que zero.");

        if (troco < 0)
            throw new DomainException("O valor do troco não pode ser negativo.");

        VendaId = vendaId;
        FormaPagamento = formaPagamento;
        Valor = valor;
        Troco = troco;
        TxId = txId?.Trim();
    }
}
