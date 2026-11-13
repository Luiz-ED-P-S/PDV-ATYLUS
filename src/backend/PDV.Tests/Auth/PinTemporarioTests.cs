using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using PDV.Application.Commands.Auth;
using PDV.Tests.Infra;

namespace PDV.Tests.Auth;

/// <summary>Regras puras da política de PIN e da opção que liga/desliga a exigência (nunca desliga em Production).</summary>
public class PoliticaPinTests
{
    [Theory]
    [InlineData("0000", true)]
    [InlineData("1234", true)]
    [InlineData("1111", true)]
    [InlineData("4321", true)]
    [InlineData("5678", true)]
    [InlineData("7890", true)]
    [InlineData("1212", true)]
    [InlineData("123123", true)]
    [InlineData("8642", false)]
    [InlineData("7391", false)]
    [InlineData("1357", false)]
    [InlineData("2468", false)]
    [InlineData("582046", false)]
    public void PinTemporario_EhFabricaOuTrivial(string pin, bool esperado)
    {
        Assert.Equal(esperado, PoliticaPin.EhTemporario(pin));
    }

    [Theory]
    [InlineData("")]
    [InlineData("12")]
    [InlineData("abcd")]
    [InlineData("12a4")]
    [InlineData("123456789")]
    [InlineData("0000")]
    [InlineData("1234")]
    [InlineData("1111")]
    [InlineData("4321")]
    [InlineData("9876")]
    [InlineData("1212")]
    [InlineData("654321")]
    public void NovoPin_InvalidoOuTrivial_Recusado(string pin)
    {
        Assert.NotNull(PoliticaPin.Validar(pin));
    }

    [Theory]
    [InlineData("7391")]
    [InlineData("582046")]
    [InlineData("24680")]
    public void NovoPin_Forte_Aceito(string pin)
    {
        Assert.Null(PoliticaPin.Validar(pin));
    }

    [Theory]
    [InlineData("Production", false, true)]   // desligar não vale em Production
    [InlineData("Staging", false, true)]
    [InlineData("Production", null, true)]
    [InlineData("Development", null, true)]   // padrão: obrigatório
    [InlineData("Development", true, true)]
    [InlineData("Testing", false, false)]     // somente testes podem desligar
    [InlineData("Development", false, false)]
    public void ExigenciaDeTroca_SoPodeSerDesligadaEmDevelopmentOuTesting(string ambiente, bool? configurado, bool esperado)
    {
        Assert.Equal(esperado, OpcoesSeguranca.Para(ambiente, configurado).ExigirTrocaPinTemporario);
    }
}

/// <summary>Troca obrigatória de PIN temporário aplicada pela API (exigência ligada, como em Production).</summary>
public class PinTemporarioApiTests : IDisposable
{
    private readonly string _pasta = Path.Combine(Path.GetTempPath(), "pdv-pintemp-" + Guid.NewGuid().ToString("N"));
    private readonly List<IDisposable> _descartaveis = new();

    private PdvApiFactoryPersonalizada NovaFabrica()
    {
        var f = new PdvApiFactoryPersonalizada(_pasta, apagarAoDescartar: false, exigirTrocaPin: true);
        _descartaveis.Add(f);
        return f;
    }

    private HttpClient Cliente(PdvApiFactory f, string token)
    {
        var c = f.CriarClienteAutenticado(token);
        _descartaveis.Add(c);
        return c;
    }

    private record Erro(string? Codigo, string? Mensagem);
    private record MeBody(string Matricula, string Perfil, bool UsaPinPadrao);
    private record TrocaBody(string Mensagem, string Token, PdvApiFactory.OperadorBody Operador);

    private static object Troca(string atual, string novo, string? confirmacao = null) =>
        new { pinAtual = atual, novoPin = novo, confirmacaoNovoPin = confirmacao ?? novo };

    private static string DecodificarPayload(string jwt)
    {
        var p = jwt.Split('.')[1].Replace('-', '+').Replace('_', '/');
        p = p.PadRight(p.Length + (4 - p.Length % 4) % 4, '=');
        return Encoding.UTF8.GetString(Convert.FromBase64String(p));
    }

    // ---------- Identificação do PIN temporário ----------

    [Fact]
    public async Task Login_ComPinDeFabrica_PermiteEntrarMasMarcaPinTemporario()
    {
        var f = NovaFabrica();
        var op = await f.LoginAsync("OP01", "0000");
        var sup = await f.LoginAsync("GER01", "1234");

        Assert.True(op.Operador.UsaPinPadrao);
        Assert.True(sup.Operador.UsaPinPadrao);
        Assert.Contains("\"pin_temporario\":\"true\"", DecodificarPayload(op.Token));
    }

    // ---------- Bloqueio antes da troca (inclusive acessando a API diretamente) ----------

    [Fact]
    public async Task AntesDaTroca_ApiBloqueiaTudoExcetoMeEAlterarPin()
    {
        var f = NovaFabrica();
        using var api = Cliente(f, (await f.LoginAsync("OP01", "0000")).Token);

        foreach (var url in new[] { "/api/v1/produtos", "/api/v1/caixa/atual?operadorId=OP01", "/api/v1/vendas", "/api/v1/sistema/recursos" })
        {
            var r = await api.GetAsync(url);
            Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
            Assert.Equal("PIN_TEMPORARIO", (await r.Content.ReadFromJsonAsync<Erro>())!.Codigo);
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await api.PostAsJsonAsync("/api/v1/caixa/abrir", new { operadorId = "OP01", saldoInicial = 0m })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await api.PostAsJsonAsync("/api/v1/auth/autorizar-supervisor", new { pin = "1234" })).StatusCode);

        var me = await api.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        Assert.True((await me.Content.ReadFromJsonAsync<MeBody>())!.UsaPinPadrao);

        // sem token continua 401 (autenticação preservada); /health segue público
        using var anonimo = f.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonimo.GetAsync("/api/v1/produtos")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync("/health")).StatusCode);
    }

    [Fact]
    public async Task TokenAdulterado_SemMarcaDePinTemporario_E_Recusado()
    {
        var f = NovaFabrica();
        var token = (await f.LoginAsync("OP01", "0000")).Token;
        var partes = token.Split('.');
        var payload = DecodificarPayload(token).Replace(",\"pin_temporario\":\"true\"", "").Replace("\"pin_temporario\":\"true\",", "");
        Assert.DoesNotContain("pin_temporario", payload);
        var novoPayload = Convert.ToBase64String(Encoding.UTF8.GetBytes(payload)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var forjado = $"{partes[0]}.{novoPayload}.{partes[2]}";

        using var api = Cliente(f, forjado);
        Assert.Equal(HttpStatusCode.Unauthorized, (await api.GetAsync("/api/v1/produtos")).StatusCode);
    }

    // ---------- Validações da troca ----------

    [Fact]
    public async Task Troca_PinAtualIncorreto_ConfirmacaoDiferente_Trivial_E_ReusoDoInicial_SaoRecusados()
    {
        var f = NovaFabrica();
        using var api = Cliente(f, (await f.LoginAsync("OP01", "0000")).Token);

        var atualErrado = await api.PostAsJsonAsync("/api/v1/auth/alterar-pin", Troca("9999", "7391"));
        Assert.Equal(HttpStatusCode.BadRequest, atualErrado.StatusCode);

        var confirmacao = await api.PostAsJsonAsync("/api/v1/auth/alterar-pin", Troca("0000", "7391", "7392"));
        Assert.Equal(HttpStatusCode.BadRequest, confirmacao.StatusCode);
        Assert.Contains("confirmação", (await confirmacao.Content.ReadFromJsonAsync<Erro>())!.Mensagem);

        var semConfirmacao = await api.PostAsJsonAsync("/api/v1/auth/alterar-pin", new { pinAtual = "0000", novoPin = "7391" });
        Assert.Equal(HttpStatusCode.BadRequest, semConfirmacao.StatusCode);

        foreach (var ruim in new[] { "0000", "1234", "1111", "4321", "9876", "1212", "12", "abcd", "123456789" })
        {
            var r = await api.PostAsJsonAsync("/api/v1/auth/alterar-pin", Troca("0000", ruim));
            Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        }

        // nada mudou: o PIN de fábrica continua valendo e o terminal continua restrito
        Assert.Equal(HttpStatusCode.Forbidden, (await api.GetAsync("/api/v1/produtos")).StatusCode);
        Assert.True((await f.LoginAsync("OP01", "0000")).Operador.UsaPinPadrao);
    }

    [Fact]
    public async Task Supervisor_ReusoDoPinInicial1234_Recusado()
    {
        var f = NovaFabrica();
        using var api = Cliente(f, (await f.LoginAsync("GER01", "1234")).Token);
        var r = await api.PostAsJsonAsync("/api/v1/auth/alterar-pin", Troca("1234", "1234"));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        var r0 = await api.PostAsJsonAsync("/api/v1/auth/alterar-pin", Troca("1234", "0000"));
        Assert.Equal(HttpStatusCode.BadRequest, r0.StatusCode);
    }

    // ---------- Troca válida, novo token e login posterior ----------

    [Fact]
    public async Task TrocaValida_EmiteNovoToken_LiberaAcesso_E_InvalidaOAntigo()
    {
        var f = NovaFabrica();
        var antigo = (await f.LoginAsync("OP01", "0000")).Token;
        using var apiAntiga = Cliente(f, antigo);

        var r = await apiAntiga.PostAsJsonAsync("/api/v1/auth/alterar-pin", Troca("0000", "7391"));
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var corpo = (await r.Content.ReadFromJsonAsync<TrocaBody>())!;
        Assert.False(corpo.Operador.UsaPinPadrao);
        Assert.DoesNotContain("pin_temporario", DecodificarPayload(corpo.Token));

        using var api = Cliente(f, corpo.Token);
        Assert.Equal(HttpStatusCode.OK, (await api.GetAsync("/api/v1/produtos")).StatusCode);
        Assert.False((await (await api.GetAsync("/api/v1/auth/me")).Content.ReadFromJsonAsync<MeBody>())!.UsaPinPadrao);
        Assert.Equal(HttpStatusCode.Unauthorized, (await apiAntiga.GetAsync("/api/v1/produtos")).StatusCode);

        using var anonimo = f.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonimo.PostAsJsonAsync("/api/v1/auth/login", new { matricula = "OP01", pin = "0000" })).StatusCode);
        var novoLogin = await f.LoginAsync("OP01", "7391");
        Assert.False(novoLogin.Operador.UsaPinPadrao);
    }

    [Fact]
    public async Task TrocaContinuaValida_AposReiniciarAAplicacao()
    {
        string tokenNovo;
        using (var f1 = new PdvApiFactoryPersonalizada(_pasta, apagarAoDescartar: false, exigirTrocaPin: true))
        {
            using var api = f1.CriarClienteAutenticado((await f1.LoginAsync("OP01", "0000")).Token);
            var r = await api.PostAsJsonAsync("/api/v1/auth/alterar-pin", Troca("0000", "7391"));
            r.EnsureSuccessStatusCode();
            tokenNovo = (await r.Content.ReadFromJsonAsync<TrocaBody>())!.Token;
        }

        // "fechar e reabrir": nova instância sobre a mesma pasta de dados (mesmo SQLite e mesma chave JWT)
        using var f2 = new PdvApiFactoryPersonalizada(_pasta, apagarAoDescartar: false, exigirTrocaPin: true);
        var login = await f2.LoginAsync("OP01", "7391");
        Assert.False(login.Operador.UsaPinPadrao);
        using var api2 = f2.CriarClienteAutenticado(login.Token);
        Assert.Equal(HttpStatusCode.OK, (await api2.GetAsync("/api/v1/produtos")).StatusCode);
        using var apiSessaoAnterior = f2.CriarClienteAutenticado(tokenNovo);
        Assert.Equal(HttpStatusCode.OK, (await apiSessaoAnterior.GetAsync("/api/v1/produtos")).StatusCode);

        using var anonimo = f2.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonimo.PostAsJsonAsync("/api/v1/auth/login", new { matricula = "OP01", pin = "0000" })).StatusCode);
        // o outro operador, que não trocou, continua restrito
        using var apiGer = f2.CriarClienteAutenticado((await f2.LoginAsync("GER01", "1234")).Token);
        Assert.Equal(HttpStatusCode.Forbidden, (await apiGer.GetAsync("/api/v1/produtos")).StatusCode);
    }

    // ---------- Permissões preservadas ----------

    [Fact]
    public async Task Permissoes_OperadorNaoViraSupervisor_E_SupervisorMantemAcessoAposTroca()
    {
        var f = NovaFabrica();
        using var op = Cliente(f, await TrocarEObterToken(f, "OP01", "0000", "7391"));
        using var sup = Cliente(f, await TrocarEObterToken(f, "GER01", "1234", "5802"));

        var novoProduto = new { codigoBarras = "7890000000017", nome = "Produto de Teste", precoVenda = 5m, precoCusto = 2m, estoqueAtual = 10m, estoqueMinimo = 1m };
        Assert.Equal(HttpStatusCode.Forbidden, (await op.PostAsJsonAsync("/api/v1/produtos", novoProduto)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await sup.PostAsJsonAsync("/api/v1/produtos", novoProduto)).StatusCode);

        Assert.Equal("Operador", (await (await op.GetAsync("/api/v1/auth/me")).Content.ReadFromJsonAsync<MeBody>())!.Perfil);
        Assert.Equal("Supervisor", (await (await sup.GetAsync("/api/v1/auth/me")).Content.ReadFromJsonAsync<MeBody>())!.Perfil);

        // consulta de produtos continua liberada ao Operador
        Assert.Equal(HttpStatusCode.OK, (await op.GetAsync("/api/v1/produtos")).StatusCode);
    }

    private async Task<string> TrocarEObterToken(PdvApiFactory f, string matricula, string pinAtual, string novoPin)
    {
        using var api = f.CriarClienteAutenticado((await f.LoginAsync(matricula, pinAtual)).Token);
        var r = await api.PostAsJsonAsync("/api/v1/auth/alterar-pin", Troca(pinAtual, novoPin));
        r.EnsureSuccessStatusCode();
        return (await r.Content.ReadFromJsonAsync<TrocaBody>())!.Token;
    }

    // ---------- PIN de fábrica de Supervisor não autoriza operações ----------

    [Fact]
    public async Task SupervisorComPinDeFabrica_NaoAutoriza_ApenasDepoisDeTrocar()
    {
        var f = NovaFabrica();
        using var op = Cliente(f, await TrocarEObterToken(f, "OP01", "0000", "7391"));

        // GER01 ainda usa 1234: o PIN de fábrica não vale como autorização
        Assert.Equal(HttpStatusCode.Unauthorized, (await op.PostAsJsonAsync("/api/v1/auth/autorizar-supervisor", new { pin = "1234" })).StatusCode);

        (await op.PostAsJsonAsync("/api/v1/caixa/abrir", new { operadorId = "OP01", saldoInicial = 0m })).EnsureSuccessStatusCode();
        var gerar = await op.PostAsJsonAsync("/api/v1/payments/pix/generate", new { valor = 10m, descricao = "x" });
        gerar.EnsureSuccessStatusCode();
        var txId = (await gerar.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("txId").GetString();
        var recusada = await op.PostAsJsonAsync($"/api/v1/payments/pix/{txId}/confirmar-manual", new { supervisorMatricula = "GER01", supervisorPin = "1234" });
        Assert.Equal(HttpStatusCode.BadRequest, recusada.StatusCode);

        // depois de trocar o PIN, o supervisor autoriza normalmente
        await TrocarEObterToken(f, "GER01", "1234", "5802");
        Assert.Equal(HttpStatusCode.OK, (await op.PostAsJsonAsync("/api/v1/auth/autorizar-supervisor", new { pin = "5802" })).StatusCode);
        var ok = await op.PostAsJsonAsync($"/api/v1/payments/pix/{txId}/confirmar-manual", new { supervisorMatricula = "GER01", supervisorPin = "5802" });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
    }

    public void Dispose()
    {
        foreach (var d in _descartaveis) { try { d.Dispose(); } catch { /* melhor esforço */ } }
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        try { if (Directory.Exists(_pasta)) Directory.Delete(_pasta, recursive: true); } catch { /* temporário */ }
    }
}
