using PDV.Domain.Exceptions;

namespace PDV.Domain.Entities;

public class ItemVenda : BaseEntity
{
    public Guid VendaId { get; private set; }
    public Guid ProdutoId { get; private set; }
    public string ProdutoNome { get; private set; } = string.Empty;
    public string CodigoBarras { get; private set; } = string.Empty;
    public decimal Quantidade { get; private set; }
    public decimal PrecoUnitario { get; private set; }
    public decimal Subtotal => Quantidade * PrecoUnitario;

    protected ItemVenda() { }

    public ItemVenda(Guid vendaId, Guid produtoId, string produtoNome, string codigoBarras, decimal quantidade, decimal precoUnitario)
    {
        if (vendaId == Guid.Empty)
            throw new DomainException("O identificador da venda é obrigatório.");

        if (produtoId == Guid.Empty)
            throw new DomainException("O identificador do produto é obrigatório.");

        if (quantidade <= 0)
            throw new DomainException("A quantidade do item deve ser maior que zero.");

        if (precoUnitario <= 0)
            throw new DomainException("O preço unitário deve ser maior que zero.");

        VendaId = vendaId;
        ProdutoId = produtoId;
        ProdutoNome = produtoNome.Trim();
        CodigoBarras = codigoBarras.Trim();
        Quantidade = quantidade;
        PrecoUnitario = precoUnitario;
    }
}
