using System.Net;
using System.Net.Http.Json;
using Microsoft.Data.Sqlite;
using PDV.Tests.Infra;
using static PDV.Tests.BancoDados.BancosDeTeste;

namespace PDV.Tests.BancoDados;

/// <summary>
/// Inicializa a API real sobre um banco G1 TEMPORÁRIO (como os criados até 03/11 por EnsureCreated):
/// a própria inicialização atualiza o banco e o PDV continua operando com os dados antigos.
/// </summary>
public class ApiComBancoLegadoTests : IDisposable
{
    private readonly string _pasta = Path.Combine(Path.GetTempPath(), "pdv-api-legado-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public async Task BancoG1_EAtualizadoNaInicializacao_EContinuaCompativel()
    {
        var caminho = CriarLegado(_pasta, "G1");

        using var factory = new PdvApiFactoryPersonalizada(_pasta, apagarAoDescartar: false);
        var token = await factory.ObterTokenAsync("OP01", "0000");           // operador e PIN (hash) antigos
        using var api = factory.CriarClienteAutenticado(token);

        // Vendas antigas legíveis (antes da migração, o EF falhava por falta de TerminalId/NumeroSequencial)
        var vendas = (await api.GetFromJsonAsync<List<VendaBody>>("/api/v1/vendas"))!;
        Assert.Contains(vendas, v => v.Id == Guid.Parse(Venda1) && v.Status == "Concluida" && v.ValorLiquido == 51.80m);
        Assert.Contains(vendas, v => v.Id == Guid.Parse(Venda2) && v.Status == "Cancelada");

        // Caixa aberto antigo com suas movimentações, e uma nova venda registrada nele
        var caixa = (await api.GetFromJsonAsync<CaixaBody>("/api/v1/caixa/atual"))!;
        Assert.Equal(Guid.Parse(Caixa1), caixa.Id);
        Assert.Equal(2, caixa.Movimentacoes.Count);

        var nova = await api.PostAsJsonAsync("/api/v1/vendas", new
        {
            operadorId = "OP01",
            desconto = 0m,
            itens = new[] { new { produtoId = Guid.Parse(Produto1), quantidade = 1m, precoUnitario = 25.90m } },
            pagamentos = new[] { new { formaPagamento = "Dinheiro", valor = 30m, troco = 4.10m } }
        });
        Assert.Equal(HttpStatusCode.OK, nova.StatusCode);

        // Sincronização (tabela criada pela migration) funcionando
        Assert.Equal(HttpStatusCode.OK, (await api.GetAsync("/api/v1/sync/status")).StatusCode);

        factory.Dispose();
        SqliteConnection.ClearAllPools();
        Assert.Equal(2, Historico(caminho).Count);
        Assert.Single(BancosDeTeste.Backups(_pasta));
    }

    private record VendaBody(Guid Id, decimal ValorLiquido, string Status);
    private record MovimentacaoBody(Guid Id);
    private record CaixaBody(Guid Id, List<MovimentacaoBody> Movimentacoes);

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        try { if (Directory.Exists(_pasta)) Directory.Delete(_pasta, recursive: true); } catch { /* temporário */ }
    }
}
