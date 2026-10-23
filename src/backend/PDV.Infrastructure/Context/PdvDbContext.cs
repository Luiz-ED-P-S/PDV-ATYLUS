using Microsoft.EntityFrameworkCore;
using PDV.Domain.Entities;

namespace PDV.Infrastructure.Context;

public class PdvDbContext : DbContext
{
    public PdvDbContext(DbContextOptions<PdvDbContext> options) : base(options)
    {
    }

    public DbSet<Produto> Produtos => Set<Produto>();
    public DbSet<Caixa> Caixas => Set<Caixa>();
    public DbSet<MovimentacaoCaixa> MovimentacoesCaixa => Set<MovimentacaoCaixa>();
    public DbSet<Venda> Vendas => Set<Venda>();
    public DbSet<ItemVenda> ItensVenda => Set<ItemVenda>();
    public DbSet<PagamentoVenda> PagamentosVenda => Set<PagamentoVenda>();
    public DbSet<Operador> Operadores => Set<Operador>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configuração de Produto
        modelBuilder.Entity<Produto>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.HasIndex(p => p.CodigoBarras).IsUnique();
            entity.Property(p => p.CodigoBarras).IsRequired().HasMaxLength(60);
            entity.Property(p => p.Nome).IsRequired().HasMaxLength(200);
            entity.Property(p => p.PrecoVenda).HasPrecision(18, 2);
            entity.Property(p => p.PrecoCusto).HasPrecision(18, 2);
            entity.Property(p => p.EstoqueAtual).HasPrecision(18, 3);
            entity.Property(p => p.EstoqueMinimo).HasPrecision(18, 3);
        });

        // Configuração de Caixa
        modelBuilder.Entity<Caixa>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.OperadorId).IsRequired().HasMaxLength(100);
            entity.Property(c => c.SaldoInicial).HasPrecision(18, 2);
            entity.Property(c => c.SaldoFinalInformado).HasPrecision(18, 2);

            entity.HasMany(c => c.Movimentacoes)
                .WithOne()
                .HasForeignKey(m => m.CaixaId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Configuração de MovimentacaoCaixa
        modelBuilder.Entity<MovimentacaoCaixa>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.Property(m => m.Valor).HasPrecision(18, 2);
            entity.Property(m => m.Motivo).IsRequired().HasMaxLength(300);
            entity.Property(m => m.OperadorId).IsRequired().HasMaxLength(100);
        });

        // Configuração de Venda
        modelBuilder.Entity<Venda>(entity =>
        {
            entity.HasKey(v => v.Id);
            entity.Property(v => v.OperadorId).IsRequired().HasMaxLength(100);
            entity.Property(v => v.ValorTotal).HasPrecision(18, 2);
            entity.Property(v => v.Desconto).HasPrecision(18, 2);
            entity.Property(v => v.ClienteNome).HasMaxLength(150);
            entity.Property(v => v.ClienteDocumento).HasMaxLength(20);

            entity.HasMany(v => v.Itens)
                .WithOne()
                .HasForeignKey(i => i.VendaId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(v => v.Pagamentos)
                .WithOne()
                .HasForeignKey(p => p.VendaId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Configuração de ItemVenda
        modelBuilder.Entity<ItemVenda>(entity =>
        {
            entity.HasKey(i => i.Id);
            entity.Property(i => i.ProdutoNome).IsRequired().HasMaxLength(200);
            entity.Property(i => i.CodigoBarras).IsRequired().HasMaxLength(60);
            entity.Property(i => i.Quantidade).HasPrecision(18, 3);
            entity.Property(i => i.PrecoUnitario).HasPrecision(18, 2);
        });

        // Configuração de PagamentoVenda
        modelBuilder.Entity<PagamentoVenda>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Valor).HasPrecision(18, 2);
            entity.Property(p => p.Troco).HasPrecision(18, 2);
            entity.Property(p => p.TxId).HasMaxLength(150);
        });

        // Configuração de Operador
        modelBuilder.Entity<Operador>(entity =>
        {
            entity.HasKey(o => o.Id);
            entity.HasIndex(o => o.Matricula).IsUnique();
            entity.Property(o => o.Nome).IsRequired().HasMaxLength(100);
            entity.Property(o => o.Matricula).IsRequired().HasMaxLength(50);
            entity.Property(o => o.Pin).IsRequired().HasMaxLength(100);
        });
    }
}
