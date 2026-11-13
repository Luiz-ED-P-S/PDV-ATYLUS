using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace PDV.API.Security;

/// <summary>
/// Autentica chamadas terminal → hub (endpoints /sync/heartbeat e /sync/receber-lote) pelo cabeçalho
/// "X-PDV-ApiKey", já enviado pelo CloudSyncService. A chave esperada vem de PDV_HUB_API_KEY ou
/// CloudSync:HubApiKey. Sem chave configurada, este esquema nunca autentica (somente JWT é aceito).
/// </summary>
public class SyncApiKeyAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string NomeEsquema = "SyncApiKey";
    public const string Header = "X-PDV-ApiKey";
    public const string PerfilTerminal = "TerminalSync";

    private readonly IConfiguration _configuration;

    public SyncApiKeyAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IConfiguration configuration)
        : base(options, logger, encoder)
    {
        _configuration = configuration;
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var esperada = Environment.GetEnvironmentVariable("PDV_HUB_API_KEY") ?? _configuration["CloudSync:HubApiKey"];
        if (string.IsNullOrWhiteSpace(esperada))
            return Task.FromResult(AuthenticateResult.NoResult());

        if (!Request.Headers.TryGetValue(Header, out var recebida) || string.IsNullOrWhiteSpace(recebida))
            return Task.FromResult(AuthenticateResult.NoResult());

        var ok = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(recebida.ToString()),
            Encoding.UTF8.GetBytes(esperada));

        if (!ok)
            return Task.FromResult(AuthenticateResult.Fail("Chave de sincronização inválida."));

        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.Name, "terminal-sync"),
            new Claim(ClaimTypes.Role, PerfilTerminal)
        }, NomeEsquema);

        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), NomeEsquema)));
    }
}
