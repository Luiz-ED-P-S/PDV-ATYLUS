using System.Collections.Concurrent;
using System.Text;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Logging;
using PDV.Infrastructure.Context;

namespace PDV.Infrastructure.Persistence;

public enum SituacaoBanco
{
    /// <summary>Arquivo inexistente ou sem tabelas: será criado pelas migrations.</summary>
    Novo,
    /// <summary>Já possui histórico de migrations coerente com o esquema.</summary>
    Gerenciado,
    /// <summary>Criado por EnsureCreated() em uma geração conhecida: recebe baseline e segue pelas migrations.</summary>
    LegadoReconhecido,
    /// <summary>Esquema desconhecido, divergente, corrompido ou de versão mais nova: nada é alterado.</summary>
    Incompativel
}

public enum EtapaMigracao { Trava, Diagnostico, Backup, Baseline, Migracao, ValidacaoFinal }

public sealed record DiagnosticoBanco(
    SituacaoBanco Situacao,
    string Banco,
    string? GeracaoLegada,
    IReadOnlyList<string> MigracoesAplicadas,
    IReadOnlyList<string> MigracoesPendentes,
    IReadOnlyList<string> TabelasExtras,
    IReadOnlyList<string> Problemas)
{
    public string Relatorio()
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Banco: {Banco}");
        sb.AppendLine($"Situação: {Situacao}" + (GeracaoLegada != null ? $" (equivale a {GeracaoLegada})" : ""));
        var rotuloAplicadas = Situacao == SituacaoBanco.LegadoReconhecido
            ? "Migrations equivalentes ao esquema atual (serão registradas como baseline, sem recriar tabelas)"
            : "Migrations aplicadas";
        sb.AppendLine($"{rotuloAplicadas}: {(MigracoesAplicadas.Count == 0 ? "nenhuma" : string.Join(", ", MigracoesAplicadas))}");
        sb.AppendLine($"Migrations pendentes: {(MigracoesPendentes.Count == 0 ? "nenhuma" : string.Join(", ", MigracoesPendentes))}");
        if (TabelasExtras.Count > 0) sb.AppendLine($"Tabelas não gerenciadas (preservadas): {string.Join(", ", TabelasExtras)}");
        foreach (var p in Problemas) sb.AppendLine($"PROBLEMA: {p}");
        return sb.ToString();
    }
}

public sealed record ResultadoMigracao(DiagnosticoBanco Antes, string? Backup, IReadOnlyList<string> Aplicadas, bool HouveAlteracao);

public class MigracaoBancoException : Exception
{
    public EtapaMigracao Etapa { get; }
    public string? CaminhoBackup { get; }

    public MigracaoBancoException(EtapaMigracao etapa, string mensagem, string? caminhoBackup = null, Exception? interna = null)
        : base(mensagem, interna)
    {
        Etapa = etapa;
        CaminhoBackup = caminhoBackup;
    }
}

public sealed class OpcoesMigracaoBanco
{
    /// <summary>Tempo máximo de espera pela trava quando outra instância está atualizando o banco.</summary>
    public TimeSpan EsperaTrava { get; init; } = TimeSpan.FromSeconds(60);
}

/// <summary>
/// Substitui o EnsureCreated(): cria bancos novos pelas migrations e atualiza bancos existentes com segurança.
/// Sequência: trava exclusiva → diagnóstico (integridade + reconhecimento do esquema) → backup validado →
/// baseline (bancos criados por EnsureCreated) → Migrate() → validação final (esquema e preservação dos dados).
/// Qualquer falha interrompe a inicialização sem alterar o banco ou com a migration em andamento desfeita.
/// </summary>
public sealed class MigradorBancoDados
{
    /// <summary>
    /// Migrations que correspondem a esquemas criados por EnsureCreated() em versões anteriores (G1 e G2).
    /// Apenas elas podem ser registradas por baseline; migrations futuras sempre serão executadas.
    /// </summary>
    public static readonly IReadOnlyList<string> MigracoesLegadas = new[]
    {
        IdDaMigracao(typeof(Migrations.EsquemaInicial)),             // G1: commits 1b7c27a..d88c7f3 (22/10 a 03/11)
        IdDaMigracao(typeof(Migrations.SincronizacaoMultiTerminal))  // G2: commit 6b1fa3b em diante (04/11)
    };

    private static string IdDaMigracao(Type migracao) =>
        System.Reflection.CustomAttributeExtensions.GetCustomAttribute<MigrationAttribute>(migracao)!.Id;

    private static readonly ConcurrentDictionary<string, EsquemaSqlite> CacheReferencias = new();

    private readonly PdvDbContext _contexto;
    private readonly ILogger<MigradorBancoDados> _logger;
    private readonly OpcoesMigracaoBanco _opcoes;

    public MigradorBancoDados(PdvDbContext contexto, ILogger<MigradorBancoDados> logger, OpcoesMigracaoBanco? opcoes = null)
    {
        _contexto = contexto;
        _logger = logger;
        _opcoes = opcoes ?? new OpcoesMigracaoBanco();
    }

    private IReadOnlyList<string> MigracoesConhecidas => _contexto.Database.GetMigrations().ToList();

    private string? CaminhoArquivo
    {
        get
        {
            var fonte = new SqliteConnectionStringBuilder(_contexto.Database.GetConnectionString()).DataSource;
            if (string.IsNullOrWhiteSpace(fonte) || fonte == ":memory:" || fonte.StartsWith("file::memory:", StringComparison.OrdinalIgnoreCase))
                return null;
            return Path.GetFullPath(fonte);
        }
    }

    /// <summary>Diagnóstico somente leitura (usado também por --verificar-banco). Nunca altera o banco.</summary>
    public DiagnosticoBanco Diagnosticar()
    {
        var conhecidas = MigracoesConhecidas;
        var caminho = CaminhoArquivo ?? ":memory:";

        if (CaminhoArquivo == null || !File.Exists(CaminhoArquivo))
            return new DiagnosticoBanco(SituacaoBanco.Novo, caminho, null, Array.Empty<string>(), conhecidas, Array.Empty<string>(), Array.Empty<string>());

        using var conexao = new SqliteConnection(BackupSqlite.ConexaoArquivo(CaminhoArquivo, somenteLeitura: true));
        conexao.Open();

        var integridade = string.Join("; ", EsquemaSqlite.Consultar(conexao, "PRAGMA quick_check").Select(l => l[0]));
        if (!string.Equals(integridade, "ok", StringComparison.OrdinalIgnoreCase))
            return Incompativel(caminho, $"Verificação de integridade falhou: {integridade}");

        var real = EsquemaSqlite.Ler(conexao);
        var aplicadas = real.PossuiHistorico
            ? EsquemaSqlite.Consultar(conexao, $"SELECT MigrationId FROM \"{EsquemaSqlite.TabelaHistorico}\" ORDER BY MigrationId").Select(l => l[0]!).ToList()
            : new List<string>();

        if (!real.TabelasDeDados.Any() && aplicadas.Count == 0)
            return new DiagnosticoBanco(SituacaoBanco.Novo, caminho, null, aplicadas, conhecidas, Array.Empty<string>(), Array.Empty<string>());

        if (aplicadas.Count > 0)
        {
            var desconhecidas = aplicadas.Except(conhecidas).ToList();
            if (desconhecidas.Count > 0)
                return Incompativel(caminho, $"O banco foi atualizado por uma versão mais nova do PDV (migrations desconhecidas: {string.Join(", ", desconhecidas)}).", aplicadas);

            var referencia = EsquemaApos(aplicadas.Last());
            var divergencias = referencia.DiferencasEm(real);
            if (divergencias.Count > 0)
                return Incompativel(caminho, divergencias.Prepend("O esquema diverge do histórico de migrations registrado.").ToArray(), aplicadas);

            return new DiagnosticoBanco(SituacaoBanco.Gerenciado, caminho, null, aplicadas,
                conhecidas.Except(aplicadas).ToList(), referencia.TabelasExtrasEm(real), Array.Empty<string>());
        }

        // Sem histórico: banco criado por EnsureCreated(). Procura a geração conhecida idêntica (da mais nova à mais antiga).
        IReadOnlyList<string> menorDivergencia = Array.Empty<string>();
        foreach (var candidata in MigracoesLegadas.Reverse())
        {
            var referencia = EsquemaApos(candidata);
            var divergencias = referencia.DiferencasEm(real);
            if (divergencias.Count == 0)
            {
                var equivalentes = conhecidas.TakeWhile(m => string.CompareOrdinal(m, candidata) <= 0).ToList();
                return new DiagnosticoBanco(SituacaoBanco.LegadoReconhecido, caminho, candidata, equivalentes,
                    conhecidas.Except(equivalentes).ToList(), referencia.TabelasExtrasEm(real), Array.Empty<string>());
            }
            if (menorDivergencia.Count == 0 || divergencias.Count < menorDivergencia.Count)
                menorDivergencia = divergencias;
        }

        return Incompativel(caminho, menorDivergencia
            .Prepend("O esquema não corresponde a nenhuma versão conhecida do PDV criada sem migrations.").ToArray());
    }

    /// <summary>Cria ou atualiza o banco. Lança <see cref="MigracaoBancoException"/> com mensagem clara em qualquer falha.</summary>
    public ResultadoMigracao Executar()
    {
        if (CaminhoArquivo == null)
        {
            var antesMemoria = Diagnosticar();
            _contexto.Database.Migrate();
            return new ResultadoMigracao(antesMemoria, null, antesMemoria.MigracoesPendentes, antesMemoria.MigracoesPendentes.Count > 0);
        }

        var caminho = CaminhoArquivo;
        Directory.CreateDirectory(Path.GetDirectoryName(caminho)!);

        using var trava = AdquirirTrava(caminho);

        var antes = Etapa(EtapaMigracao.Diagnostico, null, Diagnosticar);
        foreach (var extra in antes.TabelasExtras)
            _logger.LogWarning("Tabela não gerenciada pelo PDV encontrada e preservada: {Tabela}", extra);

        switch (antes.Situacao)
        {
            case SituacaoBanco.Incompativel:
                throw new MigracaoBancoException(EtapaMigracao.Diagnostico,
                    $"O banco '{caminho}' não pode ser atualizado automaticamente e NÃO foi alterado.{Environment.NewLine}" +
                    string.Join(Environment.NewLine, antes.Problemas.Select(p => " - " + p)) + Environment.NewLine +
                    "Execute o PDV com --verificar-banco para o relatório completo e consulte docs/BANCO_DE_DADOS_MIGRATIONS.md.");

            case SituacaoBanco.Gerenciado when antes.MigracoesPendentes.Count == 0:
                return new ResultadoMigracao(antes, null, Array.Empty<string>(), false);

            case SituacaoBanco.Novo:
                _logger.LogInformation("Criando banco novo por migrations em {Banco}.", caminho);
                Etapa(EtapaMigracao.Migracao, null, () => _contexto.Database.Migrate());
                ValidarFinal(caminho, null, null);
                return new ResultadoMigracao(antes, null, antes.MigracoesPendentes, true);
        }

        // Banco com dados: backup validado antes de qualquer alteração
        var rotulo = antes.Situacao == SituacaoBanco.LegadoReconhecido ? "legado" : NomeCurto(antes.MigracoesAplicadas.LastOrDefault());
        var backup = Etapa(EtapaMigracao.Backup, null, () =>
            BackupSqlite.CriarEValidar(caminho, Path.Combine(Path.GetDirectoryName(caminho)!, "backups"), rotulo));
        _logger.LogWarning("Backup validado criado antes da atualização do banco: {Backup}", backup.Caminho);

        // Projeção dos dados originais (somente tabelas de dados), para comparar após a migração
        var projecaoOriginal = backup.Assinatura.Projecao()
            .Where(t => !EsquemaSqlite.TabelaInterna(t.Key))
            .ToDictionary(t => t.Key, t => t.Value, StringComparer.Ordinal);

        if (antes.Situacao == SituacaoBanco.LegadoReconhecido)
        {
            Etapa(EtapaMigracao.Baseline, backup.Caminho, () => RegistrarBaseline(caminho, antes.MigracoesAplicadas));
            _logger.LogWarning("Banco criado sem migrations reconhecido como {Geracao}; baseline registrado: {Migracoes}.",
                antes.GeracaoLegada, string.Join(", ", antes.MigracoesAplicadas));
        }

        if (antes.MigracoesPendentes.Count > 0)
        {
            _logger.LogWarning("Aplicando migrations pendentes em {Banco}: {Migracoes}", caminho, string.Join(", ", antes.MigracoesPendentes));
            Etapa(EtapaMigracao.Migracao, backup.Caminho, () => _contexto.Database.Migrate());
        }

        ValidarFinal(caminho, backup, projecaoOriginal);
        _logger.LogInformation("Banco atualizado com sucesso. Backup anterior: {Backup}", backup.Caminho);
        return new ResultadoMigracao(antes, backup.Caminho, antes.MigracoesPendentes, true);
    }

    private void ValidarFinal(string caminho, ResultadoBackup? backup, IReadOnlyDictionary<string, IReadOnlyList<string>>? projecaoOriginal)
    {
        var depois = Diagnosticar();
        if (depois.Situacao != SituacaoBanco.Gerenciado || depois.MigracoesPendentes.Count > 0)
            throw Falha(EtapaMigracao.ValidacaoFinal, backup?.Caminho,
                $"após a atualização o banco ficou em situação {depois.Situacao} com pendências: {string.Join(", ", depois.MigracoesPendentes.Concat(depois.Problemas))}");

        if (backup == null || projecaoOriginal == null) return;

        using var conexao = new SqliteConnection(BackupSqlite.ConexaoArquivo(caminho, somenteLeitura: true));
        conexao.Open();
        var diferencas = new AssinaturaDadosComparador(backup.Assinatura, projecaoOriginal).Comparar(conexao);
        if (diferencas.Count > 0)
            throw Falha(EtapaMigracao.ValidacaoFinal, backup.Caminho,
                $"os dados existentes não foram preservados integralmente: {string.Join("; ", diferencas)}");
    }

    private sealed class AssinaturaDadosComparador
    {
        private readonly AssinaturaDados _antes;
        private readonly IReadOnlyDictionary<string, IReadOnlyList<string>> _projecao;

        public AssinaturaDadosComparador(AssinaturaDados antes, IReadOnlyDictionary<string, IReadOnlyList<string>> projecao)
        {
            _antes = antes;
            _projecao = projecao;
        }

        public IReadOnlyList<string> Comparar(SqliteConnection conexao)
        {
            var depois = AssinaturaDados.Ler(conexao, _projecao);
            var diferencas = new List<string>();
            foreach (var (tabela, _) in _projecao)
            {
                var a = _antes.Tabelas[tabela];
                var d = depois.Tabelas[tabela];
                if (a.Linhas != d.Linhas) diferencas.Add($"{tabela}: {a.Linhas} linha(s) antes, {d.Linhas} depois");
                else if (a.Hash != d.Hash) diferencas.Add($"{tabela}: conteúdo alterado");
            }
            return diferencas;
        }
    }

    private void RegistrarBaseline(string caminho, IReadOnlyList<string> migracoes)
    {
        var historico = _contexto.GetService<IHistoryRepository>();
        var versao = ProductInfo.GetVersion();

        using var conexao = new SqliteConnection(BackupSqlite.ConexaoArquivo(caminho));
        conexao.Open();
        using var transacao = conexao.BeginTransaction();
        Executar(conexao, transacao, historico.GetCreateIfNotExistsScript());
        foreach (var migracao in migracoes)
            Executar(conexao, transacao, historico.GetInsertScript(new HistoryRow(migracao, versao)));
        transacao.Commit();
    }

    private static void Executar(SqliteConnection conexao, SqliteTransaction transacao, string sql)
    {
        using var comando = conexao.CreateCommand();
        comando.Transaction = transacao;
        comando.CommandText = sql;
        comando.ExecuteNonQuery();
    }

    /// <summary>Esquema resultante de aplicar as migrations até <paramref name="migracao"/> em um banco vazio em memória.</summary>
    public EsquemaSqlite EsquemaApos(string migracao) =>
        CacheReferencias.GetOrAdd(migracao, alvo =>
        {
            using var conexao = new SqliteConnection("Data Source=:memory:");
            conexao.Open();
            using (var ctx = new PdvDbContext(new DbContextOptionsBuilder<PdvDbContext>().UseSqlite(conexao).Options))
                ctx.GetService<IMigrator>().Migrate(alvo);
            return EsquemaSqlite.Ler(conexao);
        });

    private FileStream AdquirirTrava(string caminhoBanco)
    {
        var arquivoTrava = caminhoBanco + ".migracao.lock";
        var limite = DateTime.UtcNow + _opcoes.EsperaTrava;
        var avisou = false;
        while (true)
        {
            try
            {
                return new FileStream(arquivoTrava, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None, 1, FileOptions.DeleteOnClose);
            }
            catch (IOException) when (DateTime.UtcNow < limite)
            {
                if (!avisou)
                {
                    _logger.LogWarning("Outra instância do PDV está verificando/atualizando o banco {Banco}. Aguardando...", caminhoBanco);
                    avisou = true;
                }
                Thread.Sleep(250);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                throw new MigracaoBancoException(EtapaMigracao.Trava,
                    $"Não foi possível obter acesso exclusivo para atualizar o banco '{caminhoBanco}' em {_opcoes.EsperaTrava.TotalSeconds:0}s. " +
                    "Outra instância do PDV pode estar atualizando o mesmo banco. Aguarde a conclusão ou encerre a outra instância e tente novamente. " +
                    "O banco NÃO foi alterado.", interna: ex);
            }
        }
    }

    private T Etapa<T>(EtapaMigracao etapa, string? backup, Func<T> acao)
    {
        try { return acao(); }
        catch (MigracaoBancoException) { throw; }
        catch (Exception ex) { throw Falha(etapa, backup, ex.Message, ex); }
    }

    private void Etapa(EtapaMigracao etapa, string? backup, Action acao) =>
        Etapa(etapa, backup, () => { acao(); return true; });

    private MigracaoBancoException Falha(EtapaMigracao etapa, string? backup, string detalhe, Exception? interna = null)
    {
        var mensagem = new StringBuilder($"A atualização do banco falhou na etapa {etapa}: {detalhe}");
        mensagem.AppendLine();
        if (etapa == EtapaMigracao.Backup)
            mensagem.AppendLine("O banco NÃO foi alterado (o backup não pôde ser criado ou validado).");
        else if (backup != null)
        {
            mensagem.AppendLine("A migration em andamento foi desfeita pela transação; migrations concluídas antes dela permanecem registradas e a atualização será retomada na próxima inicialização.");
            mensagem.AppendLine($"Backup validado do estado anterior: {backup}");
        }
        mensagem.Append("O PDV não será iniciado até a causa ser corrigida. Veja docs/BANCO_DE_DADOS_MIGRATIONS.md (recuperação).");
        return new MigracaoBancoException(etapa, mensagem.ToString(), backup, interna);
    }

    private static DiagnosticoBanco Incompativel(string caminho, string problema, IReadOnlyList<string>? aplicadas = null) =>
        Incompativel(caminho, new[] { problema }, aplicadas);

    private static DiagnosticoBanco Incompativel(string caminho, IReadOnlyList<string> problemas, IReadOnlyList<string>? aplicadas = null) =>
        new(SituacaoBanco.Incompativel, caminho, null, aplicadas ?? Array.Empty<string>(), Array.Empty<string>(), Array.Empty<string>(), problemas);

    private static string NomeCurto(string? migracao) =>
        migracao == null ? "vazio" : migracao.Contains('_') ? migracao[(migracao.IndexOf('_') + 1)..] : migracao;
}
