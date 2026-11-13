using System.Security.Cryptography;
using System.Text;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using PDV.Application.Commands.Auth;

namespace PDV.API.Security;

/// <summary>
/// Validação adicional de cada token já autenticado (assinatura e validade conferidas pelo JwtBearer):
/// recusa tokens de operadores inexistentes ou desativados e tokens emitidos antes de troca de PIN/perfil.
/// Consulta somente o SQLite local — continua funcionando offline.
/// </summary>
public static class ValidadorSessaoOperador
{
    public static async Task ValidarAsync(TokenValidatedContext contexto)
    {
        var principal = contexto.Principal;
        var operadorId = principal?.ObterOperadorId();
        var carimboToken = principal?.FindFirst(JwtOptions.ClaimCarimbo)?.Value;

        if (operadorId == null || string.IsNullOrEmpty(carimboToken))
        {
            contexto.Fail("Sessão inválida: token sem vínculo com o operador.");
            return;
        }

        var servicos = contexto.HttpContext.RequestServices;
        var estadoAtual = await servicos.GetRequiredService<IMediator>()
            .Send(new ObterEstadoSegurancaOperadorQuery(operadorId.Value), contexto.HttpContext.RequestAborted);

        if (estadoAtual == null)
        {
            contexto.Fail("Sessão encerrada: operador inexistente ou desativado.");
            return;
        }

        var esperado = servicos.GetRequiredService<JwtOptions>().CalcularCarimbo(estadoAtual);
        if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(esperado), Encoding.UTF8.GetBytes(carimboToken)))
        {
            contexto.Fail("Sessão encerrada: credenciais do operador foram alteradas após a emissão do token.");
        }
    }
}
