using System.Security.Cryptography;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using PDV.Infrastructure.Context;
using PDV.Infrastructure.Persistence;

namespace PDV.Tests.BancoDados;

/// <summary>
/// Cria bancos SQLite TEMPORÁRIOS idênticos aos que versões antigas do PDV geravam com EnsureCreated(),
/// usando o DDL histórico (Esquemas/G1.sql e G2.sql) e dados fictícios. Nunca usa bancos reais.
/// </summary>
public static class BancosDeTeste
{
    public const string Produto1 = "11111111-1111-1111-1111-111111111111";
    public const string Caixa1 = "22222222-2222-2222-2222-222222222222";
    public const string Venda1 = "33333333-3333-3333-3333-333333333333";
    public const string Venda2 = "44444444-4444-4444-4444-444444444444";

    public static string Ddl(string geracao)
    {
        using var recurso = typeof(BancosDeTeste).Assembly.GetManifestResourceStream($"PDV.Tests.BancoDados.Esquemas.{geracao}.sql")
                            ?? throw new InvalidOperationException($"Esquema {geracao} não encontrado");
        using var leitor = new StreamReader(recurso);
        return leitor.ReadToEnd();
    }

    public static SqliteConnection Abrir(string caminho, bool somenteLeitura = false) =>
        new(BackupSqlite.ConexaoArquivo(caminho, somenteLeitura));

    public static void Sql(SqliteConnection conexao, string sql)
    {
        using var comando = conexao.CreateCommand();
        comando.CommandText = sql;
        comando.ExecuteNonQuery();
    }

    /// <summary>Cria um banco legado (G1 ou G2) com dados fictícios em todas as tabelas principais.</summary>
    public static string CriarLegado(string pasta, string geracao, bool comTabelaUsers = false, string? ddlSubstituto = null, Action<SqliteConnection>? ajuste = null)
    {
        Directory.CreateDirectory(pasta);
        var caminho = Path.Combine(pasta, "pdv.db");
        using (var c = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = caminho, Pooling = false }.ToString()))
        {
            c.Open();
            Sql(c, ddlSubstituto ?? Ddl(geracao));
            Sql(c, "PRAGMA journal_mode=WAL;");

            var pinOperador = BCrypt.Net.BCrypt.HashPassword("0000");
            var pinSupervisor = BCrypt.Net.BCrypt.HashPassword("1234");
            Sql(c, $"""
                INSERT INTO "Produtos" ("Id","CodigoBarras","Nome","PrecoVenda","PrecoCusto","EstoqueAtual","EstoqueMinimo","Ativo","CriadoEm","AtualizadoEm") VALUES
                ('{Produto1}','7890000000011','Arroz 5kg','25.90','18.00','10','2',1,'2026-10-23 08:00:00',NULL),
                ('55555555-5555-5555-5555-555555555555','7890000000028','Feijão 1kg','8.50','5.10','30','5',1,'2026-10-23 08:00:00','2026-10-24 09:30:00'),
                ('66666666-6666-6666-6666-666666666666','7890000000035','Café 500g','18.90','12.50','0','3',0,'2026-10-23 08:00:00',NULL);
                INSERT INTO "Operadores" ("Id","Nome","Matricula","Pin","Perfil","Ativo","CriadoEm","AtualizadoEm") VALUES
                ('77777777-7777-7777-7777-777777777777','Operador Caixa 01','OP01','{pinOperador}',1,1,'2026-10-23 08:00:00',NULL),
                ('88888888-8888-8888-8888-888888888888','Gerente Geral','GER01','{pinSupervisor}',2,1,'2026-10-23 08:00:00',NULL);
                INSERT INTO "Caixas" ("Id","OperadorId","DataAbertura","DataFechamento","SaldoInicial","SaldoFinalInformado","Status","ObservacoesFechamento","CriadoEm","AtualizadoEm") VALUES
                ('{Caixa1}','OP01','2026-10-24 08:00:00',NULL,'100',NULL,1,NULL,'2026-10-24 08:00:00','2026-10-24 10:00:00');
                INSERT INTO "MovimentacoesCaixa" ("Id","CaixaId","Tipo","Valor","Motivo","OperadorId","DataHora","CriadoEm","AtualizadoEm") VALUES
                ('99999999-9999-9999-9999-999999999991','{Caixa1}',1,'100','Saldo inicial de abertura','OP01','2026-10-24 08:00:00','2026-10-24 08:00:00',NULL),
                ('99999999-9999-9999-9999-999999999992','{Caixa1}',2,'20.00','Retirada para cofre','OP01','2026-10-24 10:00:00','2026-10-24 10:00:00',NULL);
                """);

            var colunasExtrasVenda = geracao == "G2" ? ",\"TerminalId\",\"NumeroSequencial\"" : "";
            string Extras(string terminal, int numero) => geracao == "G2" ? $",'{terminal}',{numero}" : "";
            Sql(c, $"""
                INSERT INTO "Vendas" ("Id","CaixaId","OperadorId","DataVenda","ValorTotal","Desconto","Status","MotivoCancelamento","ClienteNome","ClienteDocumento","CriadoEm","AtualizadoEm"{colunasExtrasVenda}) VALUES
                ('{Venda1}','{Caixa1}','OP01','2026-10-24 09:00:00','51.80','0',1,NULL,'Cliente Fictício','000.000.000-00','2026-10-24 09:00:00',NULL{Extras("CX02", 7)}),
                ('{Venda2}','{Caixa1}','OP01','2026-10-24 09:30:00','25.90','0',2,'Desistência',NULL,NULL,'2026-10-24 09:30:00','2026-10-24 09:40:00'{Extras("CX02", 8)});
                INSERT INTO "ItensVenda" ("Id","VendaId","ProdutoId","ProdutoNome","CodigoBarras","Quantidade","PrecoUnitario","CriadoEm","AtualizadoEm") VALUES
                ('AAAAAAAA-0000-0000-0000-000000000001','{Venda1}','{Produto1}','Arroz 5kg','7890000000011','2','25.90','2026-10-24 09:00:00',NULL),
                ('AAAAAAAA-0000-0000-0000-000000000002','{Venda2}','{Produto1}','Arroz 5kg','7890000000011','1','25.90','2026-10-24 09:30:00',NULL);
                INSERT INTO "PagamentosVenda" ("Id","VendaId","FormaPagamento","Valor","Troco","TxId","CriadoEm","AtualizadoEm") VALUES
                ('BBBBBBBB-0000-0000-0000-000000000001','{Venda1}',1,'60.00','8.20',NULL,'2026-10-24 09:00:00',NULL),
                ('BBBBBBBB-0000-0000-0000-000000000002','{Venda2}',2,'25.90','0','PIX-LEGADO-0001','2026-10-24 09:30:00',NULL);
                """);

            if (geracao == "G2")
                Sql(c, $"""
                    INSERT INTO "FilaSincronizacao" ("Id","TerminalId","TipoEntidade","EntidadeId","Operacao","PayloadJson","Status","Tentativas","UltimaTentativaEm","MensagemErro","SincronizadoEm","CriadoEm","AtualizadoEm") VALUES
                    ('CCCCCCCC-0000-0000-0000-000000000001','CX02','Venda','{Venda1}','Criar','{"{"}"valor":51.80{"}"}',1,0,NULL,NULL,NULL,'2026-10-24 09:00:00',NULL);
                    """);

            if (comTabelaUsers)
                Sql(c, """
                    CREATE TABLE "Users" (
                        "Id" TEXT NOT NULL CONSTRAINT "PK_Users" PRIMARY KEY,
                        "Nome" TEXT NOT NULL, "Email" TEXT NOT NULL, "PasswordHash" TEXT NOT NULL,
                        "IsVerified" INTEGER NOT NULL DEFAULT 0, "VerificationCode" TEXT NULL,
                        "VerificationCodeExpiresAt" TEXT NULL, "VerifiedAt" TEXT NULL,
                        "CriadoEm" TEXT NOT NULL, "AtualizadoEm" TEXT NULL);
                    CREATE UNIQUE INDEX "IX_Users_Email" ON "Users" ("Email");
                    INSERT INTO "Users" VALUES ('DDDDDDDD-0000-0000-0000-000000000001','Usuário Fictício','ficticio@exemplo.test','hash-ficticio',1,NULL,NULL,NULL,'2026-11-05 10:00:00',NULL);
                    """);

            ajuste?.Invoke(c);
        }
        return caminho;
    }

    public static PdvDbContext Contexto(string caminho) =>
        new(new DbContextOptionsBuilder<PdvDbContext>().UseSqlite($"Data Source={caminho}").Options);

    public static MigradorBancoDados Migrador(PdvDbContext contexto, TimeSpan? esperaTrava = null) =>
        new(contexto, NullLogger<MigradorBancoDados>.Instance, new OpcoesMigracaoBanco { EsperaTrava = esperaTrava ?? TimeSpan.FromSeconds(5) });

    /// <summary>Executa a migração com um contexto próprio, como uma inicialização do PDV.</summary>
    public static ResultadoMigracao Migrar(string caminho, TimeSpan? esperaTrava = null)
    {
        using var ctx = Contexto(caminho);
        return Migrador(ctx, esperaTrava).Executar();
    }

    public static DiagnosticoBanco Diagnosticar(string caminho)
    {
        using var ctx = Contexto(caminho);
        return Migrador(ctx).Diagnosticar();
    }

    public static EsquemaSqlite LerEsquema(string caminho)
    {
        using var c = Abrir(caminho, somenteLeitura: true);
        c.Open();
        return EsquemaSqlite.Ler(c);
    }

    public static EsquemaSqlite EsquemaDeDdl(string ddl)
    {
        using var c = new SqliteConnection("Data Source=:memory:");
        c.Open();
        Sql(c, ddl);
        return EsquemaSqlite.Ler(c);
    }

    /// <summary>Todas as linhas de uma tabela (colunas informadas), ordenadas por rowid, como texto.</summary>
    public static List<string> Linhas(string caminho, string tabela, IEnumerable<string> colunas)
    {
        using var c = Abrir(caminho, somenteLeitura: true);
        c.Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = $"SELECT {string.Join(",", colunas.Select(x => $"\"{x}\""))} FROM \"{tabela}\" ORDER BY rowid";
        using var r = cmd.ExecuteReader();
        var linhas = new List<string>();
        while (r.Read())
            linhas.Add(string.Join("|", Enumerable.Range(0, r.FieldCount).Select(i => r.IsDBNull(i) ? "NULL" : Convert.ToString(r.GetValue(i), System.Globalization.CultureInfo.InvariantCulture))));
        return linhas;
    }

    /// <summary>Retrato completo dos dados de todas as tabelas (para comparar antes/depois).</summary>
    public static Dictionary<string, List<string>> Retrato(string caminho)
    {
        var esquema = LerEsquema(caminho);
        return esquema.TabelasDeDados.ToDictionary(t => t, t => Linhas(caminho, t, esquema.Tabelas[t].Colunas.Keys.OrderBy(x => x, StringComparer.Ordinal)));
    }

    public static List<string> Historico(string caminho)
    {
        using var c = Abrir(caminho, somenteLeitura: true);
        c.Open();
        if (!EsquemaSqlite.Ler(c).PossuiHistorico) return new List<string>();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT MigrationId FROM \"__EFMigrationsHistory\" ORDER BY MigrationId";
        using var r = cmd.ExecuteReader();
        var ids = new List<string>();
        while (r.Read()) ids.Add(r.GetString(0));
        return ids;
    }

    public static string Hash(string arquivo)
    {
        using var fluxo = new FileStream(arquivo, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        return Convert.ToHexString(SHA256.HashData(fluxo));
    }

    public static string[] Backups(string pasta) =>
        Directory.Exists(Path.Combine(pasta, "backups")) ? Directory.GetFiles(Path.Combine(pasta, "backups"), "*.db") : Array.Empty<string>();
}
