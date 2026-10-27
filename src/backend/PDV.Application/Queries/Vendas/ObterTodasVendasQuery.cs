using MediatR;
using PDV.Application.DTOs;
using PDV.Domain.Interfaces;

namespace PDV.Application.Queries.Vendas;

public record ObterTodasVendasQuery : IRequest<List<VendaDto>>;

public class ObterTodasVendasQueryHandler : IRequestHandler<ObterTodasVendasQuery, List<VendaDto>>
{
    private readonly IVendaRepository _vendaRepository;

    public ObterTodasVendasQueryHandler(IVendaRepository vendaRepository)
    {
        _vendaRepository = vendaRepository;
    }

    public async Task<List<VendaDto>> Handle(ObterTodasVendasQuery request, CancellationToken cancellationToken)
    {
        var vendas = await _vendaRepository.ObterTodasVendasAsync(cancellationToken);
        return vendas.Select(VendaDto.FromEntity).ToList();
    }
}
