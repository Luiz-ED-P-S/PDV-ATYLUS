using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PDV.API.Security;
using PDV.Application.Commands.Auth;

namespace PDV.API.Controllers;

/// <summary>
/// Autenticação local (offline) de operadores por matrícula + PIN, com emissão de JWT.
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class AuthController : ControllerBase
{
    private const string MensagemCredenciaisInvalidas = "Matrícula ou PIN inválidos.";

    private readonly IMediator _mediator;
    private readonly JwtTokenService _tokenService;
    private readonly LoginAttemptLimiter _limiter;

    public AuthController(IMediator mediator, JwtTokenService tokenService, LoginAttemptLimiter limiter)
    {
        _mediator = mediator;
        _tokenService = tokenService;
        _limiter = limiter;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var matricula = (request.Matricula ?? string.Empty).Trim().ToUpperInvariant();
        var chave = $"login:{matricula}";

        if (_limiter.TempoRestanteBloqueio(chave) is { } restante)
            return Bloqueado(restante);

        var operador = await _mediator.Send(new AutenticarOperadorCommand(matricula, request.Pin ?? string.Empty), cancellationToken);
        if (operador == null)
        {
            _limiter.RegistrarFalha(chave);
            return Unauthorized(new { mensagem = MensagemCredenciaisInvalidas });
        }

        _limiter.RegistrarSucesso(chave);
        var (token, expiraEm) = _tokenService.GerarToken(operador);
        return Ok(new LoginResponse(token, expiraEm, OperadorResponse.De(operador)));
    }

    [HttpGet("me")]
    public ActionResult<OperadorResponse> Me()
    {
        var id = User.ObterOperadorId();
        if (id == null) return Unauthorized();

        return Ok(new OperadorResponse(
            id.Value,
            User.Identity?.Name ?? string.Empty,
            User.ObterMatricula() ?? string.Empty,
            User.IsInRole(Perfis.Supervisor) ? Perfis.Supervisor : Perfis.Operador,
            false));
    }

    /// <summary>
    /// Autorização pontual: um supervisor digita o PIN no terminal de um operador.
    /// Não emite token; apenas confirma se o PIN pertence a um supervisor ativo.
    /// </summary>
    [HttpPost("autorizar-supervisor")]
    public async Task<ActionResult> AutorizarSupervisor([FromBody] AutorizarSupervisorRequest request, CancellationToken cancellationToken)
    {
        var chave = $"supervisor:{User.ObterOperadorId()}";
        if (_limiter.TempoRestanteBloqueio(chave) is { } restante)
            return Bloqueado(restante);

        var supervisor = await _mediator.Send(new ValidarPinSupervisorCommand(request.Pin ?? string.Empty), cancellationToken);
        if (supervisor == null)
        {
            _limiter.RegistrarFalha(chave);
            return Unauthorized(new { mensagem = "PIN de supervisor inválido." });
        }

        _limiter.RegistrarSucesso(chave);
        return Ok(new { autorizado = true, supervisor = supervisor.Nome, matricula = supervisor.Matricula });
    }

    [HttpPost("alterar-pin")]
    public async Task<ActionResult> AlterarPin([FromBody] AlterarPinRequest request, CancellationToken cancellationToken)
    {
        var id = User.ObterOperadorId();
        if (id == null) return Unauthorized();

        var chave = $"alterar-pin:{id}";
        if (_limiter.TempoRestanteBloqueio(chave) is { } restante)
            return Bloqueado(restante);

        var ok = await _mediator.Send(new AlterarPinCommand(id.Value, request.PinAtual ?? string.Empty, request.NovoPin ?? string.Empty), cancellationToken);
        if (!ok)
        {
            _limiter.RegistrarFalha(chave);
            return BadRequest(new { mensagem = "PIN atual incorreto." });
        }

        _limiter.RegistrarSucesso(chave);
        return Ok(new { mensagem = "PIN alterado com sucesso." });
    }

    private ObjectResult Bloqueado(TimeSpan restante)
    {
        var segundos = (int)Math.Ceiling(restante.TotalSeconds);
        Response.Headers.RetryAfter = segundos.ToString();
        return StatusCode(StatusCodes.Status429TooManyRequests, new
        {
            mensagem = $"Muitas tentativas inválidas. Tente novamente em {Math.Max(1, (int)Math.Ceiling(restante.TotalMinutes))} minuto(s)."
        });
    }
}

public record LoginRequest(string? Matricula, string? Pin);
public record AutorizarSupervisorRequest(string? Pin);
public record AlterarPinRequest(string? PinAtual, string? NovoPin);

public record OperadorResponse(Guid Id, string Nome, string Matricula, string Perfil, bool UsaPinPadrao)
{
    public static OperadorResponse De(OperadorAutenticadoDto dto) =>
        new(dto.Id, dto.Nome, dto.Matricula, dto.Perfil.ToString(), dto.UsaPinPadrao);
}

public record LoginResponse(string Token, DateTime ExpiraEm, OperadorResponse Operador);
