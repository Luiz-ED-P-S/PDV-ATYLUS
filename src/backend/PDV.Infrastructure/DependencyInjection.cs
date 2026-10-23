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
        string connectionString;
        var configuredConn = configuration.GetConnectionString("DefaultConnection");

        var customDataDir = Environment.GetEnvironmentVariable("PDV_DATA_DIR");
        var isDesktopMode = Environment.GetEnvironmentVariable("PDV_DESKTOP_MODE") == "1";

        if (!string.IsNullOrWhiteSpace(customDataDir))
        {
            Directory.CreateDirectory(customDataDir);
            var dbPath = Path.Combine(customDataDir, "pdv.db");
            connectionString = $"Data Source={dbPath};Cache=Shared";
        }
        else if (isDesktopMode)
        {
            var appDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "PDV-ATYLUS");
            Directory.CreateDirectory(appDataDir);
            var dbPath = Path.Combine(appDataDir, "pdv.db");
            connectionString = $"Data Source={dbPath};Cache=Shared";
        }
        else
        {
            connectionString = configuredConn ?? "Data Source=pdv.db;Cache=Shared";
        }

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
