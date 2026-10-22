using Microsoft.AspNetCore.Mvc;
using PDV.Domain.Interfaces;

namespace PDV.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly IPixService _pixService;

    public PaymentsController(IPixService pixService)
    {
        _pixService = pixService;
    }

    [HttpPost("pix/generate")]
    public async Task<ActionResult<PixResult>> GerarPix([FromBody] GerarPixRequest request)
    {
        if (request.Valor <= 0)
            return BadRequest(new { message = "O valor do Pix deve ser maior que zero." });

        var pix = await _pixService.GerarQrCodeAsync(request.Valor, request.Descricao ?? "Venda PDV Atylus");
        return Ok(pix);
    }

    [HttpGet("pix/status/{txid}")]
    public async Task<ActionResult<PixStatusResult>> ConsultarStatusPix(string txid)
    {
        var status = await _pixService.ConsultarStatusAsync(txid);
        return Ok(status);
    }

    [HttpPost("pix/simulate-payment/{txid}")]
    public async Task<ActionResult> SimularPagamentoPix(string txid)
    {
        await _pixService.SimularPagamentoAsync(txid);
        return Ok(new { message = $"Pagamento simulado com sucesso para o TxId: {txid}" });
    }
}

public record GerarPixRequest(decimal Valor, string? Descricao);
