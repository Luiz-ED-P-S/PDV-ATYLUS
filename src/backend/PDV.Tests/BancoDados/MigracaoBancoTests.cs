using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PDV.Infrastructure.Context;
using PDV.Infrastructure.Persistence;
using static PDV.Tests.BancoDados.BancosDeTeste;

namespace PDV.Tests.BancoDados;

/// <summary>
/// DB-01: transição de EnsureCreated() para migrations, sempre em bancos TEMPORÁRIOS.
/// </summary>
public class MigracaoBancoTests : IDisposable
{
    private static readonly string Inicial = MigradorBancoDados.MigracoesLegadas[0];
    private static readonly string Sincronizacao = MigradorBancoDados.MigracoesLegadas[1];

    private readonly string _pasta = Path.Combine(Path.GetTempPath(), "pdv-migracao-" + Guid.NewGuid().ToString("N"));

    private string NovaPasta(string nome) => Path.Combine(_pasta, nome);

    // ---------- 1. Banco novo ----------

    [Fact]
    public void BancoNovo_CriadoSomentePorMigrations_IgualAoModeloEAoEsquemaHistoricoG2()
    {
        var caminho = Path.Combine(NovaPasta("novo"), "pdv.db");

        var resultado = Migrar(caminho);

        Assert.Equal(SituacaoBanco.Novo, resultado.Antes.Situacao);
        Assert.True(resultado.HouveAlteracao);
        Assert.Null(resultado.Backup);                                   // nada a preservar
        Assert.Equal(new[] { Inicial, Sincronizacao }, Historico(caminho));

        var real = LerEsquema(caminho);
        var modelo = EsquemaDoModeloAtual();
        Assert.Empty(modelo.DiferencasEm(real));
        Assert.Empty(real.TabelasDeDados.Except(modelo.TabelasDeDados));
        var g2 = EsquemaDeDdl(Ddl("G2"));
        Assert.Empty(g2.DiferencasEm(real));
        Assert.Empty(BancosDeTeste.Backups(NovaPasta("novo")));
    }

    [Fact]
    public void Migrations_ReproduzemExatamenteAsGeracoesHistoricas()
    {
        using var ctx = Contexto(":memory:");
        var migrador = Migrador(ctx);

        Assert.Empty(EsquemaDeDdl(Ddl("G1")).DiferencasEm(migrador.EsquemaApos(Inicial)));
        Assert.Empty(migrador.EsquemaApos(Inicial).DiferencasEm(EsquemaDeDdl(Ddl("G1"))));
        Assert.Empty(EsquemaDeDdl(Ddl("G2")).DiferencasEm(migrador.EsquemaApos(Sincronizacao)));
        Assert.Empty(migrador.EsquemaApos(Sincronizacao).DiferencasEm(EsquemaDeDdl(Ddl("G2"))));
    }

    // ---------- 2/3/9. Atualização de bancos antigos com preservação ----------

    [Fact]
    public void BancoG1_ComDados_RecebeBaselineEMigration_PreservandoTodosOsRegistros()
    {
        var pasta = NovaPasta("g1");
        var caminho = CriarLegado(pasta, "G1");
        var antes = Retrato(caminho);

        var resultado = MigrarAutorizado(caminho);

        Assert.Equal(SituacaoBanco.LegadoReconhecido, resultado.Antes.Situacao);
        Assert.Equal(Inicial, resultado.Antes.GeracaoLegada);
        Assert.Equal(new[] { Sincronizacao }, resultado.Aplicadas);
        Assert.Equal(new[] { Inicial, Sincronizacao }, Historico(caminho));
        Assert.Empty(EsquemaDoModeloAtual().DiferencasEm(LerEsquema(caminho)));

        // Produtos, operadores (com hash do PIN), caixas, movimentações, vendas, itens e pagamentos: idênticos
        foreach (var (tabela, linhas) in antes)
        {
            var colunasOriginais = LerEsquemaDeDdl("G1").Tabelas[tabela].Colunas.Keys.OrderBy(c => c, StringComparer.Ordinal);
            Assert.Equal(linhas, Linhas(caminho, tabela, colunasOriginais));
        }
        Assert.Equal(new[] { "CX01|1", "CX01|1" }, Linhas(caminho, "Vendas", new[] { "TerminalId", "NumeroSequencial" }));

        // Backup criado antes da alteração, íntegro e com o estado original
        var backup = Assert.Single(BancosDeTeste.Backups(pasta));
        Assert.Equal(resultado.Backup, backup);
        Assert.Equal(antes, Retrato(backup));
        Assert.Empty(Historico(backup));
    }

    [Fact]
    public void BancoG2Legado_ComTabelaUsers_SomenteBaseline_SemAlterarEstruturaNemDados()
    {
        var pasta = NovaPasta("g2");
        var caminho = CriarLegado(pasta, "G2", comTabelaUsers: true);
        var esquemaAntes = LerEsquema(caminho);
        var dadosAntes = Retrato(caminho);

        var resultado = MigrarAutorizado(caminho);

        Assert.Equal(SituacaoBanco.LegadoReconhecido, resultado.Antes.Situacao);
        Assert.Equal(Sincronizacao, resultado.Antes.GeracaoLegada);
        Assert.Empty(resultado.Aplicadas);
        Assert.Equal(new[] { "Users" }, resultado.Antes.TabelasExtras);
        Assert.Equal(new[] { Inicial, Sincronizacao }, Historico(caminho));

        var esquemaDepois = LerEsquema(caminho);
        Assert.Empty(esquemaAntes.DiferencasEm(esquemaDepois));                        // nenhuma tabela/coluna/índice alterado
        Assert.Equal(esquemaAntes.TabelasDeDados, esquemaDepois.TabelasDeDados);       // Users preservada
        Assert.Equal(dadosAntes, Retrato(caminho));                                    // todos os dados, inclusive Users
        Assert.Single(BancosDeTeste.Backups(pasta));
    }

    // ---------- 4/8. Verificação, retomada e reinicializações ----------

    [Fact]
    public void Reinicializacoes_AposAtualizar_NaoAlteramNada()
    {
        var pasta = NovaPasta("reinicio");
        var caminho = CriarLegado(pasta, "G1");
        MigrarAutorizado(caminho);
        var dados = Retrato(caminho);
        var esquema = LerEsquema(caminho);

        var segunda = Migrar(caminho);
        var terceira = Migrar(caminho);

        Assert.False(segunda.HouveAlteracao);
        Assert.False(terceira.HouveAlteracao);
        Assert.Equal(SituacaoBanco.Gerenciado, segunda.Antes.Situacao);
        Assert.Null(segunda.Backup);
        Assert.Single(BancosDeTeste.Backups(pasta));
        Assert.Equal(dados, Retrato(caminho));
        Assert.True(esquema.Igual(LerEsquema(caminho)));
        Assert.Equal(new[] { Inicial, Sincronizacao }, Historico(caminho));
    }

    [Fact]
    public void Diagnostico_ESomenteLeitura_EInformaOQueSeraFeito()
    {
        var pasta = NovaPasta("diagnostico");
        var caminho = CriarLegado(pasta, "G1");
        var hash = Hash(caminho);

        var diagnostico = Diagnosticar(caminho);

        Assert.Equal(SituacaoBanco.LegadoReconhecido, diagnostico.Situacao);
        Assert.Equal(new[] { Sincronizacao }, diagnostico.MigracoesPendentes);
        Assert.Contains("LegadoReconhecido", diagnostico.Relatorio());
        SqliteConnection.ClearAllPools();
        Assert.Equal(hash, Hash(caminho));
        Assert.Empty(Historico(caminho));
        Assert.Empty(BancosDeTeste.Backups(pasta));
    }

    // ---------- 5. Esquemas incompatíveis ----------

    public static IEnumerable<object?[]> EsquemasIncompativeis() => new List<object?[]>
    {
        new object?[] { "coluna-ausente", null, "ALTER TABLE \"Produtos\" DROP COLUMN \"EstoqueMinimo\";", "Coluna ausente: Produtos.EstoqueMinimo" },
        new object?[] { "tipo-diferente", Ddl("G1").Replace("\"PrecoVenda\" TEXT NOT NULL", "\"PrecoVenda\" REAL NOT NULL"), null, "Coluna diferente: Produtos.PrecoVenda" },
        new object?[] { "coluna-extra", null, "ALTER TABLE \"Produtos\" ADD COLUMN \"Marca\" TEXT NOT NULL DEFAULT '';", "Coluna não reconhecida: Produtos.Marca" },
        new object?[] { "indice-ausente", null, "DROP INDEX \"IX_Produtos_CodigoBarras\";", "Índice ausente ou diferente: Produtos.IX_Produtos_CodigoBarras" },
    };

    [Theory]
    [MemberData(nameof(EsquemasIncompativeis))]
    public void EsquemaIncompativel_ERecusado_SemNenhumaAlteracao(string caso, string? ddl, string? ajusteSql, string problemaEsperado)
    {
        if (ddl != null) Assert.NotEqual(Ddl("G1"), ddl); // garante que o caso realmente alterou o DDL
        var pasta = NovaPasta("incompativel-" + caso);
        var caminho = CriarLegado(pasta, "G1", ddlSubstituto: ddl, ajuste: ajusteSql == null ? null : c => Sql(c, ajusteSql));
        var hash = Hash(caminho);

        var erro = Assert.Throws<MigracaoBancoException>(() => Migrar(caminho));

        Assert.Equal(EtapaMigracao.Diagnostico, erro.Etapa);
        Assert.Contains(problemaEsperado, erro.Message);
        Assert.Contains("NÃO foi alterado", erro.Message);
        SqliteConnection.ClearAllPools();
        Assert.Equal(hash, Hash(caminho));
        Assert.Empty(BancosDeTeste.Backups(pasta));
        Assert.Empty(Historico(caminho));
    }

    [Fact]
    public void BancoAtualizadoPorVersaoMaisNova_ERecusado()
    {
        var caminho = Path.Combine(NovaPasta("futuro"), "pdv.db");
        Migrar(caminho);
        using (var c = Abrir(caminho)) { c.Open(); Sql(c, "INSERT INTO \"__EFMigrationsHistory\" VALUES ('29991231000000_VersaoFutura', '9.0.0');"); }

        var erro = Assert.Throws<MigracaoBancoException>(() => Migrar(caminho));

        Assert.Contains("versão mais nova", erro.Message);
    }

    [Fact]
    public void EsquemaDivergenteDoHistorico_ERecusado()
    {
        var caminho = Path.Combine(NovaPasta("deriva"), "pdv.db");
        Migrar(caminho);
        using (var c = Abrir(caminho)) { c.Open(); Sql(c, "DROP INDEX \"IX_Vendas_TerminalId_NumeroSequencial\";"); }

        var erro = Assert.Throws<MigracaoBancoException>(() => Migrar(caminho));

        Assert.Contains("diverge do histórico", erro.Message);
        Assert.Contains("IX_Vendas_TerminalId_NumeroSequencial", erro.Message);
    }

    [Fact]
    public void BancoCorrompido_ERecusado_SemAlteracao()
    {
        var pasta = NovaPasta("corrompido");
        var caminho = CriarLegado(pasta, "G1");
        var bytes = File.ReadAllBytes(caminho);
        Array.Fill(bytes, (byte)0x5A, 0, 100); // destrói o cabeçalho do arquivo
        File.WriteAllBytes(caminho, bytes);
        var hash = Hash(caminho);

        var erro = Assert.Throws<MigracaoBancoException>(() => Migrar(caminho));

        Assert.Equal(EtapaMigracao.Diagnostico, erro.Etapa);
        SqliteConnection.ClearAllPools();
        Assert.Equal(hash, Hash(caminho));
        Assert.Empty(BancosDeTeste.Backups(pasta));
    }

    // ---------- 6. Falha durante a migration e retomada ----------

    [Fact]
    public void FalhaDuranteMigration_DesfazAEtapa_MantemBackup_ERetomaAposCorrecao()
    {
        var pasta = NovaPasta("falha");
        // Tabela conflitante: a migration 0002 adiciona colunas em Vendas e falha ao criar FilaSincronizacao
        var caminho = CriarLegado(pasta, "G1", ajuste: c => Sql(c, "CREATE TABLE \"FilaSincronizacao\" (\"Id\" TEXT NOT NULL PRIMARY KEY);"));
        var dadosAntes = Retrato(caminho);

        var erro = Assert.Throws<MigracaoBancoException>(() => MigrarAutorizado(caminho));

        Assert.Equal(EtapaMigracao.Migracao, erro.Etapa);
        Assert.NotNull(erro.CaminhoBackup);
        Assert.True(File.Exists(erro.CaminhoBackup));
        Assert.Contains("desfeita", erro.Message);
        // A migration 0002 foi revertida por completo (inclusive os ADD COLUMN que já tinham executado)
        Assert.DoesNotContain("TerminalId", LerEsquema(caminho).Tabelas["Vendas"].Colunas.Keys);
        Assert.Equal(new[] { Inicial }, Historico(caminho));                       // baseline registrado e coerente
        Assert.Equal(dadosAntes, Retrato(caminho));
        Assert.Equal(dadosAntes, Retrato(erro.CaminhoBackup!));

        // Correção da causa e nova inicialização: retoma de onde parou
        using (var c = Abrir(caminho)) { c.Open(); Sql(c, "DROP TABLE \"FilaSincronizacao\";"); }
        var retomada = MigrarAutorizado(caminho);

        Assert.Equal(SituacaoBanco.Gerenciado, retomada.Antes.Situacao);
        Assert.Equal(new[] { Sincronizacao }, retomada.Aplicadas);
        Assert.Equal(new[] { Inicial, Sincronizacao }, Historico(caminho));
        Assert.Empty(EsquemaDoModeloAtual().DiferencasEm(LerEsquema(caminho)));
    }

    // ---------- 7. Backup e restauração ----------

    [Fact]
    public void Backup_EValidado_Restauravel_EAdulteracaoEDetectada()
    {
        var pasta = NovaPasta("backup");
        var caminho = CriarLegado(pasta, "G2", comTabelaUsers: true);
        var dadosOriginais = Retrato(caminho);

        var backup = BackupSqlite.CriarEValidar(caminho, Path.Combine(pasta, "backups"), "teste");

        Assert.False(File.Exists(backup.Caminho + "-wal"));                  // arquivo único e autocontido
        // Restauração: copiar o backup para o lugar do banco (procedimento documentado)
        var restaurado = Path.Combine(NovaPasta("restaurado"), "pdv.db");
        Directory.CreateDirectory(Path.GetDirectoryName(restaurado)!);
        File.Copy(backup.Caminho, restaurado);
        Assert.Equal(dadosOriginais, Retrato(restaurado));
        Assert.Equal(SituacaoBanco.LegadoReconhecido, Diagnosticar(restaurado).Situacao);

        // Backup adulterado (dado alterado) é reprovado
        var adulterado = Path.Combine(pasta, "adulterado.db");
        File.Copy(backup.Caminho, adulterado);
        using (var c = Abrir(adulterado)) { c.Open(); Sql(c, "UPDATE \"Produtos\" SET \"PrecoVenda\" = '0.01';"); }
        var erroDados = Assert.Throws<InvalidDataException>(() => BackupSqlite.Validar(adulterado, backup.Esquema, backup.Assinatura));
        Assert.Contains("Produtos", erroDados.Message);

        // Backup truncado/corrompido é reprovado
        var truncado = Path.Combine(pasta, "truncado.db");
        var bytes = File.ReadAllBytes(backup.Caminho);
        File.WriteAllBytes(truncado, bytes[..(bytes.Length / 2)]);
        Assert.ThrowsAny<Exception>(() => BackupSqlite.Validar(truncado, backup.Esquema, backup.Assinatura));
    }

    // ---------- Trava entre instâncias ----------

    [Fact]
    public void TravaOcupada_OutraInstanciaNaoAltera_ELiberadaPermiteAtualizar()
    {
        var pasta = NovaPasta("trava");
        var caminho = CriarLegado(pasta, "G1");
        var hash = Hash(caminho);

        using (new FileStream(caminho + ".migracao.lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None, 1, FileOptions.DeleteOnClose))
        {
            var erro = Assert.Throws<MigracaoBancoException>(() => Migrar(caminho, TimeSpan.FromSeconds(1)));
            Assert.Equal(EtapaMigracao.Trava, erro.Etapa);
            Assert.Contains("Outra instância", erro.Message);
            SqliteConnection.ClearAllPools();
            Assert.Equal(hash, Hash(caminho));
        }

        Assert.True(MigrarAutorizado(caminho).HouveAlteracao);
    }

    [Fact]
    public async Task DuasInicializacoesSimultaneas_ApenasUmaAtualiza()
    {
        var pasta = NovaPasta("simultaneas");
        var caminho = CriarLegado(pasta, "G1");

        var resultados = await Task.WhenAll(
            Task.Run(() => MigrarAutorizado(caminho, TimeSpan.FromSeconds(30))),
            Task.Run(() => MigrarAutorizado(caminho, TimeSpan.FromSeconds(30))));

        Assert.Single(resultados, r => r.HouveAlteracao);
        Assert.Single(resultados, r => !r.HouveAlteracao);
        Assert.Single(BancosDeTeste.Backups(pasta));
        Assert.Equal(new[] { Inicial, Sincronizacao }, Historico(caminho));
    }

    // ---------- utilitários ----------

    private static EsquemaSqlite EsquemaDoModeloAtual()
    {
        using var c = new SqliteConnection("Data Source=:memory:");
        c.Open();
        using (var ctx = new PdvDbContext(new DbContextOptionsBuilder<PdvDbContext>().UseSqlite(c).Options))
            ctx.Database.EnsureCreated();
        return EsquemaSqlite.Ler(c);
    }

    private static EsquemaSqlite LerEsquemaDeDdl(string geracao) => EsquemaDeDdl(Ddl(geracao));

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        try { if (Directory.Exists(_pasta)) Directory.Delete(_pasta, recursive: true); } catch { /* temporário */ }
    }
}
