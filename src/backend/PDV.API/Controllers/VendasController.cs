using MediatR;
using Microsoft.AspNetCore.Mvc;
using PDV.Application.Commands.Vendas;
using PDV.Application.DTOs;

namespace PDV.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class VendasController : ControllerBase
{
    private readonly IMediator _mediator;

    public VendasController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost]
    public async Task<ActionResult<VendaDto>> CriarVenda([FromBody] CriarVendaCommand command)
    {
        var venda = await _mediator.Send(command);
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
