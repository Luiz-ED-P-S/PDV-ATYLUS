using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PDV.Domain.Entities;
using PDV.Domain.Interfaces;

namespace PDV.Infrastructure.Services;

public class CloudSyncService : ICloudSyncService
{
    private readonly ISincronizacaoRepository _sincronizacaoRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly HttpClient _httpClient;
    private readonly ILogger<CloudSyncService> _logger;

    private static string _terminalId = "CX01";
    private static string _cloudUrl = "";
    private static string _apiKey = "";
    private static readonly object _lock = new();

    private readonly string _configFile;

    public CloudSyncService(
        ISincronizacaoRepository sincronizacaoRepository,
        IUnitOfWork unitOfWork,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<CloudSyncService> logger)
    {
        _sincronizacaoRepository = sincronizacaoRepository;
        _unitOfWork = unitOfWork;
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromSeconds(5);
        _logger = logger;

        var appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "PDV-ATYLUS");
        Directory.CreateDirectory(appData);
        _configFile = Path.Combine(appData, "cloud_sync_config.json");

        CarregarConfiguracao(configuration);
    }

    private void CarregarConfiguracao(IConfiguration configuration)
    {
        lock (_lock)
        {
            if (File.Exists(_configFile))
            {
                try
                {
                    var json = File.ReadAllText(_configFile);
                    var doc = JsonDocument.Parse(json);
                    if (doc.RootElement.TryGetProperty("TerminalId", out var t)) _terminalId = t.GetString() ?? "CX01";
                    if (doc.RootElement.TryGetProperty("CloudUrl", out var u)) _cloudUrl = u.GetString() ?? "";
                    if (doc.RootElement.TryGetProperty("ApiKey", out var k)) _apiKey = k.GetString() ?? "";
                    return;
                }
                catch
                {
                    // Fallback
                }
            }

            _terminalId = Environment.GetEnvironmentVariable("PDV_TERMINAL_ID")
                          ?? configuration["CloudSync:TerminalId"]
                          ?? "CX01";

            _cloudUrl = Environment.GetEnvironmentVariable("PDV_CLOUD_URL")
                        ?? configuration["CloudSync:CloudUrl"]
                        ?? "";

            _apiKey = Environment.GetEnvironmentVariable("PDV_CLOUD_API_KEY")
                      ?? configuration["CloudSync:ApiKey"]
                      ?? "";
        }
    }

    public void AtualizarConfiguracao(string? cloudUrl, string? terminalId, string? apiKey)
    {
        lock (_lock)
        {
            if (!string.IsNullOrWhiteSpace(terminalId)) _terminalId = terminalId.Trim();
            if (cloudUrl != null) _cloudUrl = cloudUrl.Trim();
            if (apiKey != null) _apiKey = apiKey.Trim();

            try
            {
                var payload = JsonSerializer.Serialize(new
                {
                    TerminalId = _terminalId,
                    CloudUrl = _cloudUrl,
                    ApiKey = _apiKey
                }, new JsonSerializerOptions { WriteIndented = true });

                File.WriteAllText(_configFile, payload);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Não foi possível salvar o arquivo de configuração de sincronização.");
            }
        }
    }

    public async Task EnfileirarAsync(
        string tipoEntidade,
        Guid entidadeId,
        string operacao,
        object payload,
        string? terminalId = null,
        CancellationToken cancellationToken = default)
    {
        var term = !string.IsNullOrWhiteSpace(terminalId) ? terminalId : _terminalId;
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

        var registro = new RegistroSincronizacao(term, tipoEntidade, entidadeId, operacao, json);
        await _sincronizacaoRepository.AdicionarAsync(registro, cancellationToken);
        await _unitOfWork.CommitAsync(cancellationToken);

        _logger.LogInformation("Registro enfileirado para sincronização em nuvem: {Tipo} {Id} ({Operacao})", tipoEntidade, entidadeId, operacao);
    }

    public async Task<bool> TestarConexaoNuvemAsync(CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_cloudUrl))
            return false;

        try
        {
            var baseUri = new Uri(_cloudUrl);
            var healthUrl = new Uri(baseUri, "/health").ToString();

            using var request = new HttpRequestMessage(HttpMethod.Get, healthUrl);
            if (!string.IsNullOrWhiteSpace(_apiKey))
            {
                request.Headers.Add("X-PDV-ApiKey", _apiKey);
            }

            using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    public async Task<ResultadoSincronizacao> SincronizarFilaAsync(CancellationToken cancellationToken = default)
    {
        var pendentes = await _sincronizacaoRepository.ObterPendentesAsync(50, cancellationToken);
        if (pendentes.Count == 0)
        {
            return new ResultadoSincronizacao(true, 0, 0, "Fila de sincronização vazia.");
        }

        // Se URL de nuvem não configurada, simula contingência local segura
        if (string.IsNullOrWhiteSpace(_cloudUrl))
        {
            return new ResultadoSincronizacao(
                false,
                0,
                pendentes.Count,
                "URL da Nuvem não configurada. Registros mantidos em segurança no banco local (Standby).");
        }

        var online = await TestarConexaoNuvemAsync(cancellationToken);
        if (!online)
        {
            _logger.LogWarning("Sem conexão com a nuvem ({Url}). Sincronização mantida em Standby.", _cloudUrl);
            return new ResultadoSincronizacao(
                false,
                0,
                pendentes.Count,
                "Sem conexão com a Nuvem no momento. Registros em Standby aguardando rede.");
        }

        int sincronizados = 0;
        int falhas = 0;

        try
        {
            var endpointLote = new Uri(new Uri(_cloudUrl), "/api/v1/sync/receber-lote").ToString();

            var itensParaEnviar = pendentes.Select(p => new
            {
                p.Id,
                p.TerminalId,
                p.TipoEntidade,
                p.EntidadeId,
                p.Operacao,
                Payload = JsonDocument.Parse(p.PayloadJson).RootElement,
                p.CriadoEm
            }).ToList();

            using var request = new HttpRequestMessage(HttpMethod.Post, endpointLote)
            {
                Content = JsonContent.Create(new
                {
                    TerminalOrigem = _terminalId,
                    DataEnvio = DateTime.UtcNow,
                    Registros = itensParaEnviar
                })
            };

            if (!string.IsNullOrWhiteSpace(_apiKey))
            {
                request.Headers.Add("X-PDV-ApiKey", _apiKey);
            }

            var response = await _httpClient.SendAsync(request, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                foreach (var item in pendentes)
                {
                    item.MarcarComoSincronizado();
                    await _sincronizacaoRepository.AtualizarAsync(item, cancellationToken);
                }

                await _unitOfWork.CommitAsync(cancellationToken);
                sincronizados = pendentes.Count;
                _logger.LogInformation("Lote de {Qtd} registros sincronizado com sucesso na nuvem.", sincronizados);

                return new ResultadoSincronizacao(true, sincronizados, 0, $"Lote de {sincronizados} registros sincronizado com sucesso!");
            }
            else
            {
                var erroMsg = await response.Content.ReadAsStringAsync(cancellationToken);
                foreach (var item in pendentes)
                {
                    item.RegistrarFalha($"Servidor retornou status {response.StatusCode}: {erroMsg}");
                    await _sincronizacaoRepository.AtualizarAsync(item, cancellationToken);
                }

                await _unitOfWork.CommitAsync(cancellationToken);
                falhas = pendentes.Count;

                return new ResultadoSincronizacao(false, 0, falhas, $"Falha ao enviar para a nuvem: {response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao sincronizar com nuvem.");
            foreach (var item in pendentes)
            {
                item.RegistrarFalha(ex.Message);
                await _sincronizacaoRepository.AtualizarAsync(item, cancellationToken);
            }
            await _unitOfWork.CommitAsync(cancellationToken);

            return new ResultadoSincronizacao(false, 0, pendentes.Count, $"Erro de conexão: {ex.Message}");
        }
    }

    public async Task<StatusSincronizacaoDto> ObterStatusAsync(CancellationToken cancellationToken = default)
    {
        var totalPendentes = await _sincronizacaoRepository.ObterTotalPendentesAsync(cancellationToken);
        var ultimaSinc = await _sincronizacaoRepository.ObterDataUltimaSincronizacaoAsync(cancellationToken);
        var online = await TestarConexaoNuvemAsync(cancellationToken);

        string statusDesc;
        if (string.IsNullOrWhiteSpace(_cloudUrl))
        {
            statusDesc = "Nuvem não configurada (Operando Localmente)";
        }
        else if (!online)
        {
            statusDesc = totalPendentes > 0 ? $"Standby: {totalPendentes} pendentes (Offline)" : "Offline (Sem conexão)";
        }
        else if (totalPendentes > 0)
        {
            statusDesc = $"Sincronizando ({totalPendentes} na fila)";
        }
        else
        {
            statusDesc = "Nuvem Conectada & Sincronizada";
        }

        return new StatusSincronizacaoDto(
            Online: online,
            Pendentes: totalPendentes,
            UltimaSincronizacao: ultimaSinc,
            TerminalId: _terminalId,
            CloudUrl: _cloudUrl,
            UltimoStatus: statusDesc);
    }
}
