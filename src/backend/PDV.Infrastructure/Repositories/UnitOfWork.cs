using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PDV.Domain.Exceptions;
using Microsoft.EntityFrameworkCore.Storage;
using PDV.Domain.Interfaces;
using PDV.Infrastructure.Context;

namespace PDV.Infrastructure.Repositories;

public class UnitOfWork : IUnitOfWork, IDisposable, IAsyncDisposable
{
    private readonly PdvDbContext _context;
    private IDbContextTransaction? _currentTransaction;

    public UnitOfWork(PdvDbContext context)
    {
        _context = context;
    }

    public async Task<int> CommitAsync(CancellationToken cancellationToken = default)
    {
        return await SalvarAsync(cancellationToken);
    }

    /// <summary>
    /// Conflitos de concorrência (registro alterado por outra operação, ex.: cobrança Pix já confirmada/utilizada)
    /// e disputa de escrita no SQLite viram <see cref="ConflitoException"/> (HTTP 409) em vez de erro interno.
    /// </summary>
    private async Task<int> SalvarAsync(CancellationToken cancellationToken)
    {
        try
        {
            return await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new ConflitoException("O registro foi alterado por outra operação ao mesmo tempo. Nenhuma alteração foi gravada; atualize e tente novamente.", ex);
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqliteException { SqliteErrorCode: 5 or 6 })
        {
            throw new ConflitoException("O banco está ocupado por outra operação simultânea. Nenhuma alteração foi gravada; tente novamente.", ex);
        }
    }

    public async Task BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        if (_currentTransaction != null)
            return;

        _currentTransaction = await _context.Database.BeginTransactionAsync(cancellationToken);
    }

    public async Task CommitTransactionAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await SalvarAsync(cancellationToken);
            if (_currentTransaction != null)
            {
                await _currentTransaction.CommitAsync(cancellationToken);
            }
        }
        finally
        {
            if (_currentTransaction != null)
            {
                await _currentTransaction.DisposeAsync();
                _currentTransaction = null;
            }
        }
    }

    public async Task RollbackTransactionAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            if (_currentTransaction != null)
            {
                await _currentTransaction.RollbackAsync(cancellationToken);
            }
        }
        finally
        {
            if (_currentTransaction != null)
            {
                await _currentTransaction.DisposeAsync();
                _currentTransaction = null;
            }
        }
    }

    public void Dispose()
    {
        if (_currentTransaction != null)
        {
            _currentTransaction.Dispose();
            _currentTransaction = null;
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_currentTransaction != null)
        {
            await _currentTransaction.DisposeAsync();
            _currentTransaction = null;
        }
    }
}
