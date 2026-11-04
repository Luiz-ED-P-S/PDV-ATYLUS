using PDV.Domain.Interfaces;

namespace PDV.API.BackgroundWorkers;

public class CloudSyncWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<CloudSyncWorker> _logger;
    private readonly TimeSpan _intervalo = TimeSpan.FromSeconds(15);

    public CloudSyncWorker(IServiceProvider serviceProvider, ILogger<CloudSyncWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("CloudSyncWorker iniciado. Intervalo de ciclo: {Intervalo}s.", _intervalo.TotalSeconds);

        // Delay inicial breve de 5 segundos para subir a API
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        int cicloContador = 0;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var syncService = scope.ServiceProvider.GetRequiredService<ICloudSyncService>();

                // 1. Sincronização Upstream (PDV -> Nuvem via Outbox)
                var resultado = await syncService.SincronizarFilaAsync(stoppingToken);
                if (resultado.Sincronizados > 0)
                {
                    _logger.LogInformation("Ciclo de sincronização em nuvem finalizado: {Sincronizados} registros sincronizados.", resultado.Sincronizados);
                }

                // 2. A cada 4 ciclos (~60s): Downstream de Catálogo e Telemetria / Heartbeat
                cicloContador++;
                if (cicloContador >= 4)
                {
                    cicloContador = 0;
                    await syncService.BaixarCatalogoNuvemAsync(stoppingToken);
                    await syncService.EnviarHeartbeatAsync(stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Standby de sincronização em nuvem: servidor offline ou inalcançável.");
            }

            try
            {
                await Task.Delay(_intervalo, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}
