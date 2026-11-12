using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.Sqlite;

namespace PDV.Infrastructure.Persistence;

/// <summary>Contagem e hash do conteúdo de cada tabela, considerando um conjunto fixo de colunas.</summary>
public sealed class AssinaturaDados
{
    public IReadOnlyDictionary<string, (long Linhas, string Hash, IReadOnlyList<string> Colunas)> Tabelas { get; }

    internal AssinaturaDados(Dictionary<string, (long, string, IReadOnlyList<string>)> tabelas)
    {
        Tabelas = tabelas;
    }

    /// <summary>
    /// Lê a assinatura das tabelas de dados. Com <paramref name="colunasPorTabela"/>, usa apenas essas colunas
    /// (permite comparar o conteúdo original de uma tabela que recebeu novas colunas).
    /// </summary>
    public static AssinaturaDados Ler(SqliteConnection conexao, IReadOnlyDictionary<string, IReadOnlyList<string>>? colunasPorTabela = null)
    {
        var esquema = EsquemaSqlite.Ler(conexao);
        var resultado = new Dictionary<string, (long, string, IReadOnlyList<string>)>(StringComparer.Ordinal);
        var tabelas = colunasPorTabela?.Keys ?? esquema.Tabelas.Keys.Where(t => !t.StartsWith("sqlite_", StringComparison.OrdinalIgnoreCase));

        foreach (var tabela in tabelas.OrderBy(t => t, StringComparer.Ordinal))
        {
            var colunas = colunasPorTabela?[tabela]
                          ?? esquema.Tabelas[tabela].Colunas.Keys.OrderBy(c => c, StringComparer.Ordinal).ToList();
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            long linhas = 0;
            using var comando = conexao.CreateCommand();
            comando.CommandText = $"SELECT {string.Join(", ", colunas.Select(c => $"\"{c}\""))} FROM \"{tabela}\" ORDER BY rowid";
            using var leitor = comando.ExecuteReader();
            while (leitor.Read())
            {
                linhas++;
                for (var i = 0; i < leitor.FieldCount; i++)
                {
                    var valor = leitor.IsDBNull(i) ? "\u0000NULL" : Convert.ToString(leitor.GetValue(i), CultureInfo.InvariantCulture);
                    hash.AppendData(Encoding.UTF8.GetBytes($"{leitor.GetFieldType(i).Name}:{valor}\u001F"));
                }
                hash.AppendData("\u001E"u8);
            }
            resultado[tabela] = (linhas, Convert.ToHexString(hash.GetHashAndReset()), colunas);
        }
        return new AssinaturaDados(resultado);
    }

    /// <summary>Colunas consideradas em cada tabela (para reler a mesma projeção depois da migração).</summary>
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Projecao() =>
        Tabelas.ToDictionary(t => t.Key, t => t.Value.Colunas, StringComparer.Ordinal);

    public IReadOnlyList<string> DiferencasEm(AssinaturaDados outra)
    {
        var diferencas = new List<string>();
        foreach (var (tabela, (linhas, hash, _)) in Tabelas)
        {
            if (!outra.Tabelas.TryGetValue(tabela, out var o))
                diferencas.Add($"Tabela ausente: {tabela}");
            else if (o.Linhas != linhas)
                diferencas.Add($"{tabela}: {linhas} linha(s) esperadas, {o.Linhas} encontradas");
            else if (o.Hash != hash)
                diferencas.Add($"{tabela}: conteúdo diferente");
        }
        return diferencas;
    }
}

public sealed record ResultadoBackup(string Caminho, AssinaturaDados Assinatura, EsquemaSqlite Esquema);

/// <summary>
/// Backup consistente pela API de backup online do SQLite (inclui o conteúdo ainda no WAL),
/// seguido de validação completa antes de qualquer alteração no banco original.
/// </summary>
public static class BackupSqlite
{
    public static string ConexaoArquivo(string caminho, bool somenteLeitura = false) =>
        new SqliteConnectionStringBuilder
        {
            DataSource = caminho,
            Mode = somenteLeitura ? SqliteOpenMode.ReadOnly : SqliteOpenMode.ReadWrite,
            Pooling = false
        }.ToString();

    public static ResultadoBackup CriarEValidar(string caminhoBanco, string pastaBackups, string rotulo)
    {
        Directory.CreateDirectory(pastaBackups);
        VerificarEspacoLivre(caminhoBanco, pastaBackups);

        var destino = Path.Combine(pastaBackups, $"pdv-antes-migracao-{rotulo}-{DateTime.Now:yyyyMMdd-HHmmss-fff}.db");

        EsquemaSqlite esquemaOrigem;
        AssinaturaDados assinaturaOrigem;
        using (var origem = new SqliteConnection(ConexaoArquivo(caminhoBanco)))
        using (var copia = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = destino, Mode = SqliteOpenMode.ReadWriteCreate, Pooling = false }.ToString()))
        {
            origem.Open();
            copia.Open();
            esquemaOrigem = EsquemaSqlite.Ler(origem);
            assinaturaOrigem = AssinaturaDados.Ler(origem);
            origem.BackupDatabase(copia);

            // Backup autocontido em um único arquivo (sem -wal/-shm)
            using var comando = copia.CreateCommand();
            comando.CommandText = "PRAGMA journal_mode=DELETE;";
            comando.ExecuteNonQuery();
        }

        Validar(destino, esquemaOrigem, assinaturaOrigem);
        return new ResultadoBackup(destino, assinaturaOrigem, esquemaOrigem);
    }

    /// <summary>Lança <see cref="InvalidDataException"/> se o backup não for íntegro e idêntico à origem.</summary>
    public static void Validar(string caminhoBackup, EsquemaSqlite esquemaEsperado, AssinaturaDados assinaturaEsperada)
    {
        using var conexao = new SqliteConnection(ConexaoArquivo(caminhoBackup, somenteLeitura: true));
        conexao.Open();

        var integridade = string.Join("; ", EsquemaSqlite.Consultar(conexao, "PRAGMA integrity_check").Select(l => l[0]));
        if (!string.Equals(integridade, "ok", StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException($"Backup '{caminhoBackup}' reprovado na verificação de integridade: {integridade}");

        if (!esquemaEsperado.Igual(EsquemaSqlite.Ler(conexao)))
            throw new InvalidDataException($"Backup '{caminhoBackup}' com esquema diferente do banco original.");

        var diferencas = assinaturaEsperada.DiferencasEm(AssinaturaDados.Ler(conexao));
        if (diferencas.Count > 0)
            throw new InvalidDataException($"Backup '{caminhoBackup}' com dados diferentes do banco original: {string.Join("; ", diferencas)}");
    }

    private static void VerificarEspacoLivre(string caminhoBanco, string pastaBackups)
    {
        long tamanho = new FileInfo(caminhoBanco).Length;
        var wal = caminhoBanco + "-wal";
        if (File.Exists(wal)) tamanho += new FileInfo(wal).Length;

        try
        {
            var raiz = Path.GetPathRoot(Path.GetFullPath(pastaBackups));
            if (string.IsNullOrEmpty(raiz)) return;
            var livre = new DriveInfo(raiz).AvailableFreeSpace;
            if (livre < tamanho * 2)
                throw new IOException($"Espaço insuficiente para o backup em '{pastaBackups}': {livre} bytes livres, necessários {tamanho * 2}.");
        }
        catch (ArgumentException)
        {
            // Caminho de rede/UNC: o DriveInfo não se aplica; a falha de gravação, se houver, será tratada no backup.
        }
    }
}
