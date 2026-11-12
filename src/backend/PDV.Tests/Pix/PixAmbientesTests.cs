using System.Net;
using System.Net.Http.Json;
using PDV.Application.Commands.Pix;
using PDV.Domain.Entities;
using PDV.Domain.Enums;
using PDV.Domain.Exceptions;
using PDV.Tests.Infra;

namespace PDV.Tests.Pix;

/// <summary>Pix em Production (simulação bloqueada mesmo se configurada) e regras de domínio da cobrança.</summary>
public class PixAmbientesTests : IDisposable
{
    private readonly string _pasta = Path.Combine(Path.GetTempPath(), "pdv-pix-prod-" + Guid.NewGuid().ToString("N"));

    [Theory]
    [InlineData("Development", true, true)]
    [InlineData("Testing", true, true)]
    [InlineData("Development", false, false)]
    [InlineData("Production", true, false)]   // configurado, mas Production: bloqueado
    [InlineData("Staging", true, false)]
    public void SimulacaoSoEmDevelopmentOuTestingExplicitamenteAutorizados(string ambiente, bool configurado, bool esperado)
    {
        Assert.Equal(esperado, OpcoesPix.Para(ambiente, configurado).PermitirSimulacao);
    }

    [Fact]
    public async Task Producao_BloqueiaSimulacao_SemQrFicticio_EConfirmacaoManualFunciona()
    {
        // A fábrica pede Pix:PermitirSimulacao=true; o ambiente Production deve ignorar
        using var factory = new PdvApiFactoryPersonalizada(_pasta, apagarAoDescartar: false, ambiente: "Production");
        using var api = factory.CriarClienteAutenticado(await factory.ObterTokenAsync("OP01", "0000"));
        (await api.PostAsJsonAsync("/api/v1/caixa/abrir", new { operadorId = "OP01", saldoInicial = 0m })).EnsureSuccessStatusCode();

        var recursos = (await api.GetFromJsonAsync<RecursosBody>("/api/v1/sistema/recursos"))!;
        Assert.False(recursos.PixSimulacaoHabilitada);
        Assert.Equal("Manual", recursos.PixProvedor);

        var gerar = await api.PostAsJsonAsync("/api/v1/payments/pix/generate", new { valor = 9.50m, descricao = "Prod" });
        Assert.Equal(HttpStatusCode.OK, gerar.StatusCode);
        var cobranca = (await gerar.Content.ReadFromJsonAsync<CobrancaBody>())!;
        Assert.Null(cobranca.QrCodeBase64);                  // nenhum QR Code fictício em produção
        Assert.Null(cobranca.CopiaECola);
        Assert.False(cobranca.Simulada);
        Assert.False(cobranca.CobrancaBancaria);
        Assert.Contains("Supervisor", cobranca.Instrucoes);

        var simular = await api.PostAsync($"/api/v1/payments/pix/simulate-payment/{cobranca.TxId}", null);
        Assert.Equal(HttpStatusCode.NotFound, simular.StatusCode);
        Assert.Equal("Pendente", (await api.GetFromJsonAsync<CobrancaBody>($"/api/v1/payments/pix/status/{cobranca.TxId}"))!.Status);

        var confirmar = await api.PostAsJsonAsync($"/api/v1/payments/pix/{cobranca.TxId}/confirmar-manual",
            new { supervisorMatricula = "GER01", supervisorPin = "1234" });
        Assert.Equal(HttpStatusCode.OK, confirmar.StatusCode);
        Assert.True((await confirmar.Content.ReadFromJsonAsync<CobrancaBody>())!.ConfirmacaoManual);
    }

    // ---------- Regras de domínio ----------

    private static readonly DateTime Agora = new(2026, 11, 12, 15, 0, 0, DateTimeKind.Utc);
    private static readonly Guid Caixa = Guid.NewGuid();

    private static CobrancaPix Nova(decimal valor = 10m) => new("PDVTESTE", valor, ProvedoresPix.Manual, "OP01", Caixa, "CX01", Agora);

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(1.005)]
    public void ValorInvalido_Recusado(decimal valor)
    {
        Assert.Throws<DomainException>(() => Nova(valor));
    }

    [Fact]
    public void CobrancaExpirada_NaoPodeSerConfirmada()
    {
        var c = Nova();
        Assert.Throws<DomainException>(() => c.Confirmar(MetodoConfirmacaoPix.ManualSupervisor, Agora.AddMinutes(CobrancaPix.MinutosValidade + 1), Guid.NewGuid(), "GER01"));
        Assert.Equal(StatusCobrancaPix.Pendente, c.Status);
    }

    [Fact]
    public void ConfirmacaoManual_ExigeSupervisor()
    {
        Assert.Throws<DomainException>(() => Nova().Confirmar(MetodoConfirmacaoPix.ManualSupervisor, Agora));
    }

    [Fact]
    public void Transicoes_SoNaOrdemCorreta()
    {
        var c = Nova();
        Assert.Throws<DomainException>(() => c.Utilizar(Guid.NewGuid(), Caixa, 10m, Agora));          // Pendente → Utilizada: não
        c.Confirmar(MetodoConfirmacaoPix.ManualSupervisor, Agora, Guid.NewGuid(), "GER01");
        Assert.Throws<ConflitoException>(() => c.Confirmar(MetodoConfirmacaoPix.ManualSupervisor, Agora, Guid.NewGuid(), "GER01"));
        Assert.Throws<DomainException>(() => c.Utilizar(Guid.NewGuid(), Guid.NewGuid(), 10m, Agora)); // outro caixa
        c.Utilizar(Guid.NewGuid(), Caixa, 10m, Agora);
        Assert.Equal(StatusCobrancaPix.Utilizada, c.Status);
        Assert.Throws<ConflitoException>(() => c.Utilizar(Guid.NewGuid(), Caixa, 10m, Agora));
    }

    private record RecursosBody(bool PixSimulacaoHabilitada, string PixProvedor);
    private record CobrancaBody(string TxId, string Status, bool Simulada, bool CobrancaBancaria, string? QrCodeBase64, string? CopiaECola, string? Instrucoes, bool ConfirmacaoManual);

    public void Dispose()
    {
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        try { if (Directory.Exists(_pasta)) Directory.Delete(_pasta, recursive: true); } catch { /* temporário */ }
    }
}
