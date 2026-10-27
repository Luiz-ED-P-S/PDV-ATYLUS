using FluentValidation;
using MediatR;
using PDV.Application.DTOs;
using PDV.Domain.Exceptions;
using PDV.Domain.Interfaces;

namespace PDV.Application.Commands.Produtos;

public record AtualizarProdutoCommand(
    Guid Id,
    string? Nome,
    decimal? PrecoVenda,
    decimal? PrecoCusto,
    decimal? EstoqueAtual,
    decimal? EstoqueMinimo) : IRequest<ProdutoDto>;

public class AtualizarProdutoCommandValidator : AbstractValidator<AtualizarProdutoCommand>
{
    public AtualizarProdutoCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("O ID do produto é obrigatório.");
        When(x => x.PrecoVenda.HasValue, () =>
        {
            RuleFor(x => x.PrecoVenda!.Value).GreaterThan(0).WithMessage("O preço de venda deve ser maior que zero.");
        });
        When(x => x.PrecoCusto.HasValue, () =>
        {
            RuleFor(x => x.PrecoCusto!.Value).GreaterThanOrEqualTo(0).WithMessage("O preço de custo não pode ser negativo.");
        });
        When(x => x.EstoqueMinimo.HasValue, () =>
        {
            RuleFor(x => x.EstoqueMinimo!.Value).GreaterThanOrEqualTo(0).WithMessage("O estoque mínimo não pode ser negativo.");
        });
    }
}

public class AtualizarProdutoCommandHandler : IRequestHandler<AtualizarProdutoCommand, ProdutoDto>
{
    private readonly IProdutoRepository _produtoRepository;
    private readonly IUnitOfWork _unitOfWork;

    public AtualizarProdutoCommandHandler(IProdutoRepository produtoRepository, IUnitOfWork unitOfWork)
    {
        _produtoRepository = produtoRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<ProdutoDto> Handle(AtualizarProdutoCommand request, CancellationToken cancellationToken)
    {
        var produto = await _produtoRepository.ObterPorIdAsync(request.Id, cancellationToken);
        if (produto == null)
            throw new DomainException($"Produto com ID '{request.Id}' não encontrado.");

        var nome = !string.IsNullOrWhiteSpace(request.Nome) ? request.Nome : produto.Nome;
        var precoVenda = request.PrecoVenda ?? produto.PrecoVenda;
        var precoCusto = request.PrecoCusto ?? produto.PrecoCusto;
        var estoqueAtual = request.EstoqueAtual ?? produto.EstoqueAtual;
        var estoqueMinimo = request.EstoqueMinimo ?? produto.EstoqueMinimo;

        produto.AtualizarDados(nome, precoVenda, precoCusto, estoqueAtual, estoqueMinimo);

        await _produtoRepository.AtualizarAsync(produto, cancellationToken);
        await _unitOfWork.CommitAsync(cancellationToken);

        return ProdutoDto.FromEntity(produto);
    }
}
