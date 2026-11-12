using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PDV.API.Security;
using PDV.Application.Commands.Pix;

namespace PDV.API.Controllers;

/// <summary>
/// Cobranças Pix persistidas. O frontend nunca declara um Pix como pago: a confirmação vem da simulação
/// (somente Development/Testing autorizados), de um Supervisor (manual) ou, no futuro, de um provedor real.
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class PaymentsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly OpcoesPix _opcoesPix;
    private readonly LoginAttemptLimiter _limiter;

    public PaymentsController(IMediator mediator, OpcoesPix opcoesPix, LoginAttemptLimiter limiter)
    {
        _mediator = mediator;
        _opcoesPix = opcoesPix;
        _limiter = limiter;
    }

    [HttpPost("pix/generate")]
    public async Task<ActionResult<CobrancaPixDto>> GerarPix([FromBody] GerarPixRequest request, CancellationToken cancellationToken)
    {
        if (request.Valor <= 0)
            return BadRequest(new { mensagem = "O valor do Pix deve ser maior que zero." });

        var cobranca = await _mediator.Send(new GerarCobrancaPixCommand(
            request.Valor, request.Descricao, User.ObterMatricula()!, request.TerminalId), cancellationToken);
        return Ok(cobranca);
    }

    [HttpGet("pix/status/{txid}")]
    public async Task<ActionResult<CobrancaPixDto>> ConsultarStatusPix(string txid, CancellationToken cancellationToken)
    {
        var cobranca = await _mediator.Send(new ObterCobrancaPixQuery(txid), cancellationToken);
        return cobranca == null ? NotFound(new { mensagem = "Cobrança Pix não encontrada." }) : Ok(cobranca);
    }

    /// <summary>Simulação de pagamento: inexistente (404) fora de Development/Testing explicitamente autorizados.</summary>
    [HttpPost("pix/simulate-payment/{txid}")]
    public async Task<ActionResult<CobrancaPixDto>> SimularPagamentoPix(string txid, CancellationToken cancellationToken)
    {
        if (!_opcoesPix.PermitirSimulacao)
            return NotFound(new { mensagem = "Simulação de Pix indisponível neste ambiente." });

        return Ok(await _mediator.Send(new SimularPagamentoPixCommand(txid), cancellationToken));
    }

    /// <summary>
    /// Confirmação MANUAL do recebimento (não bancária): exige matrícula e PIN de um Supervisor ativo,
    /// validados no servidor, com limite de tentativas. O PIN nunca é registrado em log.
    /// </summary>
    [HttpPost("pix/{txid}/confirmar-manual")]
    public async Task<ActionResult<CobrancaPixDto>> ConfirmarManual(string txid, [FromBody] ConfirmarPixManualRequest request, CancellationToken cancellationToken)
    {
        var chave = $"pix-supervisor:{User.ObterOperadorId()}";
        if (_limiter.TempoRestanteBloqueio(chave) is { } restante)
        {
            Response.Headers.RetryAfter = ((int)Math.Ceiling(restante.TotalSeconds)).ToString();
            return StatusCode(StatusCodes.Status429TooManyRequests,
                new { mensagem = $"Muitas tentativas inválidas. Tente novamente em {Math.Max(1, (int)Math.Ceiling(restante.TotalMinutes))} minuto(s)." });
        }

        var resultado = await _mediator.Send(new ConfirmarPixManualCommand(
            txid, request.SupervisorMatricula ?? string.Empty, request.SupervisorPin ?? string.Empty, request.Observacao), cancellationToken);

        if (!resultado.SupervisorAutorizado)
        {
            _limiter.RegistrarFalha(chave);
            // 400 (e não 401) para não encerrar a sessão do operador que está no caixa
            return BadRequest(new { mensagem = "Matrícula ou PIN de Supervisor inválidos." });
        }

        _limiter.RegistrarSucesso(chave);
        return Ok(resultado.Cobranca);
    }
}

public record GerarPixRequest(decimal Valor, string? Descricao, string? TerminalId = null);
public record ConfirmarPixManualRequest(string? SupervisorMatricula, string? SupervisorPin, string? Observacao);
