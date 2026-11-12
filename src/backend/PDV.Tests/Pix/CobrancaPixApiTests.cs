using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PDV.Domain.Enums;
using PDV.Infrastructure.Context;
using PDV.Tests.Infra;

namespace PDV.Tests.Pix;

/// <summary>
/// Cobranças Pix persistidas, confirmação manual por Supervisor e vínculo transacional com a venda,
/// sobre um SQLite TEMPORÁRIO próprio (ambiente Testing, simulação explicitamente autorizada).
/// </summary>
[Collection(PixCollection.Nome)]
public class CobrancaPixApiTests
{
    private const string CodigoCoca = "7894900010015"; // carga inicial: 9,50 (custo 6,00)

    private readonly PdvApiFactory _factory;

    public CobrancaPixApiTests(PdvApiFactory factory)
    {
        _factory = factory;
    }

    // ---------- Criação ----------

    [Fact]
    public async Task GerarCobranca_PersisteComIdentificadorUnicoEStatusPendente()
    {
        using var api = await ClienteOperadorComCaixaAberto();

        var a = await Gerar(api, 9.50m);
        var b = await Gerar(api, 9.50m);

        Assert.Equal("Pendente", a.Status);
        Assert.NotEqual(a.TxId, b.TxId);
        Assert.True(a.Simulada);                                     // Testing + simulação autorizada
        Assert.NotNull(a.QrCodeBase64);
        Assert.Equal("Pendente", (await Status(api, a.TxId)).Status);

        var gravada = await Ler(a.TxId);
        Assert.Equal(StatusCobrancaPix.Pendente, gravada.Status);
        Assert.Equal(9.50m, gravada.Valor);
        Assert.Equal("OP01", gravada.OperadorMatricula);              // do token, não do corpo
        Assert.Null(gravada.MetodoConfirmacao);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task GerarCobranca_ValorInvalido_Recusado(decimal valor)
    {
        using var api = await ClienteOperadorComCaixaAberto();
        var resp = await api.PostAsJsonAsync("/api/v1/payments/pix/generate", new { valor, descricao = "x" });
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    // ---------- Confirmação manual ----------

    [Fact]
    public async Task ConfirmacaoManual_SupervisorValido_RegistraAuditoriaComoManual()
    {
        using var api = await ClienteOperadorComCaixaAberto();
        var cobranca = await Gerar(api, 9.50m);

        var resp = await api.PostAsJsonAsync($"/api/v1/payments/pix/{cobranca.TxId}/confirmar-manual",
            new { supervisorMatricula = "ger01", supervisorPin = "1234", observacao = "Conferido no app do banco" });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var corpo = (await resp.Content.ReadFromJsonAsync<CobrancaBody>())!;
        Assert.Equal("Confirmada", corpo.Status);
        Assert.Equal("ManualSupervisor", corpo.MetodoConfirmacao);
        Assert.True(corpo.ConfirmacaoManual);
        Assert.Equal("GER01", corpo.SupervisorMatricula);
        Assert.DoesNotContain("1234", await Mensagem(resp));

        var gravada = await Ler(cobranca.TxId);
        Assert.Equal(MetodoConfirmacaoPix.ManualSupervisor, gravada.MetodoConfirmacao);
        Assert.NotNull(gravada.SupervisorId);
        Assert.Equal("GER01", gravada.SupervisorMatricula);
        Assert.NotNull(gravada.ConfirmadoEm);
        Assert.Equal("Conferido no app do banco", gravada.ObservacaoConfirmacao);
    }

    [Theory]
    [InlineData("GER01", "9999")]   // PIN errado
    [InlineData("OP01", "0000")]    // credenciais válidas, mas não é Supervisor
    [InlineData("NAOEXISTE", "1234")]
    [InlineData("", "")]
    public async Task ConfirmacaoManual_Invalida_Recusada_ECobrancaContinuaPendente(string matricula, string pin)
    {
        using var api = await ClienteOperadorComCaixaAberto();
        var cobranca = await Gerar(api, 9.50m);

        var resp = await api.PostAsJsonAsync($"/api/v1/payments/pix/{cobranca.TxId}/confirmar-manual",
            new { supervisorMatricula = matricula, supervisorPin = pin });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);   // 400 (não 401): a sessão do operador continua
        Assert.Contains("Supervisor inválidos", await Mensagem(resp));
        Assert.Equal(StatusCobrancaPix.Pendente, (await Ler(cobranca.TxId)).Status);
        Assert.Equal(HttpStatusCode.OK, (await api.GetAsync("/api/v1/auth/me")).StatusCode);
    }

    [Fact]
    public async Task ConfirmacaoManual_SemLogin_Retorna401()
    {
        using var anonimo = _factory.CreateClient();
        var resp = await anonimo.PostAsJsonAsync("/api/v1/payments/pix/QUALQUER/confirmar-manual",
            new { supervisorMatricula = "GER01", supervisorPin = "1234" });
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task ConfirmacaoDuplicada_Recusada()
    {
        using var api = await ClienteOperadorComCaixaAberto();
        var cobranca = await Gerar(api, 9.50m);
        Assert.Equal(HttpStatusCode.OK, (await ConfirmarManual(api, cobranca.TxId)).StatusCode);

        var segunda = await ConfirmarManual(api, cobranca.TxId);
        var simulacao = await api.PostAsync($"/api/v1/payments/pix/simulate-payment/{cobranca.TxId}", null);

        Assert.Equal(HttpStatusCode.Conflict, segunda.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, simulacao.StatusCode);
        Assert.Equal("GER01", (await Ler(cobranca.TxId)).SupervisorMatricula);
    }

    // ---------- Venda ----------

    [Fact]
    public async Task VendaComPixNaoConfirmado_ERecusada_SemAlterarEstoque()
    {
        using var api = await ClienteOperadorComCaixaAberto();
        var coca = await Produto(api);
        var cobranca = await Gerar(api, 9.50m);

        var resp = await Vender(api, coca.Id, Pix(9.50m, cobranca.TxId));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Contains("ainda não teve o recebimento confirmado", await Mensagem(resp));
        Assert.Equal(coca.EstoqueAtual, (await Produto(api)).EstoqueAtual);
        Assert.Equal(StatusCobrancaPix.Pendente, (await Ler(cobranca.TxId)).Status);
    }

    public static IEnumerable<object?[]> PixDeclaradosPeloCliente() => new List<object?[]>
    {
        new object?[] { "sem cobrança", null, "Pagamento Pix sem cobrança" },
        new object?[] { "txid inventado", "PIX-INVENTADO-PELO-FRONT", "não encontrada" },
    };

    [Theory]
    [MemberData(nameof(PixDeclaradosPeloCliente))]
    public async Task ApiNaoAceitaPixApenasDeclaradoPeloCliente(string caso, string? txId, string mensagem)
    {
        Assert.NotNull(caso);
        using var api = await ClienteOperadorComCaixaAberto();
        var coca = await Produto(api);

        var resp = await Vender(api, coca.Id, Pix(9.50m, txId));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Contains(mensagem, await Mensagem(resp));
        Assert.Equal(coca.EstoqueAtual, (await Produto(api)).EstoqueAtual);
    }

    [Fact]
    public async Task VendaComPixConfirmado_ValorDiferenteOuComTroco_Recusada()
    {
        using var api = await ClienteOperadorComCaixaAberto();
        var coca = await Produto(api);
        var cobranca = await Gerar(api, 9.50m);
        await ConfirmarManual(api, cobranca.TxId);

        var valorMenor = await Vender(api, coca.Id, Pix(5.00m, cobranca.TxId), Dinheiro(4.50m));
        var comTroco = await Vender(api, coca.Id, new { formaPagamento = "Pix", valor = 9.50m, troco = 0.50m, txId = cobranca.TxId });

        Assert.Equal(HttpStatusCode.BadRequest, valorMenor.StatusCode);
        Assert.Contains("diferente do valor da cobrança", await Mensagem(valorMenor));
        Assert.Equal(HttpStatusCode.BadRequest, comTroco.StatusCode);
        Assert.Equal(StatusCobrancaPix.Confirmada, (await Ler(cobranca.TxId)).Status);  // continua disponível
    }

    [Fact]
    public async Task VendaComPixConfirmado_Conclui_EVinculaCobranca_ENaoPermiteReutilizar()
    {
        using var api = await ClienteOperadorComCaixaAberto();
        var coca = await Produto(api);
        var cobranca = await Gerar(api, 9.50m);
        await ConfirmarManual(api, cobranca.TxId);

        var primeira = await Vender(api, coca.Id, Pix(9.50m, cobranca.TxId));
        Assert.Equal(HttpStatusCode.OK, primeira.StatusCode);
        var venda = (await primeira.Content.ReadFromJsonAsync<VendaBody>())!;

        var reutilizacao = await Vender(api, coca.Id, Pix(9.50m, cobranca.TxId));
        Assert.Equal(HttpStatusCode.Conflict, reutilizacao.StatusCode);
        Assert.Contains("já foi utilizada", await Mensagem(reutilizacao));

        var gravada = await Ler(cobranca.TxId);
        Assert.Equal(StatusCobrancaPix.Utilizada, gravada.Status);
        Assert.Equal(venda.Id, gravada.VendaId);
        Assert.NotNull(gravada.UtilizadoEm);
        Assert.Equal(coca.EstoqueAtual - 1, (await Produto(api)).EstoqueAtual);         // só a primeira debitou
        Assert.Equal(HttpStatusCode.Conflict, (await ConfirmarManual(api, cobranca.TxId)).StatusCode);
    }

    [Fact]
    public async Task MesmaCobrancaInformadaDuasVezesNaVenda_Recusada()
    {
        using var api = await ClienteOperadorComCaixaAberto();
        var coca = await Produto(api);
        var cobranca = await Gerar(api, 4.75m);
        await ConfirmarManual(api, cobranca.TxId);

        var resp = await Vender(api, coca.Id, Pix(4.75m, cobranca.TxId), Pix(4.75m, cobranca.TxId));

        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
        Assert.Equal(StatusCobrancaPix.Confirmada, (await Ler(cobranca.TxId)).Status);
    }

    [Fact]
    public async Task DuasVendasSimultaneas_ComAMesmaCobranca_ApenasUmaConclui()
    {
        using var api1 = await ClienteOperadorComCaixaAberto();
        using var api2 = _factory.CriarClienteAutenticado(await _factory.ObterTokenAsync("GER01", "1234"));
        var coca = await Produto(api1);
        var cobranca = await Gerar(api1, 9.50m);
        await ConfirmarManual(api1, cobranca.TxId);

        var respostas = await Task.WhenAll(
            Task.Run(() => Vender(api1, coca.Id, Pix(9.50m, cobranca.TxId))),
            Task.Run(() => Vender(api2, coca.Id, Pix(9.50m, cobranca.TxId))));

        Assert.Single(respostas, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(respostas, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(coca.EstoqueAtual - 1, (await Produto(api1)).EstoqueAtual);
        Assert.Equal(StatusCobrancaPix.Utilizada, (await Ler(cobranca.TxId)).Status);
    }

    // ---------- Simulação (Testing) e regressão ----------

    [Fact]
    public async Task SimulacaoEmTesting_Permitida_EConfirmadaPeloBackend()
    {
        using var api = await ClienteOperadorComCaixaAberto();
        var recursos = (await api.GetFromJsonAsync<RecursosBody>("/api/v1/sistema/recursos"))!;
        Assert.True(recursos.PixSimulacaoHabilitada);

        var cobranca = await Gerar(api, 9.50m);
        var resp = await api.PostAsync($"/api/v1/payments/pix/simulate-payment/{cobranca.TxId}", null);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var corpo = (await resp.Content.ReadFromJsonAsync<CobrancaBody>())!;
        Assert.Equal("Confirmada", corpo.Status);
        Assert.Equal("Simulacao", corpo.MetodoConfirmacao);
        Assert.False(corpo.ConfirmacaoManual);
    }

    [Fact]
    public async Task VendasEmDinheiroECartao_ContinuamFuncionando()
    {
        using var api = await ClienteOperadorComCaixaAberto();
        var coca = await Produto(api);

        var dinheiro = await Vender(api, coca.Id, Dinheiro(10m, troco: 0.50m));
        var cartao = await Vender(api, coca.Id, new { formaPagamento = "CartaoCredito", valor = 9.50m, troco = 0m, txId = (string?)null });
        var misto = await Vender(api, coca.Id, new { formaPagamento = "CartaoDebito", valor = 5m, troco = 0m, txId = (string?)null }, Dinheiro(5m, troco: 0.50m));

        Assert.Equal(HttpStatusCode.OK, dinheiro.StatusCode);
        Assert.Equal(HttpStatusCode.OK, cartao.StatusCode);
        Assert.Equal(HttpStatusCode.OK, misto.StatusCode);
    }

    // ---------- utilitários ----------

    private async Task<HttpClient> ClienteOperadorComCaixaAberto()
    {
        var api = _factory.CriarClienteAutenticado(await _factory.ObterTokenAsync("OP01", "0000"));
        var atual = await api.GetAsync("/api/v1/caixa/atual");
        var corpo = await atual.Content.ReadAsStringAsync();
        if (atual.StatusCode == HttpStatusCode.NoContent || string.IsNullOrWhiteSpace(corpo) || corpo == "null")
            (await api.PostAsJsonAsync("/api/v1/caixa/abrir", new { operadorId = "OP01", saldoInicial = 50m })).EnsureSuccessStatusCode();
        return api;
    }

    private static async Task<CobrancaBody> Gerar(HttpClient api, decimal valor)
    {
        var resp = await api.PostAsJsonAsync("/api/v1/payments/pix/generate", new { valor, descricao = "Teste" });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<CobrancaBody>())!;
    }

    private static async Task<CobrancaBody> Status(HttpClient api, string txId) =>
        (await api.GetFromJsonAsync<CobrancaBody>($"/api/v1/payments/pix/status/{txId}"))!;

    private static Task<HttpResponseMessage> ConfirmarManual(HttpClient api, string txId) =>
        api.PostAsJsonAsync($"/api/v1/payments/pix/{txId}/confirmar-manual", new { supervisorMatricula = "GER01", supervisorPin = "1234" });

    private static async Task<ProdutoBody> Produto(HttpClient api) =>
        (await api.GetFromJsonAsync<ProdutoBody>($"/api/v1/produtos/codigo/{CodigoCoca}"))!;

    /// <summary>Lê o campo "mensagem" do JSON de erro (acentos podem vir escapados no texto bruto).</summary>
    private static async Task<string> Mensagem(HttpResponseMessage resp)
    {
        var json = System.Text.Json.JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        return json.RootElement.TryGetProperty("mensagem", out var m) ? m.GetString() ?? "" : json.RootElement.ToString();
    }

    private static object Pix(decimal valor, string? txId) => new { formaPagamento = "Pix", valor, troco = 0m, txId };
    private static object Dinheiro(decimal valor, decimal troco = 0m) => new { formaPagamento = "Dinheiro", valor, troco, txId = (string?)null };

    private static Task<HttpResponseMessage> Vender(HttpClient api, Guid produtoId, params object[] pagamentos)
    {
        var total = 9.50m;
        return api.PostAsJsonAsync("/api/v1/vendas", new
        {
            operadorId = "IGNORADO",
            desconto = 0m,
            itens = new[] { new { produtoId, quantidade = 1m, precoUnitario = total } },
            pagamentos
        });
    }

    private async Task<PDV.Domain.Entities.CobrancaPix> Ler(string txId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PdvDbContext>();
        return await db.CobrancasPix.AsNoTracking().SingleAsync(c => c.TxId == txId);
    }

    private record CobrancaBody(string TxId, decimal Valor, string Status, bool Simulada, string? QrCodeBase64, string? Instrucoes,
        string? MetodoConfirmacao, string? SupervisorMatricula, bool ConfirmacaoManual);
    private record ProdutoBody(Guid Id, decimal EstoqueAtual);
    private record VendaBody(Guid Id);
    private record RecursosBody(bool PixSimulacaoHabilitada, string PixProvedor);
}
