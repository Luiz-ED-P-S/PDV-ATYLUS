using System.Net;
using PDV.API.Security;
using PDV.Tests.Infra;

namespace PDV.Tests.Seguranca;

/// <summary>
/// Sobe a API real várias vezes sobre a mesma pasta de dados TEMPORÁRIA para simular
/// reinício, atualização (outra pasta de instalação), chave corrompida e chave inacessível.
/// </summary>
public class ReinicioApiTests : IDisposable
{
    private readonly string _dados = Path.Combine(Path.GetTempPath(), "pdv-reinicio-" + Guid.NewGuid().ToString("N"));
    private readonly string _instalacaoNova = Path.Combine(Path.GetTempPath(), "pdv-instalacao-" + Guid.NewGuid().ToString("N"));

    private string ArquivoChave => Path.Combine(_dados, JwtKeyStore.NomeArquivo);

    [Fact]
    public async Task Reinicio_MantemAChave_ETokensContinuamValidos()
    {
        string token;
        using (var primeira = new PdvApiFactoryPersonalizada(_dados, apagarAoDescartar: false))
        {
            token = await primeira.ObterTokenAsync("OP01", "0000");
        }
        var chaveAntes = File.ReadAllText(ArquivoChave);

        using var segunda = new PdvApiFactoryPersonalizada(_dados, apagarAoDescartar: false);
        using var cliente = segunda.CriarClienteAutenticado(token);

        Assert.Equal(HttpStatusCode.OK, (await cliente.GetAsync("/api/v1/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await cliente.GetAsync("/api/v1/produtos")).StatusCode);
        Assert.Equal(chaveAntes, File.ReadAllText(ArquivoChave));
    }

    [Fact]
    public async Task AtualizacaoDoAplicativo_EmOutraPastaDeInstalacao_MantemSessoes()
    {
        Directory.CreateDirectory(_instalacaoNova);
        string token;
        using (var versaoAntiga = new PdvApiFactoryPersonalizada(_dados, apagarAoDescartar: false))
        {
            token = await versaoAntiga.ObterTokenAsync("GER01", "1234");
        }

        using var versaoNova = new PdvApiFactoryPersonalizada(_dados, apagarAoDescartar: false, contentRoot: _instalacaoNova);
        using var cliente = versaoNova.CriarClienteAutenticado(token);

        Assert.Equal(HttpStatusCode.OK, (await cliente.GetAsync("/api/v1/auth/me")).StatusCode);
        Assert.False(File.Exists(Path.Combine(_instalacaoNova, JwtKeyStore.NomeArquivo)));
    }

    [Fact]
    public async Task ChaveCorrompida_ApiSobeComNovaChave_ETokensAntigosSaoRecusados()
    {
        string tokenAntigo;
        using (var primeira = new PdvApiFactoryPersonalizada(_dados, apagarAoDescartar: false))
        {
            tokenAntigo = await primeira.ObterTokenAsync("OP01", "0000");
        }
        File.WriteAllText(ArquivoChave, "### corrompido ###");

        using var segunda = new PdvApiFactoryPersonalizada(_dados, apagarAoDescartar: false);
        using var antigo = segunda.CriarClienteAutenticado(tokenAntigo);

        Assert.Equal(HttpStatusCode.Unauthorized, (await antigo.GetAsync("/api/v1/auth/me")).StatusCode);
        var novoToken = await segunda.ObterTokenAsync("OP01", "0000");
        using var novo = segunda.CriarClienteAutenticado(novoToken);
        Assert.Equal(HttpStatusCode.OK, (await novo.GetAsync("/api/v1/auth/me")).StatusCode);
        Assert.Single(Directory.GetFiles(_dados, JwtKeyStore.NomeArquivo + ".corrompida-*"));
    }

    [Fact]
    public void ChaveInacessivel_ApiNaoInicia_ENaoTocaNoBanco()
    {
        Directory.CreateDirectory(ArquivoChave); // leitura negada pelo sistema operacional

        using var factory = new PdvApiFactoryPersonalizada(_dados, apagarAoDescartar: false);
        var erro = Record.Exception(() => factory.CreateClient());

        Assert.NotNull(erro);
        var falha = EncontrarNaCadeia<ChaveJwtException>(erro!);
        Assert.NotNull(falha);
        Assert.Equal(TipoFalhaChaveJwt.AcessoNegado, falha!.Tipo);
        Assert.False(File.Exists(Path.Combine(_dados, "pdv.db")));      // falhou antes de criar/abrir o banco
        Assert.Empty(Directory.GetFiles(_dados));                         // nenhuma chave substituta
    }

    private static T? EncontrarNaCadeia<T>(Exception ex) where T : Exception
    {
        for (var atual = ex; atual != null; atual = atual.InnerException)
        {
            if (atual is T alvo) return alvo;
            if (atual is AggregateException agregada)
                foreach (var interna in agregada.InnerExceptions)
                    if (EncontrarNaCadeia<T>(interna) is { } achada) return achada;
        }
        return null;
    }

    public void Dispose()
    {
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        foreach (var dir in new[] { _dados, _instalacaoNova })
        {
            try { if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true); } catch { /* temporário */ }
        }
    }
}
