using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PDV.Domain.Interfaces;
using PDV.Infrastructure.Context;
using PDV.Infrastructure.Repositories;
using PDV.Infrastructure.Services;

namespace PDV.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection") ?? "Data Source=pdv.db;Cache=Shared";

        services.AddDbContext<PdvDbContext>(options =>
        {
            options.UseSqlite(connectionString);
        });

        // Unit of Work e Repositórios
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IProdutoRepository, ProdutoRepository>();
        services.AddScoped<ICaixaRepository, CaixaRepository>();
        services.AddScoped<IVendaRepository, VendaRepository>();
        services.AddScoped<IOperadorRepository, OperadorRepository>();

        // Serviços Externos e de Suporte
        services.AddSingleton<IPixService, PixSimulatorService>();
        services.AddScoped<IGoogleDriveBackupService, GoogleDriveBackupService>();
        services.AddScoped<IThermalPrinterService, ThermalPrinterService>();
        services.AddHttpClient<ISpreadsheetAiService, SpreadsheetAiService>();

        return services;
    }
}
