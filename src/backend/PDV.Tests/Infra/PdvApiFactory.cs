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

    private readonly string _dataDir;
    private readonly string? _dataDirAnterior;

    public PdvApiFactory()
    {
        _dataDir = Path.Combine(Path.GetTempPath(), "pdv-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_dataDir);
        _dataDirAnterior = Environment.GetEnvironmentVariable("PDV_DATA_DIR");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("CloudSync:HubApiKey", HubApiKey);
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IHostedService>();
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        // A pasta de dados é lida durante a inicialização do host; cada fábrica usa seu próprio SQLite temporário.
        // (As coleções de teste rodam em sequência — ver AssemblyInfo.cs — para não disputarem esta variável.)
        Environment.SetEnvironmentVariable("PDV_DATA_DIR", _dataDir);
        var host = base.CreateHost(builder);

        // Operador extra usado apenas pelo teste de troca de PIN
        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PdvDbContext>();
        if (!db.Operadores.Any(o => o.Matricula == MatriculaTeste))
        {
            db.Operadores.Add(new Operador("Operador de Teste", MatriculaTeste, PinTeste, PerfilOperador.Operador));
            db.SaveChanges();
        }

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
        Environment.SetEnvironmentVariable("PDV_DATA_DIR", _dataDirAnterior);
        SqliteConnection.ClearAllPools();
        try { Directory.Delete(_dataDir, recursive: true); } catch { /* arquivo temporário: melhor esforço */ }
    }

    public record OperadorBody(Guid Id, string Nome, string Matricula, string Perfil, bool UsaPinPadrao);
    public record LoginBody(string Token, DateTime ExpiraEm, OperadorBody Operador);
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
