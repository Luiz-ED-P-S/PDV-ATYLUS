using PDV.Domain.Interfaces;

namespace PDV.API.BackgroundWorkers;

public class GoogleDriveBackupWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<GoogleDriveBackupWorker> _logger;
    private readonly TimeSpan _intervaloBackup = TimeSpan.FromMinutes(30);

    public GoogleDriveBackupWorker(IServiceProvider serviceProvider, ILogger<GoogleDriveBackupWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("GoogleDriveBackupWorker iniciado. Intervalo de execução: {Intervalo} minutos.", _intervaloBackup.TotalMinutes);

        // Aguarda 1 minuto inicial para estabilização do app
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var backupService = scope.ServiceProvider.GetRequiredService<IGoogleDriveBackupService>();

                _logger.LogInformation("Executando ciclo agendado de backup do banco de dados...");
                await backupService.RealizarBackupAsync(stoppingToken);
                await backupService.SincronizarBackupsPendentesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Falha durante o ciclo de backup periódico.");
            }

            await Task.Delay(_intervaloBackup, stoppingToken);
        }
    }
}
