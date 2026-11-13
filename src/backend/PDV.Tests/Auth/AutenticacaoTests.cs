using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using PDV.API.Security;
using PDV.Tests.Infra;

namespace PDV.Tests.Auth;

[Collection(ApiCollection.Nome)]
public class AutenticacaoTests
{
    private readonly PdvApiFactory _factory;

    public AutenticacaoTests(PdvApiFactory factory)
    {
        _factory = factory;
    }

    [Theory]
    [InlineData("GER01", "1234", "Supervisor")]
    [InlineData("OP01", "0000", "Operador")]
    [InlineData("op01", "0000", "Operador")] // matrícula normalizada para maiúsculas
    public async Task Login_ComCredenciaisValidas_RetornaTokenComPerfilDoBanco(string matricula, string pin, string perfilEsperado)
    {
        using var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/v1/auth/login", new { matricula, pin });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<PdvApiFactory.LoginBody>();
        Assert.False(string.IsNullOrWhiteSpace(body!.Token));
        Assert.Equal(perfilEsperado, body.Operador.Perfil);
        Assert.Equal(matricula.ToUpperInvariant(), body.Operador.Matricula);
        Assert.True(body.Operador.UsaPinPadrao);
        Assert.True(body.ExpiraEm > DateTime.UtcNow);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(body.Token);
        Assert.Contains(jwt.Claims, c => c.Type == ClaimTypes.Role && c.Value == perfilEsperado);
    }

    [Theory]
    [InlineData("GER01", "9999")]
    [InlineData("OP01", "1234")]   // PIN de outro operador
    [InlineData("NAOEXISTE", "1234")]
    [InlineData("OP01", "")]
    [InlineData("", "0000")]
    public async Task Login_ComCredenciaisInvalidas_Retorna401SemRevelarMotivo(string matricula, string pin)
    {
        using var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/v1/auth/login", new { matricula, pin });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
        var texto = await resp.Content.ReadAsStringAsync();
        Assert.Contains("Matrícula ou PIN inválidos", texto);
        Assert.DoesNotContain("token", texto, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Login_AposVariasFalhas_BloqueiaTemporariamenteCom429()
    {
        using var client = _factory.CreateClient();
        var matricula = "BLOQ" + Guid.NewGuid().ToString("N")[..6];

        for (var i = 0; i < 5; i++)
        {
            var falha = await client.PostAsJsonAsync("/api/v1/auth/login", new { matricula, pin = "0000" });
            Assert.Equal(HttpStatusCode.Unauthorized, falha.StatusCode);
        }

        var bloqueado = await client.PostAsJsonAsync("/api/v1/auth/login", new { matricula, pin = "0000" });
        Assert.Equal((HttpStatusCode)429, bloqueado.StatusCode);
        Assert.True(bloqueado.Headers.Contains("Retry-After"));
    }

    [Fact]
    public async Task Me_SemToken_Retorna401()
    {
        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Me_ComToken_RetornaOperadorDoToken()
    {
        var token = await _factory.ObterTokenAsync("OP01", "0000");
        using var client = _factory.CriarClienteAutenticado(token);

        var resp = await client.GetAsync("/api/v1/auth/me");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<PdvApiFactory.OperadorBody>();
        Assert.Equal("OP01", body!.Matricula);
        Assert.Equal("Operador", body.Perfil);
    }

    [Fact]
    public async Task Token_AssinadoComOutraChave_ERejeitado()
    {
        var chaveFalsa = new SymmetricSecurityKey(RandomNumberGenerator.GetBytes(64));
        var token = CriarToken(chaveFalsa, DateTime.UtcNow.AddHours(1), "Supervisor");
        using var client = _factory.CriarClienteAutenticado(token);

        var resp = await client.GetAsync("/api/v1/produtos");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Token_Expirado_ERejeitado()
    {
        _ = _factory.CreateClient(); // garante host iniciado
        var chave = _factory.Services.GetRequiredService<JwtOptions>().ChaveAssinatura;
        var token = CriarToken(chave, DateTime.UtcNow.AddMinutes(-10), "Supervisor", DateTime.UtcNow.AddHours(-2));
        using var client = _factory.CriarClienteAutenticado(token);

        var resp = await client.GetAsync("/api/v1/produtos");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Token_ComPayloadAdulterado_ERejeitado()
    {
        var token = await _factory.ObterTokenAsync("OP01", "0000");
        var partes = token.Split('.');
        var payload = Base64UrlEncoder.Decode(partes[1]).Replace("\"Operador\"", "\"Supervisor\"");
        var adulterado = $"{partes[0]}.{Base64UrlEncoder.Encode(payload)}.{partes[2]}";
        using var client = _factory.CriarClienteAutenticado(adulterado);

        var resp = await client.PostAsJsonAsync("/api/v1/produtos", new { });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task AutorizarSupervisor_ValidaPinNoBanco()
    {
        var token = await _factory.ObterTokenAsync("OP01", "0000");
        using var client = _factory.CriarClienteAutenticado(token);

        var ok = await client.PostAsJsonAsync("/api/v1/auth/autorizar-supervisor", new { pin = "1234" });
        var erroPinOperador = await client.PostAsJsonAsync("/api/v1/auth/autorizar-supervisor", new { pin = "0000" });

        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, erroPinOperador.StatusCode);
    }

    [Fact]
    public async Task AutorizarSupervisor_SemToken_Retorna401()
    {
        using var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/v1/auth/autorizar-supervisor", new { pin = "1234" });
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task AlterarPin_TrocaHashNoBanco_EInvalidaPinAntigo()
    {
        var token = await _factory.ObterTokenAsync(PdvApiFactory.MatriculaTeste, PdvApiFactory.PinTeste);
        using var autenticado = _factory.CriarClienteAutenticado(token);
        using var anonimo = _factory.CreateClient();

        var errado = await autenticado.PostAsJsonAsync("/api/v1/auth/alterar-pin", new { pinAtual = "0000", novoPin = "4321" });
        Assert.Equal(HttpStatusCode.BadRequest, errado.StatusCode);

        var curto = await autenticado.PostAsJsonAsync("/api/v1/auth/alterar-pin", new { pinAtual = PdvApiFactory.PinTeste, novoPin = "12" });
        Assert.Equal(HttpStatusCode.BadRequest, curto.StatusCode);

        var ok = await autenticado.PostAsJsonAsync("/api/v1/auth/alterar-pin", new { pinAtual = PdvApiFactory.PinTeste, novoPin = "8642" });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);

        var loginAntigo = await anonimo.PostAsJsonAsync("/api/v1/auth/login", new { matricula = PdvApiFactory.MatriculaTeste, pin = PdvApiFactory.PinTeste });
        var loginNovo = await anonimo.PostAsJsonAsync("/api/v1/auth/login", new { matricula = PdvApiFactory.MatriculaTeste, pin = "8642" });
        Assert.Equal(HttpStatusCode.Unauthorized, loginAntigo.StatusCode);
        Assert.Equal(HttpStatusCode.OK, loginNovo.StatusCode);
        var body = await loginNovo.Content.ReadFromJsonAsync<PdvApiFactory.LoginBody>();
        Assert.False(body!.Operador.UsaPinPadrao);
    }

    private static string CriarToken(SecurityKey chave, DateTime expira, string perfil, DateTime? notBefore = null)
    {
        var token = new JwtSecurityToken(
            issuer: JwtOptions.Issuer,
            audience: JwtOptions.Audience,
            claims: new[]
            {
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.Name, "Invasor"),
                new Claim(PdvClaims.Matricula, "HACK"),
                new Claim(ClaimTypes.Role, perfil)
            },
            notBefore: notBefore ?? DateTime.UtcNow.AddMinutes(-1),
            expires: expira,
            signingCredentials: new SigningCredentials(chave, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
