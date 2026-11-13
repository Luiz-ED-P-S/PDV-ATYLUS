using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using PDV.API.Security;
using PDV.Infrastructure.Context;
using PDV.Tests.Infra;

namespace PDV.Tests.Auth;

/// <summary>
/// Tokens deixam de valer quando o operador é desativado ou troca o PIN, mesmo antes de expirar.
/// </summary>
[Collection(ApiCollection.Nome)]
public class InvalidacaoSessaoTests
{
    private readonly PdvApiFactory _factory;

    public InvalidacaoSessaoTests(PdvApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task TrocaDePin_InvalidaTokensAnteriores_EDevolveNovoTokenValido()
    {
        var antigo = await _factory.ObterTokenAsync(PdvApiFactory.MatriculaTrocaPin, PdvApiFactory.PinExtras);
        var outroTerminal = await _factory.ObterTokenAsync(PdvApiFactory.MatriculaTrocaPin, PdvApiFactory.PinExtras);
        using var clienteAntigo = _factory.CriarClienteAutenticado(antigo);
        Assert.Equal(HttpStatusCode.OK, (await clienteAntigo.GetAsync("/api/v1/auth/me")).StatusCode);

        var troca = await clienteAntigo.PostAsJsonAsync("/api/v1/auth/alterar-pin", new { pinAtual = PdvApiFactory.PinExtras, novoPin = "7531", confirmacaoNovoPin = "7531" });
        Assert.Equal(HttpStatusCode.OK, troca.StatusCode);
        var novo = (await troca.Content.ReadFromJsonAsync<PdvApiFactory.LoginBody>())!;
        Assert.False(string.IsNullOrWhiteSpace(novo.Token));
        Assert.DoesNotContain("estadoSeguranca", await troca.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

        // Token usado na troca e token de outro terminal: ambos recusados
        Assert.Equal(HttpStatusCode.Unauthorized, (await clienteAntigo.GetAsync("/api/v1/auth/me")).StatusCode);
        using var clienteOutro = _factory.CriarClienteAutenticado(outroTerminal);
        Assert.Equal(HttpStatusCode.Unauthorized, (await clienteOutro.GetAsync("/api/v1/produtos")).StatusCode);

        // Novo token emitido na troca continua a sessão
        using var clienteNovo = _factory.CriarClienteAutenticado(novo.Token);
        Assert.Equal(HttpStatusCode.OK, (await clienteNovo.GetAsync("/api/v1/auth/me")).StatusCode);
    }

    [Fact]
    public async Task OperadorDesativado_TemTokenRecusado_ENaoConsegueNovoLogin()
    {
        var token = await _factory.ObterTokenAsync(PdvApiFactory.MatriculaDesativar, PdvApiFactory.PinExtras);
        using var cliente = _factory.CriarClienteAutenticado(token);
        Assert.Equal(HttpStatusCode.OK, (await cliente.GetAsync("/api/v1/auth/me")).StatusCode);

        // Não existe tela de desativação; simula a alteração direta no SQLite TEMPORÁRIO do teste
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PdvDbContext>();
            var linhas = await db.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE Operadores SET Ativo = 0 WHERE Matricula = {PdvApiFactory.MatriculaDesativar}");
            Assert.Equal(1, linhas);
        }

        Assert.Equal(HttpStatusCode.Unauthorized, (await cliente.GetAsync("/api/v1/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await cliente.GetAsync("/api/v1/produtos")).StatusCode);

        using var anonimo = _factory.CreateClient();
        var login = await anonimo.PostAsJsonAsync("/api/v1/auth/login", new { matricula = PdvApiFactory.MatriculaDesativar, pin = PdvApiFactory.PinExtras });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    [Fact]
    public async Task TokenAssinadoCorretamente_SemCarimbo_ERecusado()
    {
        var login = await _factory.LoginAsync("GER01", "1234");
        var token = CriarToken(login.Operador.Id, carimbo: null);
        using var cliente = _factory.CriarClienteAutenticado(token);

        Assert.Equal(HttpStatusCode.Unauthorized, (await cliente.GetAsync("/api/v1/auth/me")).StatusCode);
    }

    [Fact]
    public async Task TokenAssinadoCorretamente_ComCarimboForjado_ERecusado()
    {
        var login = await _factory.LoginAsync("GER01", "1234");
        var token = CriarToken(login.Operador.Id, carimbo: Base64UrlEncoder.Encode(new byte[16]));
        using var cliente = _factory.CriarClienteAutenticado(token);

        Assert.Equal(HttpStatusCode.Unauthorized, (await cliente.GetAsync("/api/v1/auth/me")).StatusCode);
    }

    [Fact]
    public async Task TokenDeOperadorInexistente_ERecusado()
    {
        _ = await _factory.LoginAsync("OP01", "0000");
        var token = CriarToken(Guid.NewGuid(), carimbo: Base64UrlEncoder.Encode(new byte[16]));
        using var cliente = _factory.CriarClienteAutenticado(token);

        Assert.Equal(HttpStatusCode.Unauthorized, (await cliente.GetAsync("/api/v1/produtos")).StatusCode);
    }

    [Fact]
    public async Task TokenValido_ContemCarimbo_MasNaoExpoeHashDoPin()
    {
        var login = await _factory.LoginAsync("OP01", "0000");
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(login.Token);

        var carimbo = jwt.Claims.Single(c => c.Type == JwtOptions.ClaimCarimbo).Value;
        Assert.Equal(22, carimbo.Length); // 128 bits em Base64Url
        Assert.DoesNotContain(jwt.Claims, c => c.Value.StartsWith("$2"));
    }

    private string CriarToken(Guid operadorId, string? carimbo)
    {
        var chave = _factory.Services.GetRequiredService<JwtOptions>().ChaveAssinatura;
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, operadorId.ToString()),
            new(ClaimTypes.Name, "Teste"),
            new(PdvClaims.Matricula, "GER01"),
            new(ClaimTypes.Role, Perfis.Supervisor)
        };
        if (carimbo != null) claims.Add(new Claim(JwtOptions.ClaimCarimbo, carimbo));

        var token = new JwtSecurityToken(JwtOptions.Issuer, JwtOptions.Audience, claims,
            DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddHours(1),
            new SigningCredentials(chave, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
