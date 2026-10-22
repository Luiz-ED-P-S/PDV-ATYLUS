using MediatR;
using PDV.Application.DTOs;
using PDV.Domain.Interfaces;

namespace PDV.Application.Queries.Produtos;

public record ObterProdutosQuery(string? Termo = null) : IRequest<List<ProdutoDto>>;

public class ObterProdutosQueryHandler : IRequestHandler<ObterProdutosQuery, List<ProdutoDto>>
{
    private readonly IProdutoRepository _produtoRepository;

    public ObterProdutosQueryHandler(IProdutoRepository produtoRepository)
    {
        _produtoRepository = produtoRepository;
    }

    public async Task<List<ProdutoDto>> Handle(ObterProdutosQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Termo))
        {
            var produtos = await _produtoRepository.ObterTodosAsync(cancellationToken);
            return produtos.Select(ProdutoDto.FromEntity).ToList();
        }

        var filtrados = await _produtoRepository.BuscarPorNomeOuCodigoAsync(request.Termo, cancellationToken);
        return filtrados.Select(ProdutoDto.FromEntity).ToList();
    }
}

public record ObterProdutoPorCodigoBarrasQuery(string CodigoBarras) : IRequest<ProdutoDto?>;

public class ObterProdutoPorCodigoBarrasQueryHandler : IRequestHandler<ObterProdutoPorCodigoBarrasQuery, ProdutoDto?>
{
    private readonly IProdutoRepository _produtoRepository;

    public ObterProdutoPorCodigoBarrasQueryHandler(IProdutoRepository produtoRepository)
    {
        _produtoRepository = produtoRepository;
    }

    public async Task<ProdutoDto?> Handle(ObterProdutoPorCodigoBarrasQuery request, CancellationToken cancellationToken)
    {
        var produto = await _produtoRepository.ObterPorCodigoBarrasAsync(request.CodigoBarras, cancellationToken);
        return produto == null ? null : ProdutoDto.FromEntity(produto);
    }
}
