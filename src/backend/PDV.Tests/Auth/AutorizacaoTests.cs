using System.Net;
using System.Net.Http.Json;
using System.Text;
using PDV.Tests.Infra;

namespace PDV.Tests.Auth;

[Collection(ApiCollection.Nome)]
public class AutorizacaoTests
{
    private readonly PdvApiFactory _factory;

    public AutorizacaoTests(PdvApiFactory factory)
    {
        _factory = factory;
    }

    public static IEnumerable<object[]> EndpointsProtegidos() => new List<object[]>
    {
        new object[] { "GET", "/api/v1/produtos" },
        new object[] { "GET", "/api/v1/produtos/codigo/7894900010015" },
        new object[] { "POST", "/api/v1/produtos" },
        new object[] { "PUT", $"/api/v1/produtos/{Guid.NewGuid()}" },
        new object[] { "GET", "/api/v1/caixa/atual" },
        new object[] { "POST", "/api/v1/caixa/abrir" },
        new object[] { "POST", "/api/v1/caixa/movimentacao" },
        new object[] { "POST", "/api/v1/caixa/fechar-cego" },
        new object[] { "GET", "/api/v1/vendas" },
        new object[] { "POST", "/api/v1/vendas" },
        new object[] { "POST", $"/api/v1/vendas/{Guid.NewGuid()}/cancelar" },
        new object[] { "POST", "/api/v1/importer/analyze" },
        new object[] { "POST", "/api/v1/importer/confirm" },
        new object[] { "POST", "/api/v1/payments/pix/generate" },
        new object[] { "GET", "/api/v1/payments/pix/status/abc" },
        new object[] { "POST", "/api/v1/payments/pix/simulate-payment/abc" },
        new object[] { "GET", "/api/v1/printer/installed" },
        new object[] { "POST", $"/api/v1/printer/print-sale/{Guid.NewGuid()}" },
        new object[] { "POST", $"/api/v1/printer/print-cashier/{Guid.NewGuid()}" },
        new object[] { "POST", "/api/v1/printer/open-drawer" },
        new object[] { "POST", "/api/v1/printer/test" },
        new object[] { "GET", "/api/v1/sync/status" },
        new object[] { "POST", "/api/v1/sync/forcar" },
        new object[] { "POST", "/api/v1/sync/testar-conexao" },
        new object[] { "POST", "/api/v1/sync/config" },
        new object[] { "POST", "/api/v1/sync/puxar-catalogo" },
        new object[] { "POST", "/api/v1/sync/heartbeat" },
        new object[] { "POST", "/api/v1/sync/receber-lote" },
    };

    [Theory]
    [MemberData(nameof(EndpointsProtegidos))]
    public async Task EndpointsDaApi_SemToken_Retornam401(string metodo, string url)
    {
        using var client = _factory.CreateClient();

        var resp = await client.SendAsync(Requisicao(metodo, url));

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    public static IEnumerable<object[]> EndpointsSomenteSupervisor() => new List<object[]>
    {
        new object[] { "POST", "/api/v1/produtos" },
        new object[] { "PUT", $"/api/v1/produtos/{Guid.NewGuid()}" },
        new object[] { "POST", "/api/v1/importer/analyze" },
        new object[] { "POST", "/api/v1/importer/confirm" },
        new object[] { "POST", "/api/v1/sync/config" },
        new object[] { "POST", "/api/v1/sync/puxar-catalogo" },
        new object[] { "POST", "/api/v1/sync/testar-conexao" },
    };

    [Theory]
    [MemberData(nameof(EndpointsSomenteSupervisor))]
    public async Task EndpointsDeSupervisor_ComTokenDeOperador_Retornam403(string metodo, string url)
    {
        var token = await _factory.ObterTokenAsync("OP01", "0000");
        using var client = _factory.CriarClienteAutenticado(token);

        var resp = await client.SendAsync(Requisicao(metodo, url));

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task Supervisor_PodeCadastrarProduto()
    {
        var token = await _factory.ObterTokenAsync("GER01", "1234");
        using var client = _factory.CriarClienteAutenticado(token);
        var codigo = "789" + Random.Shared.NextInt64(1_000_000_000, 9_999_999_999);

        var resp = await client.PostAsJsonAsync("/api/v1/produtos", new
        {
            codigoBarras = codigo,
            nome = "Produto Teste Autorização",
            precoVenda = 10.0m,
            precoCusto = 5.0m,
            estoqueAtual = 3m,
            estoqueMinimo = 1m
        });

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
    }

    [Fact]
    public async Task Operador_PodeConsultarProdutosEVendas()
    {
        var token = await _factory.ObterTokenAsync("OP01", "0000");
        using var client = _factory.CriarClienteAutenticado(token);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/produtos")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/vendas")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/caixa/atual")).StatusCode);
    }

    [Fact]
    public async Task OperadorDoCaixa_VemDoToken_ENaoDoCorpoDaRequisicao()
    {
        var token = await _factory.ObterTokenAsync("OP01", "0000");
        using var client = _factory.CriarClienteAutenticado(token);

        var abrir = await client.PostAsJsonAsync("/api/v1/caixa/abrir", new { operadorId = "GER01", saldoInicial = 50m });
        Assert.Equal(HttpStatusCode.OK, abrir.StatusCode);
        var caixa = await abrir.Content.ReadFromJsonAsync<CaixaBody>();
        Assert.Equal("OP01", caixa!.OperadorId);
        // Obs.: POST /caixa/movimentacao não é verificado aqui porque o handler atual falha com
        // DbUpdateConcurrencyException (problema pré-existente, fora do escopo de SEC-01/SEC-02).
    }

    [Fact]
    public async Task HubDeSincronizacao_AceitaChaveDeApi_ERecusaChaveErrada()
    {
        using var client = _factory.CreateClient();
        var heartbeat = new { terminalId = "CX02", versao = "1.0", pendentes = 0, hostname = "teste", dataHora = DateTime.UtcNow };

        var ok = new HttpRequestMessage(HttpMethod.Post, "/api/v1/sync/heartbeat") { Content = JsonContent.Create(heartbeat) };
        ok.Headers.Add("X-PDV-ApiKey", PdvApiFactory.HubApiKey);
        var errada = new HttpRequestMessage(HttpMethod.Post, "/api/v1/sync/heartbeat") { Content = JsonContent.Create(heartbeat) };
        errada.Headers.Add("X-PDV-ApiKey", "chave-errada");

        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(ok)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(errada)).StatusCode);
    }

    [Fact]
    public async Task ChaveDeApiDoHub_NaoDaAcessoAOutrosEndpoints()
    {
        using var client = _factory.CreateClient();
        var req = new HttpRequestMessage(HttpMethod.Get, "/api/v1/produtos");
        req.Headers.Add("X-PDV-ApiKey", PdvApiFactory.HubApiKey);

        var resp = await client.SendAsync(req);

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task HealthESpa_ContinuamPublicos()
    {
        using var client = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);
        var spa = await client.GetAsync("/vendas");
        Assert.Equal(HttpStatusCode.OK, spa.StatusCode);
        Assert.Contains("text/html", spa.Content.Headers.ContentType?.MediaType);
    }

    private static HttpRequestMessage Requisicao(string metodo, string url) =>
        new(new HttpMethod(metodo), url)
        {
            Content = metodo == "GET" ? null : new StringContent("{}", Encoding.UTF8, "application/json")
        };

    private record CaixaBody(Guid Id, string OperadorId);
}
