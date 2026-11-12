using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PDV.Infrastructure.Context;

/// <summary>
/// Usada somente pelas ferramentas do EF Core em desenvolvimento (dotnet ef migrations ...).
/// Não abre nem cria banco: a geração de migrations trabalha apenas com o modelo.
/// </summary>
public class PdvDbContextDesignTimeFactory : IDesignTimeDbContextFactory<PdvDbContext>
{
    public PdvDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<PdvDbContext>()
            .UseSqlite("Data Source=pdv-design-time.db")
            .Options;
        return new PdvDbContext(options);
    }
}
