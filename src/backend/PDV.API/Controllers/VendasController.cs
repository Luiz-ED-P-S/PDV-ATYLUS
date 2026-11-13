using Microsoft.AspNetCore.Authorization;
using PDV.API.Security;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using PDV.Application.Commands.Vendas;
using PDV.Application.DTOs;
using PDV.Application.Queries.Vendas;

namespace PDV.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class VendasController : ControllerBase
{
    private readonly IMediator _mediator;

    public VendasController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<VendaDto>>> ObterTodasVendas()
    {
        var vendas = await _mediator.Send(new ObterTodasVendasQuery());
        return Ok(vendas);
    }

    [HttpPost]
    public async Task<ActionResult<VendaDto>> CriarVenda([FromBody] CriarVendaCommand command)
    {
        // O operador da venda é sempre o do token, nunca o informado pelo cliente
        var venda = await _mediator.Send(command with { OperadorId = User.ObterMatricula()! });
        return Ok(venda);
    }

    [HttpPost("{id}/cancelar")]
    public async Task<ActionResult> CancelarVenda(Guid id, [FromBody] CancelarVendaRequest request)
    {
        await _mediator.Send(new CancelarVendaCommand(id, request.Motivo, request.SupervisorPin));
        return Ok(new { message = "Venda cancelada com sucesso e estoque estornado." });
    }
}

public record CancelarVendaRequest(string Motivo, string SupervisorPin);
