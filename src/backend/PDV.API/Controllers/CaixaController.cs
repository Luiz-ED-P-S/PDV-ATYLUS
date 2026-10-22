using MediatR;
using Microsoft.AspNetCore.Mvc;
using PDV.Application.Commands.CaixaCommands;
using PDV.Application.DTOs;
using PDV.Application.Queries.CaixaQueries;

namespace PDV.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class CaixaController : ControllerBase
{
    private readonly IMediator _mediator;

    public CaixaController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("atual")]
    public async Task<ActionResult<CaixaDto?>> ObterCaixaAtual()
    {
        var caixa = await _mediator.Send(new ObterCaixaAtualQuery());
        return Ok(caixa);
    }

    [HttpPost("abrir")]
    public async Task<ActionResult<CaixaDto>> AbrirCaixa([FromBody] AbrirCaixaCommand command)
    {
        var caixa = await _mediator.Send(command);
        return Ok(caixa);
    }

    [HttpPost("movimentacao")]
    public async Task<ActionResult<MovimentacaoCaixaDto>> RegistrarMovimentacao([FromBody] RegistrarMovimentacaoCommand command)
    {
        var movimentacao = await _mediator.Send(command);
        return Ok(movimentacao);
    }

    [HttpPost("fechar-cego")]
    public async Task<ActionResult<FechamentoCegoResultadoDto>> FecharCaixaCego([FromBody] FecharCaixaCegoCommand command)
    {
        var resultado = await _mediator.Send(command);
        return Ok(resultado);
    }
}
