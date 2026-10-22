using PDV.Domain.Enums;
using PDV.Domain.Exceptions;

namespace PDV.Domain.Entities;

public class Venda : BaseEntity
{
    public Guid CaixaId { get; private set; }
    public string OperadorId { get; private set; } = string.Empty;
    public DateTime DataVenda { get; private set; } = DateTime.UtcNow;
    public decimal ValorTotal { get; private set; }
    public decimal Desconto { get; private set; }
    public decimal ValorLiquido => Math.Max(0, ValorTotal - Desconto);
    public StatusVenda Status { get; private set; } = StatusVenda.Concluida;
    public string? MotivoCancelamento { get; private set; }
    public string? ClienteNome { get; set; }
    public string? ClienteDocumento { get; set; }

    private readonly List<ItemVenda> _itens = new();
    public IReadOnlyCollection<ItemVenda> Itens => _itens.AsReadOnly();

    private readonly List<PagamentoVenda> _pagamentos = new();
    public IReadOnlyCollection<PagamentoVenda> Pagamentos => _pagamentos.AsReadOnly();

    protected Venda() { }

    public Venda(Guid caixaId, string operadorId, decimal desconto = 0)
    {
        if (caixaId == Guid.Empty)
            throw new DomainException("O identificador do caixa é obrigatório para registrar uma venda.");

        if (desconto < 0)
            throw new DomainException("O desconto não pode ser negativo.");

        CaixaId = caixaId;
        OperadorId = string.IsNullOrWhiteSpace(operadorId) ? "OPERADOR_PADRAO" : operadorId.Trim();
        DataVenda = DateTime.UtcNow;
        Desconto = desconto;
        Status = StatusVenda.Concluida;
    }

    public void AdicionarItem(Guid produtoId, string produtoNome, string codigoBarras, decimal quantidade, decimal precoUnitario)
    {
        if (Status == StatusVenda.Cancelada)
            throw new DomainException("Não é possível adicionar itens a uma venda cancelada.");

        var item = new ItemVenda(Id, produtoId, produtoNome, codigoBarras, quantidade, precoUnitario);
        _itens.Add(item);
        RecalcularTotal();
    }

    public void AdicionarPagamento(FormaPagamento formaPagamento, decimal valor, decimal troco = 0, string? txId = null)
    {
        if (Status == StatusVenda.Cancelada)
            throw new DomainException("Não é possível adicionar pagamentos a uma venda cancelada.");

        var pagamento = new PagamentoVenda(Id, formaPagamento, valor, troco, txId);
        _pagamentos.Add(pagamento);
    }

    public void Cancelar(string motivo)
    {
        if (Status == StatusVenda.Cancelada)
            throw new DomainException("A venda já se encontra cancelada.");

        if (string.IsNullOrWhiteSpace(motivo))
            throw new DomainException("O motivo do cancelamento é obrigatório.");

        Status = StatusVenda.Cancelada;
        MotivoCancelamento = motivo.Trim();
        RegistrarAtualizacao();
    }

    private void RecalcularTotal()
    {
        ValorTotal = _itens.Sum(i => i.Subtotal);
        RegistrarAtualizacao();
    }
}
