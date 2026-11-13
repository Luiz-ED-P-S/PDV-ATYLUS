using PDV.API.Security;
using PDV.Application.Commands.Auth;

namespace PDV.API.Middlewares;

/// <summary>
/// Enquanto o operador estiver com PIN temporário (de fábrica ou trivial), a API só aceita o necessário para
/// trocá-lo: ver a própria sessão (GET auth/me) e alterar o PIN (POST auth/alterar-pin). Todo o resto responde 403.
/// A marca vem de uma claim assinada no JWT (emitida no login, a partir do PIN informado); não depende do frontend
/// nem do localStorage e é descartada quando o PIN é trocado (o token antigo deixa de valer e um novo é emitido).
/// </summary>
public class PinTemporarioMiddleware
{
    public const string Codigo = "PIN_TEMPORARIO";
    public const string Mensagem = "Troque o PIN temporário para continuar usando o sistema.";

    private readonly RequestDelegate _next;

    public PinTemporarioMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, OpcoesSeguranca opcoes)
    {
        if (opcoes.ExigirTrocaPinTemporario &&
            context.User.Identity?.IsAuthenticated == true &&
            context.User.TemPinTemporario() &&
            context.Request.Path.StartsWithSegments("/api") &&
            !PermitidoComPinTemporario(context.Request))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new { codigo = Codigo, mensagem = Mensagem });
            return;
        }

        await _next(context);
    }

    private static bool PermitidoComPinTemporario(HttpRequest requisicao)
    {
        var caminho = requisicao.Path.Value?.TrimEnd('/') ?? string.Empty;
        return (HttpMethods.IsGet(requisicao.Method) && caminho.Equals("/api/v1/auth/me", StringComparison.OrdinalIgnoreCase)) ||
               (HttpMethods.IsPost(requisicao.Method) && caminho.Equals("/api/v1/auth/alterar-pin", StringComparison.OrdinalIgnoreCase));
    }
}
