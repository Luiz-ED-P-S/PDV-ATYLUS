using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PDV.Application.Commands.Pix;
using PDV.Domain.Interfaces;

namespace PDV.API.Controllers;

/// <summary>Recursos habilitados neste servidor (somente leitura; o cliente não consegue alterá-los).</summary>
[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class SistemaController : ControllerBase
{
    [HttpGet("recursos")]
    public ActionResult<RecursosSistemaResponse> Recursos([FromServices] OpcoesPix opcoesPix, [FromServices] IPixProvedor provedor) =>
        Ok(new RecursosSistemaResponse(opcoesPix.PermitirSimulacao, provedor.Nome, provedor.CobrancaBancaria, ConfirmacaoManualPix: true));
}

public record RecursosSistemaResponse(bool PixSimulacaoHabilitada, string PixProvedor, bool PixCobrancaBancaria, bool ConfirmacaoManualPix);
