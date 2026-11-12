using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using PDV.Domain.Entities;
using PDV.Domain.Enums;
using PDV.Infrastructure.Context;

namespace PDV.Tests.Infra;

/// <summary>
/// Sobe a API real em memória apontando para um SQLite TEMPORÁRIO (PDV_DATA_DIR),
/// sem tocar no pdv.db do desenvolvedor e sem workers de nuvem/backup.
/// </summary>
public class PdvApiFactory : WebApplicationFactory<Program>
{
    public const string HubApiKey = "chave-hub-de-teste";
    public const string MatriculaTeste = "TST01";
    public const string PinTeste = "5678";
    public const string MatriculaDesativar = "TST02";
    public const string MatriculaTrocaPin = "TST03";
    public const string PinExtras = "2468";

    // Variáveis que decidem onde ficam banco e chave; são isoladas durante o teste e restauradas no fim
    private static readonly string[] VariaveisIsoladas = { "PDV_DATA_DIR", "PDV_JWT_KEY_DIR", "PDV_JWT_KEY", "PDV_DESKTOP_MODE" };

    private readonly bool _apagarAoDescartar;
    private readonly string? _contentRoot;
    private readonly string _ambiente;
    private readonly Dictionary<string, string?> _variaveisAnteriores = new();

    public string DataDir { get; }

    public PdvApiFactory() : this(null, apagarAoDescartar: true) { }

    /// <summary>Ambiente do host (padrão "Testing", com simulação de Pix explicitamente autorizada).</summary>
    public string Ambiente => _ambiente;

    /// <param name="dataDir">Pasta de dados temporária (reutilizável para simular reinício da API).</param>
    /// <param name="apagarAoDescartar">Apaga a pasta ao descartar a fábrica.</param>
    /// <param name="contentRoot">Pasta "de instalação" alternativa, para simular atualização do aplicativo.</param>
    protected PdvApiFactory(string? dataDir, bool apagarAoDescartar, string? contentRoot = null, string ambiente = "Testing")
    {
        _ambiente = ambiente;
        DataDir = dataDir ?? Path.Combine(Path.GetTempPath(), "pdv-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(DataDir);
        _apagarAoDescartar = apagarAoDescartar;
        _contentRoot = contentRoot;
        foreach (var v in VariaveisIsoladas)
            _variaveisAnteriores[v] = Environment.GetEnvironmentVariable(v);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        if (_contentRoot != null)
            builder.UseContentRoot(_contentRoot);
        builder.UseEnvironment(_ambiente);
        builder.UseSetting("CloudSync:HubApiKey", HubApiKey);
        // Simulação de Pix pedida explicitamente; o servidor só a habilita em Development/Testing
        builder.UseSetting("Pix:PermitirSimulacao", "true");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IHostedService>();
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        // A pasta de dados é lida durante a inicialização do host; cada fábrica usa seu próprio SQLite temporário.
        // (As coleções de teste rodam em sequência — ver AssemblyInfo.cs — para não disputarem esta variável.)
        foreach (var v in VariaveisIsoladas)
            Environment.SetEnvironmentVariable(v, null);
        Environment.SetEnvironmentVariable("PDV_DATA_DIR", DataDir);
        var host = base.CreateHost(builder);

        // Operadores extras usados apenas pelos testes de troca de PIN e desativação
        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PdvDbContext>();
        foreach (var (matricula, pin) in new[] { (MatriculaTeste, PinTeste), (MatriculaDesativar, PinExtras), (MatriculaTrocaPin, PinExtras) })
        {
            if (!db.Operadores.Any(o => o.Matricula == matricula))
                db.Operadores.Add(new Operador($"Operador de Teste {matricula}", matricula, pin, PerfilOperador.Operador));
        }
        db.SaveChanges();

        return host;
    }

    public async Task<string> ObterTokenAsync(string matricula, string pin)
    {
        using var client = CreateClient();
        var resp = await client.PostAsJsonAsync("/api/v1/auth/login", new { matricula, pin });
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<LoginBody>();
        return body!.Token;
    }

    public HttpClient CriarClienteAutenticado(string token)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        foreach (var (v, valor) in _variaveisAnteriores)
            Environment.SetEnvironmentVariable(v, valor);
        SqliteConnection.ClearAllPools();
        if (_apagarAoDescartar)
        {
            try { Directory.Delete(DataDir, recursive: true); } catch { /* arquivo temporário: melhor esforço */ }
        }
    }

    public record OperadorBody(Guid Id, string Nome, string Matricula, string Perfil, bool UsaPinPadrao);
    public record LoginBody(string Token, DateTime ExpiraEm, OperadorBody Operador);

    public async Task<LoginBody> LoginAsync(string matricula, string pin)
    {
        using var client = CreateClient();
        var resp = await client.PostAsJsonAsync("/api/v1/auth/login", new { matricula, pin });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<LoginBody>())!;
    }
}

/// <summary>
/// Fábrica com pasta de dados escolhida pelo teste (ex.: reutilizada entre "reinícios" da API).
/// Separada porque fixtures do xUnit precisam de um único construtor público.
/// </summary>
public sealed class PdvApiFactoryPersonalizada : PdvApiFactory
{
    public PdvApiFactoryPersonalizada(string dataDir, bool apagarAoDescartar, string? contentRoot = null, string ambiente = "Testing")
        : base(dataDir, apagarAoDescartar, contentRoot, ambiente) { }
}

[CollectionDefinition(Nome)]
public class ApiCollection : ICollectionFixture<PdvApiFactory>
{
    public const string Nome = "API PDV";
}

/// <summary>
/// Coleção com banco temporário próprio para o ciclo completo do caixa
/// (só pode haver um caixa aberto por banco).
/// </summary>
[CollectionDefinition(Nome)]
public class CaixaCollection : ICollectionFixture<PdvApiFactory>
{
    public const string Nome = "API PDV - Caixa";
}

/// <summary>Coleção com banco temporário próprio para os testes de cobranças Pix.</summary>
[CollectionDefinition(Nome)]
public class PixCollection : ICollectionFixture<PdvApiFactory>
{
    public const string Nome = "API PDV - Pix";
}
