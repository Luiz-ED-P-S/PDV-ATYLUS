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
    public DbSet<RegistroSincronizacao> FilaSincronizacao => Set<RegistroSincronizacao>();
    public DbSet<CobrancaPix> CobrancasPix => Set<CobrancaPix>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Todas as entidades herdam BaseEntity, cujo Id é um Guid criado no construtor (Guid.NewGuid()).
        // Sem ValueGeneratedNever(), o EF supõe que o banco gera a chave e trata um filho novo, adicionado
        // à coleção de uma entidade já rastreada (ex.: sangria/suprimento em Caixa), como registro existente
        // (UPDATE em vez de INSERT), causando DbUpdateConcurrencyException. Não altera o esquema do SQLite.

        // Configuração de Produto
        modelBuilder.Entity<Produto>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Id).ValueGeneratedNever(); // Guid gerado pela aplicação (BaseEntity)
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
            entity.Property(c => c.Id).ValueGeneratedNever(); // Guid gerado pela aplicação (BaseEntity)
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
            entity.Property(m => m.Id).ValueGeneratedNever(); // Guid gerado pela aplicação (BaseEntity)
            entity.Property(m => m.Valor).HasPrecision(18, 2);
            entity.Property(m => m.Motivo).IsRequired().HasMaxLength(300);
            entity.Property(m => m.OperadorId).IsRequired().HasMaxLength(100);
        });

        // Configuração de Venda
        modelBuilder.Entity<Venda>(entity =>
        {
            entity.HasKey(v => v.Id);
            entity.Property(v => v.Id).ValueGeneratedNever(); // Guid gerado pela aplicação (BaseEntity)
            entity.Property(v => v.OperadorId).IsRequired().HasMaxLength(100);
            entity.Property(v => v.TerminalId).IsRequired().HasMaxLength(50).HasDefaultValue("CX01");
            entity.Property(v => v.NumeroSequencial).HasDefaultValue(1);
            entity.HasIndex(v => new { v.TerminalId, v.NumeroSequencial });
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

        // Configuração de RegistroSincronizacao
        modelBuilder.Entity<RegistroSincronizacao>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.Property(s => s.Id).ValueGeneratedNever(); // Guid gerado pela aplicação (BaseEntity)
            entity.Property(s => s.TerminalId).IsRequired().HasMaxLength(50);
            entity.Property(s => s.TipoEntidade).IsRequired().HasMaxLength(100);
            entity.Property(s => s.Operacao).IsRequired().HasMaxLength(50);
            entity.Property(s => s.PayloadJson).IsRequired();
            entity.HasIndex(s => s.Status);
            entity.HasIndex(s => s.CriadoEm);
        });

        // Configuração de ItemVenda
        modelBuilder.Entity<ItemVenda>(entity =>
        {
            entity.HasKey(i => i.Id);
            entity.Property(i => i.Id).ValueGeneratedNever(); // Guid gerado pela aplicação (BaseEntity)
            entity.Property(i => i.ProdutoNome).IsRequired().HasMaxLength(200);
            entity.Property(i => i.CodigoBarras).IsRequired().HasMaxLength(60);
            entity.Property(i => i.Quantidade).HasPrecision(18, 3);
            entity.Property(i => i.PrecoUnitario).HasPrecision(18, 2);
        });

        // Configuração de PagamentoVenda
        modelBuilder.Entity<PagamentoVenda>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Id).ValueGeneratedNever(); // Guid gerado pela aplicação (BaseEntity)
            entity.Property(p => p.Valor).HasPrecision(18, 2);
            entity.Property(p => p.Troco).HasPrecision(18, 2);
            entity.Property(p => p.TxId).HasMaxLength(150);
        });

        // Configuração de CobrancaPix (cobranças persistidas; Status é token de concorrência)
        modelBuilder.Entity<CobrancaPix>(entity =>
        {
            entity.ToTable("CobrancasPix");
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Id).ValueGeneratedNever(); // Guid gerado pela aplicação (BaseEntity)
            entity.Property(c => c.TxId).IsRequired().HasMaxLength(60);
            entity.HasIndex(c => c.TxId).IsUnique();
            entity.Property(c => c.Valor).HasPrecision(18, 2);
            entity.Property(c => c.Provedor).IsRequired().HasMaxLength(40);
            entity.Property(c => c.Status).IsConcurrencyToken();
            entity.HasIndex(c => c.Status);
            entity.Property(c => c.OperadorMatricula).IsRequired().HasMaxLength(50);
            entity.Property(c => c.TerminalId).IsRequired().HasMaxLength(50);
            entity.Property(c => c.SupervisorMatricula).HasMaxLength(50);
            entity.Property(c => c.ObservacaoConfirmacao).HasMaxLength(300);
            entity.HasIndex(c => c.VendaId);
        });

        // Configuração de Operador
        modelBuilder.Entity<Operador>(entity =>
        {
            entity.HasKey(o => o.Id);
            entity.Property(o => o.Id).ValueGeneratedNever(); // Guid gerado pela aplicação (BaseEntity)
            entity.HasIndex(o => o.Matricula).IsUnique();
            entity.Property(o => o.Nome).IsRequired().HasMaxLength(100);
            entity.Property(o => o.Matricula).IsRequired().HasMaxLength(50);
            entity.Property(o => o.Pin).IsRequired().HasMaxLength(100);
        });
    }
}
