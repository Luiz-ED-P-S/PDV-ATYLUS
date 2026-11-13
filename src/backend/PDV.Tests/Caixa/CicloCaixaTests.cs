using System.Net;
using System.Net.Http.Json;
using PDV.Tests.Infra;

namespace PDV.Tests.Caixa;

/// <summary>
/// Regressão do ciclo completo do caixa (abertura → suprimento → sangria → vendas → cancelamento → fechamento)
/// em um SQLite temporário exclusivo. Cobre o erro 500 (DbUpdateConcurrencyException) em sangria/suprimento.
/// </summary>
[Collection(CaixaCollection.Nome)]
public class CicloCaixaTests
{
    private const string CodigoCoca = "7894900010015"; // produto da carga inicial: venda 9,50 / custo 6,00 / estoque 50

    private readonly PdvApiFactory _factory;

    public CicloCaixaTests(PdvApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CicloCompleto_AberturaMovimentacoesVendasEFechamento_FuncionaEPersiste()
    {
        var tokenOperador = await _factory.ObterTokenAsync("OP01", "0000");
        using var api = _factory.CriarClienteAutenticado(tokenOperador);

        // 1) Abertura com saldo inicial (gera a movimentação de suprimento inicial)
        var abrir = await api.PostAsJsonAsync("/api/v1/caixa/abrir", new { operadorId = "OP01", saldoInicial = 100m });
        Assert.Equal(HttpStatusCode.OK, abrir.StatusCode);
        var caixa = (await abrir.Content.ReadFromJsonAsync<CaixaBody>())!;
        Assert.Equal("Aberto", caixa.Status);
        Assert.Single(caixa.Movimentacoes);

        // 2) Suprimento e 3) Sangria — antes da correção retornavam HTTP 500
        var suprimento = await Movimentar(api, caixa.Id, "Suprimento", 25m, "Reforço de troco");
        Assert.Equal(HttpStatusCode.OK, suprimento.StatusCode);
        var movSuprimento = (await suprimento.Content.ReadFromJsonAsync<MovimentacaoBody>())!;
        Assert.Equal("Suprimento", movSuprimento.Tipo);
        Assert.Equal(25m, movSuprimento.Valor);
        Assert.Equal("OP01", movSuprimento.OperadorId);

        var sangria = await Movimentar(api, caixa.Id, "Sangria", 30m, "Retirada para cofre");
        Assert.Equal(HttpStatusCode.OK, sangria.StatusCode);
        var movSangria = (await sangria.Content.ReadFromJsonAsync<MovimentacaoBody>())!;
        Assert.Equal("Sangria", movSangria.Tipo);
        Assert.NotEqual(movSuprimento.Id, movSangria.Id);

        // Persistência: as 3 movimentações foram gravadas (nova leitura do banco)
        var atual = (await api.GetFromJsonAsync<CaixaBody>("/api/v1/caixa/atual"))!;
        Assert.Equal(caixa.Id, atual.Id);
        Assert.Equal(3, atual.Movimentacoes.Count);
        Assert.Contains(atual.Movimentacoes, m => m.Id == movSuprimento.Id && m.Valor == 25m);
        Assert.Contains(atual.Movimentacoes, m => m.Id == movSangria.Id && m.Tipo == "Sangria" && m.Valor == 30m);

        // Validações de domínio continuam retornando 400 (e não 500)
        Assert.Equal(HttpStatusCode.BadRequest, (await Movimentar(api, caixa.Id, "Sangria", 0m, "valor zero")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Movimentar(api, Guid.NewGuid(), "Sangria", 5m, "caixa inexistente")).StatusCode);

        // 4) Venda em dinheiro com troco: 2 x 9,50 = 19,00, pago 20,00, troco 1,00
        var coca = (await api.GetFromJsonAsync<ProdutoBody>($"/api/v1/produtos/codigo/{CodigoCoca}"))!;
        var estoqueInicial = coca.EstoqueAtual;
        var venda = await CriarVenda(api, coca.Id, 2m, 9.50m, pago: 20m, troco: 1m);
        Assert.Equal(HttpStatusCode.OK, venda.StatusCode);
        var vendaBody = (await venda.Content.ReadFromJsonAsync<VendaBody>())!;
        Assert.Equal(19m, vendaBody.ValorLiquido);
        Assert.Equal("Concluida", vendaBody.Status);
        Assert.Equal("OP01", vendaBody.OperadorId);
        Assert.Equal(estoqueInicial - 2m, (await api.GetFromJsonAsync<ProdutoBody>($"/api/v1/produtos/codigo/{CodigoCoca}"))!.EstoqueAtual);

        // 5) Segunda venda cancelada com PIN de supervisor: estoque é estornado e não entra no fechamento
        var vendaCancelar = (await (await CriarVenda(api, coca.Id, 1m, 9.50m, pago: 9.50m, troco: 0m)).Content.ReadFromJsonAsync<VendaBody>())!;
        var cancelar = await api.PostAsJsonAsync($"/api/v1/vendas/{vendaCancelar.Id}/cancelar", new { motivo = "Teste de regressão", supervisorPin = "1234" });
        Assert.Equal(HttpStatusCode.OK, cancelar.StatusCode);
        Assert.Equal(estoqueInicial - 2m, (await api.GetFromJsonAsync<ProdutoBody>($"/api/v1/produtos/codigo/{CodigoCoca}"))!.EstoqueAtual);
        var vendas = (await api.GetFromJsonAsync<List<VendaBody>>("/api/v1/vendas"))!;
        Assert.Contains(vendas, v => v.Id == vendaCancelar.Id && v.Status == "Cancelada");
        Assert.Contains(vendas, v => v.Id == vendaBody.Id && v.Status == "Concluida");

        // 6) Fechamento cego: esperado = suprimentos (100 + 25) − sangria (30) + dinheiro líquido (20 − 1) = 114
        var fechar = await api.PostAsJsonAsync("/api/v1/caixa/fechar-cego", new { caixaId = caixa.Id, saldoInformado = 114m, observacoes = "ok" });
        Assert.Equal(HttpStatusCode.OK, fechar.StatusCode);
        var fechamento = (await fechar.Content.ReadFromJsonAsync<FechamentoBody>())!;
        Assert.Equal(114m, fechamento.SaldoEsperadoSistema);
        Assert.Equal(0m, fechamento.Diferenca);
        Assert.Equal(125m, fechamento.TotalSuprimentos);
        Assert.Equal(30m, fechamento.TotalSangrias);
        Assert.Equal(19m, fechamento.TotalVendasDinheiro);

        // 7) Caixa fechado: movimentação e venda são recusadas com 400; não há caixa aberto
        Assert.Equal(HttpStatusCode.BadRequest, (await Movimentar(api, caixa.Id, "Suprimento", 10m, "após fechamento")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await CriarVenda(api, coca.Id, 1m, 9.50m, pago: 10m, troco: 0.5m)).StatusCode);
        var semCaixa = await api.GetAsync("/api/v1/caixa/atual");
        Assert.True(semCaixa.StatusCode is HttpStatusCode.OK or HttpStatusCode.NoContent);
        Assert.True(semCaixa.StatusCode == HttpStatusCode.NoContent || (await semCaixa.Content.ReadAsStringAsync()) is "" or "null");

        // 8) Um novo caixa pode ser aberto e movimentado normalmente
        var reabrir = await api.PostAsJsonAsync("/api/v1/caixa/abrir", new { operadorId = "OP01", saldoInicial = 0m });
        Assert.Equal(HttpStatusCode.OK, reabrir.StatusCode);
        var novoCaixa = (await reabrir.Content.ReadFromJsonAsync<CaixaBody>())!;
        Assert.NotEqual(caixa.Id, novoCaixa.Id);
        Assert.Empty(novoCaixa.Movimentacoes);
        Assert.Equal(HttpStatusCode.OK, (await Movimentar(api, novoCaixa.Id, "Suprimento", 50m, "troco do novo turno")).StatusCode);
    }

    private static Task<HttpResponseMessage> Movimentar(HttpClient api, Guid caixaId, string tipo, decimal valor, string motivo) =>
        api.PostAsJsonAsync("/api/v1/caixa/movimentacao", new { caixaId, tipo, valor, motivo, operadorId = "IGNORADO" });

    private static Task<HttpResponseMessage> CriarVenda(HttpClient api, Guid produtoId, decimal qtd, decimal preco, decimal pago, decimal troco) =>
        api.PostAsJsonAsync("/api/v1/vendas", new
        {
            operadorId = "IGNORADO",
            desconto = 0m,
            itens = new[] { new { produtoId, quantidade = qtd, precoUnitario = preco } },
            pagamentos = new[] { new { formaPagamento = "Dinheiro", valor = pago, troco } }
        });

    private record MovimentacaoBody(Guid Id, string Tipo, decimal Valor, string Motivo, string OperadorId);
    private record CaixaBody(Guid Id, string OperadorId, string Status, List<MovimentacaoBody> Movimentacoes);
    private record ProdutoBody(Guid Id, string CodigoBarras, decimal EstoqueAtual);
    private record VendaBody(Guid Id, string OperadorId, decimal ValorLiquido, string Status);
    private record FechamentoBody(decimal SaldoEsperadoSistema, decimal Diferenca, decimal TotalSuprimentos, decimal TotalSangrias, decimal TotalVendasDinheiro);
}
