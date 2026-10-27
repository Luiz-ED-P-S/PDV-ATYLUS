using Microsoft.EntityFrameworkCore;
using PDV.Domain.Entities;
using PDV.Domain.Interfaces;
using PDV.Infrastructure.Context;

namespace PDV.Infrastructure.Repositories;

public class Repository<T> : IRepository<T> where T : BaseEntity
{
    protected readonly PdvDbContext _context;
    protected readonly DbSet<T> _dbSet;

    public Repository(PdvDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }

    public virtual async Task<T?> ObterPorIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbSet.FindAsync(new object[] { id }, cancellationToken);
    }

    public virtual async Task<List<T>> ObterTodosAsync(CancellationToken cancellationToken = default)
    {
        return await _dbSet.ToListAsync(cancellationToken);
    }

    public virtual async Task AdicionarAsync(T entity, CancellationToken cancellationToken = default)
    {
        await _dbSet.AddAsync(entity, cancellationToken);
    }

    public virtual Task AtualizarAsync(T entity, CancellationToken cancellationToken = default)
    {
        _dbSet.Update(entity);
        return Task.CompletedTask;
    }

    public virtual Task RemoverAsync(T entity, CancellationToken cancellationToken = default)
    {
        _dbSet.Remove(entity);
        return Task.CompletedTask;
    }
}

public class ProdutoRepository : Repository<Produto>, IProdutoRepository
{
    public ProdutoRepository(PdvDbContext context) : base(context) { }

    public async Task<Produto?> ObterPorCodigoBarrasAsync(string codigoBarras, CancellationToken cancellationToken = default)
    {
        var codigoFormatado = codigoBarras.Trim();
        return await _dbSet.FirstOrDefaultAsync(p => p.CodigoBarras == codigoFormatado && p.Ativo, cancellationToken);
    }

    public async Task<List<Produto>> BuscarPorNomeOuCodigoAsync(string termo, CancellationToken cancellationToken = default)
    {
        var termoLimpo = termo.Trim();
        return await _dbSet
            .Where(p => p.Ativo && (EF.Functions.Like(p.CodigoBarras, $"%{termoLimpo}%") || EF.Functions.Like(p.Nome, $"%{termoLimpo}%")))
            .OrderBy(p => p.Nome)
            .Take(30)
            .ToListAsync(cancellationToken);
    }
}

public class OperadorRepository : Repository<Operador>, IOperadorRepository
{
    public OperadorRepository(PdvDbContext context) : base(context) { }

    public async Task<Operador?> ObterPorMatriculaAsync(string matricula, CancellationToken cancellationToken = default)
    {
        var matFormatada = matricula.Trim();
        return await _dbSet.FirstOrDefaultAsync(o => o.Matricula == matFormatada && o.Ativo, cancellationToken);
    }

    public async Task<List<Operador>> ObterSupervisoresAtivosAsync(CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(o => o.Ativo && o.Perfil == Domain.Enums.PerfilOperador.Supervisor)
            .ToListAsync(cancellationToken);
    }
}

public class CaixaRepository : Repository<Caixa>, ICaixaRepository
{
    public CaixaRepository(PdvDbContext context) : base(context) { }

    public async Task<Caixa?> ObterCaixaAbertoAsync(CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(c => c.Movimentacoes)
            .FirstOrDefaultAsync(c => c.Status == Domain.Enums.StatusCaixa.Aberto, cancellationToken);
    }

    public async Task<List<Caixa>> ObterHistoricoCaixasAsync(int quantidade = 10, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(c => c.Movimentacoes)
            .OrderByDescending(c => c.DataAbertura)
            .Take(quantidade)
            .ToListAsync(cancellationToken);
    }

    public override async Task<Caixa?> ObterPorIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(c => c.Movimentacoes)
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
    }
}

public class VendaRepository : Repository<Venda>, IVendaRepository
{
    public VendaRepository(PdvDbContext context) : base(context) { }

    public async Task<List<Venda>> ObterTodasVendasAsync(CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(v => v.Itens)
            .Include(v => v.Pagamentos)
            .OrderByDescending(v => v.DataVenda)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<Venda>> ObterVendasPorCaixaAsync(Guid caixaId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(v => v.Itens)
            .Include(v => v.Pagamentos)
            .Where(v => v.CaixaId == caixaId)
            .OrderByDescending(v => v.DataVenda)
            .ToListAsync(cancellationToken);
    }

    public async Task<Venda?> ObterVendaCompletaPorIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(v => v.Itens)
            .Include(v => v.Pagamentos)
            .FirstOrDefaultAsync(v => v.Id == id, cancellationToken);
    }
}
