using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PDV.API.Administracao;
using PDV.Infrastructure.Persistence;
using static PDV.Tests.BancoDados.BancosDeTeste;

namespace PDV.Tests.BancoDados;

/// <summary>
/// Bancos existentes nunca são alterados na inicialização normal: apenas com autorização explícita
/// (comando --atualizar-banco com confirmação do arquivo e da versão de destino).
/// </summary>
public class AutorizacaoMigracaoTests : IDisposable
{
    private static readonly string Inicial = MigradorBancoDados.MigracoesLegadas[0];
    private static readonly string Sincronizacao = MigradorBancoDados.MigracoesLegadas[1];

    private readonly string _pasta = Path.Combine(Path.GetTempPath(), "pdv-autorizacao-" + Guid.NewGuid().ToString("N"));

    private string NovaPasta(string nome) => Path.Combine(_pasta, nome);

    [Fact]
    public void InicializacaoNormal_CriaBancoNovo()
    {
        var caminho = Path.Combine(NovaPasta("novo"), "pdv.db");

        var resultado = Migrar(caminho);

        Assert.True(resultado.HouveAlteracao);
        Assert.Equal(new[] { Inicial, Sincronizacao }, Historico(caminho));
    }

    [Theory]
    [InlineData("G1", false)]
    [InlineData("G2", true)]
    public void InicializacaoNormal_NaoAlteraBancoSemHistorico_EInformaComoAutorizar(string geracao, bool comUsers)
    {
        var pasta = NovaPasta("normal-" + geracao);
        var caminho = CriarLegado(pasta, geracao, comTabelaUsers: comUsers);
        var hash = Hash(caminho);
        var dados = Retrato(caminho);

        var erro = Assert.Throws<MigracaoBancoException>(() => Migrar(caminho));

        Assert.Equal(EtapaMigracao.Autorizacao, erro.Etapa);
        Assert.Contains("precisa ser ATUALIZADO", erro.Message);
        Assert.Contains("Nenhuma alteração foi feita", erro.Message);
        Assert.Contains($"--atualizar-banco --banco \"{caminho}\" --destino {Sincronizacao} --confirmar", erro.Message);
        SqliteConnection.ClearAllPools();
        Assert.Equal(hash, Hash(caminho));
        Assert.Equal(dados, Retrato(caminho));
        Assert.Empty(Historico(caminho));                  // G2 também NÃO recebe baseline automaticamente
        Assert.Empty(BancosDeTeste.Backups(pasta));
    }

    [Fact]
    public void BancoGerenciadoComMigrationPendente_TambemExigeAutorizacao()
    {
        var pasta = NovaPasta("pendente");
        Directory.CreateDirectory(pasta);
        var caminho = Path.Combine(pasta, "pdv.db");
        using (var ctx = Contexto(caminho)) ctx.GetService<IMigrator>().Migrate(Inicial);   // banco só até a 0001
        using (var c = Abrir(caminho)) { c.Open(); Sql(c, "INSERT INTO \"Operadores\" VALUES ('77777777-7777-7777-7777-777777777777','Op','OP01','x',1,1,'2026-11-01 08:00:00',NULL);"); }
        SqliteConnection.ClearAllPools();
        var hash = Hash(caminho);

        var erro = Assert.Throws<MigracaoBancoException>(() => Migrar(caminho));
        Assert.Equal(EtapaMigracao.Autorizacao, erro.Etapa);
        SqliteConnection.ClearAllPools();
        Assert.Equal(hash, Hash(caminho));

        var autorizado = MigrarAutorizado(caminho);
        Assert.Equal(new[] { Sincronizacao }, autorizado.Aplicadas);
        Assert.Single(Linhas(caminho, "Operadores", new[] { "Matricula" }));
    }

    [Fact]
    public void AutorizacaoParaOutroArquivoOuOutraVersao_ERecusada()
    {
        var pasta = NovaPasta("autorizacao-errada");
        var caminho = CriarLegado(pasta, "G1");
        var hash = Hash(caminho);

        using (var ctx = Contexto(caminho))
        {
            var migrador = Migrador(ctx);
            var outroBanco = Assert.Throws<MigracaoBancoException>(() =>
                migrador.Executar(new AutorizacaoMigracao(Path.Combine(pasta, "outro.db"), migrador.UltimaMigracao)));
            Assert.Equal(EtapaMigracao.Autorizacao, outroBanco.Etapa);

            var outraVersao = Assert.Throws<MigracaoBancoException>(() =>
                migrador.Executar(new AutorizacaoMigracao(caminho, Inicial)));
            Assert.Equal(EtapaMigracao.Autorizacao, outraVersao.Etapa);
            Assert.Contains("não corresponde", outraVersao.Message);
        }

        SqliteConnection.ClearAllPools();
        Assert.Equal(hash, Hash(caminho));
        Assert.Empty(BancosDeTeste.Backups(pasta));
    }

    [Fact]
    public void AutorizacaoExplicita_AtualizaCopiaG1_EDepoisInicializacaoNormalFunciona()
    {
        var pasta = NovaPasta("autorizado");
        var caminho = CriarLegado(pasta, "G1");
        var dados = Retrato(caminho);

        var resultado = MigrarAutorizado(caminho);

        Assert.True(resultado.HouveAlteracao);
        Assert.NotNull(resultado.Backup);
        foreach (var (tabela, linhas) in dados)
            Assert.Equal(linhas, Linhas(caminho, tabela, EsquemaDeDdl(Ddl("G1")).Tabelas[tabela].Colunas.Keys.OrderBy(c => c, StringComparer.Ordinal)));

        var normal = Migrar(caminho);
        Assert.False(normal.HouveAlteracao);
        Assert.Equal(SituacaoBanco.Gerenciado, normal.Antes.Situacao);
    }

    [Fact]
    public void AtualizacaoAutomatica_ReservadaParaOFuturo_SoAtuaQuandoHabilitadaExplicitamente()
    {
        Assert.False(new OpcoesMigracaoBanco().AtualizacaoAutomatica);   // padrão: desativada

        var caminho = CriarLegado(NovaPasta("automatica"), "G1");
        using var ctx = Contexto(caminho);
        var resultado = Migrador(ctx, atualizacaoAutomatica: true).Executar();

        Assert.True(resultado.HouveAlteracao);
        Assert.NotNull(resultado.Backup);
    }

    // ---------- Comando administrativo ----------

    [Fact]
    public void ComandoAdministrativo_SemConfirmacao_MostraBancoEVersao_ENaoAltera()
    {
        var pasta = NovaPasta("comando-sem-confirmar");
        var caminho = CriarLegado(pasta, "G1");
        var hash = Hash(caminho);
        var saida = new StringWriter();

        int codigo;
        using (var ctx = Contexto(caminho))
            codigo = ComandoAtualizarBanco.Executar(new[] { "--atualizar-banco" }, Migrador(ctx), saida);

        Assert.Equal(2, codigo);
        Assert.Contains($"Banco: {caminho}", saida.ToString());
        Assert.Contains($"Versão de destino desta build: {Sincronizacao}", saida.ToString());
        Assert.Contains($"--atualizar-banco --banco \"{caminho}\" --destino {Sincronizacao} --confirmar", saida.ToString());
        SqliteConnection.ClearAllPools();
        Assert.Equal(hash, Hash(caminho));
    }

    [Fact]
    public void ComandoAdministrativo_ComConfirmacao_AtualizaComBackup()
    {
        var pasta = NovaPasta("comando-confirmado");
        var caminho = CriarLegado(pasta, "G1");
        var saida = new StringWriter();

        int codigo;
        using (var ctx = Contexto(caminho))
            codigo = ComandoAtualizarBanco.Executar(
                new[] { "--atualizar-banco", "--banco", caminho, "--destino", Sincronizacao, "--confirmar" }, Migrador(ctx), saida);

        Assert.Equal(0, codigo);
        Assert.Contains("Banco atualizado com sucesso", saida.ToString());
        Assert.Contains("Backup validado", saida.ToString());
        Assert.Equal(new[] { Inicial, Sincronizacao }, Historico(caminho));
        Assert.Single(BancosDeTeste.Backups(pasta));
    }

    [Fact]
    public void ComandoAdministrativo_BancoIncompativel_NaoAltera()
    {
        var pasta = NovaPasta("comando-incompativel");
        var caminho = CriarLegado(pasta, "G1", ajuste: c => Sql(c, "ALTER TABLE \"Produtos\" ADD COLUMN \"Marca\" TEXT NULL;"));
        var hash = Hash(caminho);
        var saida = new StringWriter();

        int codigo;
        using (var ctx = Contexto(caminho))
            codigo = ComandoAtualizarBanco.Executar(
                new[] { "--atualizar-banco", "--banco", caminho, "--destino", Sincronizacao, "--confirmar" }, Migrador(ctx), saida);

        Assert.Equal(1, codigo);
        Assert.Contains("Coluna não reconhecida: Produtos.Marca", saida.ToString());
        SqliteConnection.ClearAllPools();
        Assert.Equal(hash, Hash(caminho));
    }

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        try { if (Directory.Exists(_pasta)) Directory.Delete(_pasta, recursive: true); } catch { /* temporário */ }
    }
}
