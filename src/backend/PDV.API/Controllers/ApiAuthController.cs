using Microsoft.AspNetCore.Mvc;
using PDV.Application.DTOs;
using PDV.Application.Interfaces;

namespace PDV.API.Controllers;

[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public class ApiAuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public ApiAuthController(IAuthService authService)
    {
        _authService = authService;
    }

    /// <summary>
    /// Cadastra um novo usuário, gera o hash BCrypt da senha e envia o código OTP de 6 dígitos por e-mail.
    /// </summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register([FromBody] RegisterRequestDto dto, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var resultado = await _authService.RegisterAsync(dto, cancellationToken);
        if (!resultado.Sucesso)
        {
            return Conflict(resultado);
        }

        return StatusCode(StatusCodes.Status201Created, resultado);
    }

    /// <summary>
    /// Valida o código numérico de 6 dígitos enviado por e-mail. Ativa a conta (IsVerified = true) se correto e não expirado.
    /// </summary>
    [HttpPost("verify")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Verify([FromBody] VerifyCodeRequestDto dto, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var resultado = await _authService.VerifyAsync(dto, cancellationToken);
        if (!resultado.Sucesso)
        {
            return BadRequest(resultado);
        }

        return Ok(resultado);
    }

    /// <summary>
    /// Autentica o usuário validando a senha com BCrypt. O login só é permitido se IsVerified for true.
    /// </summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto dto, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var resultado = await _authService.LoginAsync(dto, cancellationToken);
        if (!resultado.Sucesso)
        {
            return Unauthorized(resultado);
        }

        return Ok(resultado);
    }
}
