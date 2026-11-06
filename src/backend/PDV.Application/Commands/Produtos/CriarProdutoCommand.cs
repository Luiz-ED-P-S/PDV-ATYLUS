using FluentValidation;
using MediatR;
using PDV.Application.DTOs;
using PDV.Domain.Entities;
using PDV.Domain.Exceptions;
using PDV.Domain.Interfaces;

namespace PDV.Application.Commands.Produtos;

public record CriarProdutoCommand(
    string CodigoBarras,
    string Nome,
    decimal PrecoVenda,
    decimal PrecoCusto,
    decimal EstoqueAtual,
    decimal EstoqueMinimo) : IRequest<ProdutoDto>;

public class CriarProdutoCommandValidator : AbstractValidator<CriarProdutoCommand>
{
    public CriarProdutoCommandValidator()
    {
        RuleFor(x => x.CodigoBarras).NotEmpty().WithMessage("O código de barras é obrigatório.");
        RuleFor(x => x.Nome).NotEmpty().WithMessage("O nome do produto é obrigatório.");
        RuleFor(x => x.PrecoVenda).GreaterThan(0).WithMessage("O preço de venda deve ser maior que zero.");
        RuleFor(x => x.PrecoCusto).GreaterThanOrEqualTo(0).WithMessage("O preço de custo não pode ser negativo.");
        RuleFor(x => x.PrecoCusto).LessThanOrEqualTo(x => x.PrecoVenda).WithMessage("Bloqueio de preço de custo elevado: O preço de custo não pode ser superior ao preço de venda.");
        RuleFor(x => x.EstoqueMinimo).GreaterThanOrEqualTo(0).WithMessage("O estoque mínimo não pode ser negativo.");
    }
}

public class CriarProdutoCommandHandler : IRequestHandler<CriarProdutoCommand, ProdutoDto>
{
    private readonly IProdutoRepository _produtoRepository;
    private readonly ICloudSyncService _cloudSyncService;
    private readonly IUnitOfWork _unitOfWork;

    public CriarProdutoCommandHandler(
        IProdutoRepository produtoRepository,
        ICloudSyncService cloudSyncService,
        IUnitOfWork unitOfWork)
    {
        _produtoRepository = produtoRepository;
        _cloudSyncService = cloudSyncService;
        _unitOfWork = unitOfWork;
    }

    public async Task<ProdutoDto> Handle(CriarProdutoCommand request, CancellationToken cancellationToken)
    {
        var existente = await _produtoRepository.ObterPorCodigoBarrasAsync(request.CodigoBarras, cancellationToken);
        if (existente != null)
            throw new DomainException($"Já existe um produto cadastrado com o código de barras '{request.CodigoBarras}'.");

        var produto = new Produto(
            request.CodigoBarras,
            request.Nome,
            request.PrecoVenda,
            request.PrecoCusto,
            request.EstoqueAtual,
            request.EstoqueMinimo);

        await _produtoRepository.AdicionarAsync(produto, cancellationToken);
        await _unitOfWork.CommitAsync(cancellationToken);

        var dto = ProdutoDto.FromEntity(produto);
        try
        {
            await _cloudSyncService.EnfileirarAsync("Produto", produto.Id, "Criar", dto, null, cancellationToken);
        }
        catch
        {
            // Standby local garantido
        }

        return dto;
    }
}
