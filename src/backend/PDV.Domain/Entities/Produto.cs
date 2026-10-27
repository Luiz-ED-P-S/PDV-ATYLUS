using PDV.Domain.Exceptions;

namespace PDV.Domain.Entities;

public class Produto : BaseEntity
{
    public string CodigoBarras { get; private set; } = string.Empty;
    public string Nome { get; private set; } = string.Empty;
    public decimal PrecoVenda { get; private set; }
    public decimal PrecoCusto { get; private set; }
    public decimal EstoqueAtual { get; private set; }
    public decimal EstoqueMinimo { get; private set; }
    public bool Ativo { get; private set; } = true;

    // Construtor protegido para EF Core
    protected Produto() { }

    public Produto(
        string codigoBarras,
        string nome,
        decimal precoVenda,
        decimal precoCusto = 0,
        decimal estoqueAtual = 0,
        decimal estoqueMinimo = 0)
    {
        if (string.IsNullOrWhiteSpace(codigoBarras))
            throw new DomainException("O código de barras do produto é obrigatório.");

        if (string.IsNullOrWhiteSpace(nome))
            throw new DomainException("O nome do produto é obrigatório.");

        if (precoVenda <= 0)
            throw new DomainException("O preço de venda deve ser maior que zero.");

        CodigoBarras = codigoBarras.Trim();
        Nome = nome.Trim();
        PrecoVenda = precoVenda;
        PrecoCusto = precoCusto;
        EstoqueAtual = estoqueAtual;
        EstoqueMinimo = estoqueMinimo;
        Ativo = true;
    }

    public void DebitarEstoque(decimal quantidade)
    {
        if (quantidade <= 0)
            throw new DomainException("A quantidade para débito de estoque deve ser maior que zero.");

        EstoqueAtual -= quantidade;
        RegistrarAtualizacao();
    }

    public void EstornarEstoque(decimal quantidade)
    {
        if (quantidade <= 0)
            throw new DomainException("A quantidade para estorno de estoque deve ser maior que zero.");

        EstoqueAtual += quantidade;
        RegistrarAtualizacao();
    }

    public void AtualizarPrecos(decimal precoVenda, decimal precoCusto)
    {
        if (precoVenda <= 0)
            throw new DomainException("O preço de venda deve ser maior que zero.");

        PrecoVenda = precoVenda;
        PrecoCusto = precoCusto;
        RegistrarAtualizacao();
    }

    public void AtualizarDados(string nome, decimal precoVenda, decimal precoCusto, decimal estoqueAtual, decimal estoqueMinimo)
    {
        if (string.IsNullOrWhiteSpace(nome))
            throw new DomainException("O nome do produto é obrigatório.");

        if (precoVenda <= 0)
            throw new DomainException("O preço de venda deve ser maior que zero.");

        Nome = nome.Trim();
        PrecoVenda = precoVenda;
        PrecoCusto = precoCusto;
        EstoqueAtual = estoqueAtual;
        EstoqueMinimo = estoqueMinimo;
        RegistrarAtualizacao();
    }

    public void AjustarEstoque(decimal novoEstoque)
    {
        EstoqueAtual = novoEstoque;
        RegistrarAtualizacao();
    }

    public void Desativar()
    {
        Ativo = false;
        RegistrarAtualizacao();
    }

    public void Ativar()
    {
        Ativo = true;
        RegistrarAtualizacao();
    }
}
