using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PDV.Domain.Entities;
using PDV.Domain.Enums;
using PDV.Domain.Interfaces;

namespace PDV.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IOperadorRepository _operadorRepository;
    private readonly ITokenService _tokenService;

    public AuthController(IOperadorRepository operadorRepository, ITokenService tokenService)
    {
        _operadorRepository = operadorRepository;
        _tokenService = tokenService;
    }

    public record LoginRequest(string Matricula, string Pin);
    public record ValidarSupervisorRequest(string Pin, string? Matricula = null);

    /// <summary>
    /// Realiza a autenticação de operador de caixa via Matrícula e PIN com hash BCrypt e emite token JWT assinado.
    /// </summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Matricula) || string.IsNullOrWhiteSpace(request.Pin))
        {
            return BadRequest(new { mensagem = "Matrícula e PIN são obrigatórios." });
        }

        var operador = await _operadorRepository.ObterPorMatriculaAsync(request.Matricula, cancellationToken);
        if (operador == null)
        {
            return Unauthorized(new { mensagem = "Operador não encontrado ou inativo." });
        }

        if (!operador.ValidarPin(request.Pin))
        {
            return Unauthorized(new { mensagem = "PIN de segurança incorreto." });
        }

        var token = _tokenService.GerarToken(operador);

        return Ok(new
        {
            token,
            expiraEmHoras = 12,
            operador = new
            {
                id = operador.Id,
                matricula = operador.Matricula,
                nome = operador.Nome,
                perfil = operador.Perfil.ToString()
            }
        });
    }

    /// <summary>
    /// Valida credenciais de supervisor para autorização de operações protegidas (sangria, cancelamento de item/venda).
    /// </summary>
    [HttpPost("validar-supervisor")]
    public async Task<IActionResult> ValidarSupervisor([FromBody] ValidarSupervisorRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Pin))
        {
            return BadRequest(new { valido = false, mensagem = "O PIN do supervisor é obrigatório." });
        }

        var supervisores = await _operadorRepository.ObterSupervisoresAtivosAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(request.Matricula))
        {
            supervisores = supervisores.Where(s => s.Matricula.Equals(request.Matricula.Trim(), StringComparison.OrdinalIgnoreCase)).ToList();
        }

        foreach (var supervisor in supervisores)
        {
            if (supervisor.ValidarPin(request.Pin))
            {
                return Ok(new
                {
                    valido = true,
                    supervisorId = supervisor.Id,
                    supervisorNome = supervisor.Nome,
                    matricula = supervisor.Matricula
                });
            }
        }

        return Unauthorized(new { valido = false, mensagem = "PIN de supervisor inválido ou não autorizado." });
    }

    /// <summary>
    /// Retorna as informações do operador autenticado no token JWT.
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> ObterOperadorLogado(CancellationToken cancellationToken)
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(idClaim) || !Guid.TryParse(idClaim, out var operadorId))
        {
            return Unauthorized();
        }

        var operador = await _operadorRepository.ObterPorIdAsync(operadorId, cancellationToken);
        if (operador == null || !operador.Ativo)
        {
            return Unauthorized(new { mensagem = "Operador inativo ou inexistente." });
        }

        return Ok(new
        {
            id = operador.Id,
            matricula = operador.Matricula,
            nome = operador.Nome,
            perfil = operador.Perfil.ToString()
        });
    }

    /// <summary>
    /// Retorna a lista de operadores ativos para seleção rápida na tela de login/caixa (sem expor PINs).
    /// </summary>
    [HttpGet("operadores")]
    public async Task<IActionResult> ListarOperadores(CancellationToken cancellationToken)
    {
        var todos = await _operadorRepository.ObterTodosAsync(cancellationToken);
        var lista = todos
            .Where(o => o.Ativo)
            .Select(o => new
            {
                id = o.Id,
                matricula = o.Matricula,
                nome = o.Nome,
                perfil = o.Perfil.ToString()
            })
            .OrderBy(o => o.nome)
            .ToList();

        return Ok(lista);
    }
}
