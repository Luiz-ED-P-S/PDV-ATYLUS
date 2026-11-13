using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using PDV.Domain.Entities;
using PDV.Domain.Enums;
using PDV.Infrastructure.Context;

namespace PDV.Tests.Caixa;

/// <summary>
/// Garante que o EF trata os Guids como gerados pela aplicação, para que filhos novos adicionados a
/// entidades já rastreadas sejam inseridos (INSERT) e não atualizados (UPDATE inexistente).
/// Usa SQLite em memória — nunca o pdv.db real.
/// </summary>
public class MapeamentoIdsTests : IDisposable
{
    private readonly SqliteConnection _conexao;

    public MapeamentoIdsTests()
    {
        _conexao = new SqliteConnection("Data Source=:memory:");
        _conexao.Open();
        using var ctx = NovoContexto();
        ctx.Database.EnsureCreated();
    }

    private PdvDbContext NovoContexto() =>
        new(new DbContextOptionsBuilder<PdvDbContext>().UseSqlite(_conexao).Options);

    [Fact]
    public void TodasAsEntidades_UsamIdGeradoPelaAplicacao()
    {
        using var ctx = NovoContexto();
        var entidades = ctx.Model.GetEntityTypes().Where(t => typeof(BaseEntity).IsAssignableFrom(t.ClrType)).ToList();

        Assert.Equal(9, entidades.Count); // 8 originais + CobrancaPix
        Assert.All(entidades, t => Assert.Equal(ValueGenerated.Never, t.FindPrimaryKey()!.Properties.Single().ValueGenerated));
    }

    [Fact]
    public void NovaMovimentacao_EmCaixaRastreado_EInseridaENaoAtualizada()
    {
        Guid caixaId;
        using (var ctx = NovoContexto())
        {
            var caixa = new PDV.Domain.Entities.Caixa("OP01", 50m);
            ctx.Caixas.Add(caixa);
            ctx.SaveChanges();
            caixaId = caixa.Id;
        }

        using (var ctx = NovoContexto())
        {
            var caixa = ctx.Caixas.Include(c => c.Movimentacoes).Single(c => c.Id == caixaId);
            caixa.AdicionarMovimentacao(TipoMovimentacaoCaixa.Sangria, 10m, "teste", "OP01");
            ctx.ChangeTracker.DetectChanges();

            Assert.Equal(EntityState.Added, ctx.Entry(caixa.Movimentacoes.Last()).State);
            ctx.SaveChanges();
        }

        using (var ctx = NovoContexto())
        {
            Assert.Equal(2, ctx.MovimentacoesCaixa.Count(m => m.CaixaId == caixaId));
        }
    }

    [Fact]
    public void UpdateDeGrafoExistente_ContinuaMarcandoComoModificado()
    {
        // Comportamento usado por FecharCaixaCego/CancelarVenda (Repository.AtualizarAsync → DbSet.Update) não muda.
        Guid caixaId;
        using (var ctx = NovoContexto())
        {
            var caixa = new PDV.Domain.Entities.Caixa("OP01", 50m);
            ctx.Caixas.Add(caixa);
            ctx.SaveChanges();
            caixaId = caixa.Id;
        }

        using (var ctx = NovoContexto())
        {
            var caixa = ctx.Caixas.Include(c => c.Movimentacoes).Single(c => c.Id == caixaId);
            caixa.FecharCego(50m);
            ctx.Caixas.Update(caixa);

            Assert.Equal(EntityState.Modified, ctx.Entry(caixa).State);
            Assert.All(caixa.Movimentacoes, m => Assert.NotEqual(EntityState.Added, ctx.Entry(m).State));
            ctx.SaveChanges();
        }

        using (var ctx = NovoContexto())
        {
            Assert.Equal(StatusCaixa.Fechado, ctx.Caixas.Single(c => c.Id == caixaId).Status);
            Assert.Equal(1, ctx.MovimentacoesCaixa.Count(m => m.CaixaId == caixaId));
        }
    }

    public void Dispose() => _conexao.Dispose();
}
