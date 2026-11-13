using Microsoft.Data.Sqlite;

namespace PDV.Infrastructure.Persistence;

public sealed record ColunaSqlite(string Nome, string Tipo, bool NaoNula, string? Padrao, int PosicaoChavePrimaria);
public sealed record IndiceSqlite(string Nome, bool Unico, string Colunas);
public sealed record ChaveEstrangeiraSqlite(string Coluna, string TabelaDestino, string ColunaDestino, string AoExcluir);

public sealed record TabelaSqlite(
    string Nome,
    IReadOnlyDictionary<string, ColunaSqlite> Colunas,
    IReadOnlyList<IndiceSqlite> Indices,
    IReadOnlyList<ChaveEstrangeiraSqlite> ChavesEstrangeiras);

/// <summary>
/// Retrato do esquema real de um banco SQLite (tabelas, colunas, índices e chaves estrangeiras),
/// lido pelos PRAGMAs do próprio SQLite. Usado para reconhecer bancos antigos e detectar divergências.
/// A ordem das colunas é ignorada: ADD COLUMN sempre acrescenta ao final da tabela.
/// </summary>
public sealed class EsquemaSqlite
{
    public const string TabelaHistorico = "__EFMigrationsHistory";

    public IReadOnlyDictionary<string, TabelaSqlite> Tabelas { get; }

    private EsquemaSqlite(IReadOnlyDictionary<string, TabelaSqlite> tabelas)
    {
        Tabelas = tabelas;
    }

    public static bool TabelaInterna(string nome) =>
        nome.StartsWith("sqlite_", StringComparison.OrdinalIgnoreCase) ||
        nome.StartsWith("__EFMigrations", StringComparison.OrdinalIgnoreCase);

    /// <summary>Tabelas de dados (sem as internas do SQLite nem as de controle do EF).</summary>
    public IEnumerable<string> TabelasDeDados => Tabelas.Keys.Where(t => !TabelaInterna(t)).OrderBy(t => t, StringComparer.Ordinal);

    public bool PossuiHistorico => Tabelas.ContainsKey(TabelaHistorico);

    public static EsquemaSqlite Ler(SqliteConnection conexao)
    {
        var tabelas = new Dictionary<string, TabelaSqlite>(StringComparer.Ordinal);
        foreach (var nome in Consultar(conexao, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").Select(l => l[0]!))
        {
            var colunas = Consultar(conexao, $"PRAGMA table_xinfo(\"{nome}\")")
                .Select(l => new ColunaSqlite(l[1]!, (l[2] ?? "").ToUpperInvariant(), l[3] == "1", NormalizarPadrao(l[4]), int.Parse(l[5]!)))
                .ToDictionary(c => c.Nome, StringComparer.Ordinal);

            var indices = Consultar(conexao, $"PRAGMA index_list(\"{nome}\")")
                .Where(l => !l[1]!.StartsWith("sqlite_autoindex_", StringComparison.Ordinal)) // índices implícitos da PK/UNIQUE
                .Select(l => new IndiceSqlite(l[1]!, l[2] == "1",
                    string.Join(",", Consultar(conexao, $"PRAGMA index_info(\"{l[1]}\")").Select(c => c[2]))))
                .OrderBy(i => i.Nome, StringComparer.Ordinal)
                .ToList();

            var fks = Consultar(conexao, $"PRAGMA foreign_key_list(\"{nome}\")")
                .Select(l => new ChaveEstrangeiraSqlite(l[3]!, l[2]!, l[4]!, l[6]!))
                .OrderBy(f => f.Coluna, StringComparer.Ordinal)
                .ToList();

            tabelas[nome] = new TabelaSqlite(nome, colunas, indices, fks);
        }
        return new EsquemaSqlite(tabelas);
    }

    /// <summary>
    /// Diferenças entre este esquema (referência) e o banco real, considerando apenas as tabelas da referência.
    /// Tabelas que existem só no banco real não são diferenças (ver <see cref="TabelasExtrasEm"/>).
    /// </summary>
    public IReadOnlyList<string> DiferencasEm(EsquemaSqlite real)
    {
        var diferencas = new List<string>();
        foreach (var nome in TabelasDeDados)
        {
            var esperada = Tabelas[nome];
            if (!real.Tabelas.TryGetValue(nome, out var atual))
            {
                diferencas.Add($"Tabela ausente: {nome}");
                continue;
            }

            foreach (var coluna in esperada.Colunas.Values.OrderBy(c => c.Nome, StringComparer.Ordinal))
            {
                if (!atual.Colunas.TryGetValue(coluna.Nome, out var colunaReal))
                    diferencas.Add($"Coluna ausente: {nome}.{coluna.Nome}");
                else if (colunaReal != coluna)
                    diferencas.Add($"Coluna diferente: {nome}.{coluna.Nome} (esperado {Descrever(coluna)}; encontrado {Descrever(colunaReal)})");
            }

            foreach (var extra in atual.Colunas.Keys.Except(esperada.Colunas.Keys).OrderBy(c => c, StringComparer.Ordinal))
                diferencas.Add($"Coluna não reconhecida: {nome}.{extra}");

            foreach (var indice in esperada.Indices.Except(atual.Indices))
                diferencas.Add($"Índice ausente ou diferente: {nome}.{indice.Nome} ({(indice.Unico ? "único " : "")}{indice.Colunas})");
            foreach (var indice in atual.Indices.Except(esperada.Indices))
                diferencas.Add($"Índice não reconhecido: {nome}.{indice.Nome} ({indice.Colunas})");

            if (!esperada.ChavesEstrangeiras.SequenceEqual(atual.ChavesEstrangeiras))
                diferencas.Add($"Chaves estrangeiras diferentes em {nome}");
        }
        return diferencas;
    }

    public IReadOnlyList<string> TabelasExtrasEm(EsquemaSqlite real) =>
        real.TabelasDeDados.Except(TabelasDeDados, StringComparer.Ordinal).ToList();

    /// <summary>Igualdade completa (inclusive tabelas extras e histórico), usada para validar backups.</summary>
    public bool Igual(EsquemaSqlite outro) =>
        Tabelas.Count == outro.Tabelas.Count &&
        Tabelas.All(t => outro.Tabelas.TryGetValue(t.Key, out var o) &&
                         t.Value.Colunas.Count == o.Colunas.Count &&
                         t.Value.Colunas.All(c => o.Colunas.TryGetValue(c.Key, out var oc) && oc == c.Value) &&
                         t.Value.Indices.SequenceEqual(o.Indices) &&
                         t.Value.ChavesEstrangeiras.SequenceEqual(o.ChavesEstrangeiras));

    private static string Descrever(ColunaSqlite c) =>
        $"{c.Tipo}{(c.NaoNula ? " NOT NULL" : "")}{(c.Padrao != null ? $" DEFAULT {c.Padrao}" : "")}{(c.PosicaoChavePrimaria > 0 ? " PK" : "")}";

    private static string? NormalizarPadrao(string? padrao)
    {
        if (padrao == null) return null;
        var p = padrao.Trim();
        while (p.Length >= 2 && p[0] == '(' && p[^1] == ')') p = p[1..^1].Trim();
        return p;
    }

    internal static List<string?[]> Consultar(SqliteConnection conexao, string sql)
    {
        var linhas = new List<string?[]>();
        using var comando = conexao.CreateCommand();
        comando.CommandText = sql;
        using var leitor = comando.ExecuteReader();
        while (leitor.Read())
        {
            var valores = new string?[leitor.FieldCount];
            for (var i = 0; i < valores.Length; i++)
                valores[i] = leitor.IsDBNull(i) ? null : Convert.ToString(leitor.GetValue(i), System.Globalization.CultureInfo.InvariantCulture);
            linhas.Add(valores);
        }
        return linhas;
    }
}
