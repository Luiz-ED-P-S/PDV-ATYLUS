using MediatR;
using PDV.Application.DTOs;
using PDV.Domain.Interfaces;

namespace PDV.Application.Queries.CaixaQueries;

public record ObterCaixaAtualQuery : IRequest<CaixaDto?>;

public class ObterCaixaAtualQueryHandler : IRequestHandler<ObterCaixaAtualQuery, CaixaDto?>
{
    private readonly ICaixaRepository _caixaRepository;

    public ObterCaixaAtualQueryHandler(ICaixaRepository caixaRepository)
    {
        _caixaRepository = caixaRepository;
    }

    public async Task<CaixaDto?> Handle(ObterCaixaAtualQuery request, CancellationToken cancellationToken)
    {
        var caixa = await _caixaRepository.ObterCaixaAbertoAsync(cancellationToken);
        return caixa == null ? null : CaixaDto.FromEntity(caixa);
    }
}
