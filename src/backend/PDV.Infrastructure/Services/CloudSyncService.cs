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
    private readonly IProdutoRepository _produtoRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly HttpClient _httpClient;
    private readonly ILogger<CloudSyncService> _logger;

    private static string _terminalId = "CX01";
    private static string _cloudUrl = "";
    private static string _apiKey = "";
    private static string _empresaNome = "ATYLUS VAREJO & CONVENIÊNCIA";
    private static string _empresaCnpj = "00.000.000/0001-00";
    private static string _empresaIe = "ISENTO";
    private static string _empresaEndereco = "RUA DO COMÉRCIO, 100 - CENTRO";
    private static readonly object _lock = new();

    private readonly string _configFile;

    public CloudSyncService(
        ISincronizacaoRepository sincronizacaoRepository,
        IProdutoRepository produtoRepository,
        IUnitOfWork unitOfWork,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<CloudSyncService> logger)
    {
        _sincronizacaoRepository = sincronizacaoRepository;
        _produtoRepository = produtoRepository;
        _unitOfWork = unitOfWork;
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromSeconds(5);
        _logger = logger;

        var appData = PastaDadosApp.Resolver();
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
                    if (doc.RootElement.TryGetProperty("EmpresaNome", out var en) && !string.IsNullOrWhiteSpace(en.GetString())) _empresaNome = en.GetString()!;
                    if (doc.RootElement.TryGetProperty("EmpresaCnpj", out var ec) && !string.IsNullOrWhiteSpace(ec.GetString())) _empresaCnpj = ec.GetString()!;
                    if (doc.RootElement.TryGetProperty("EmpresaIe", out var ei) && !string.IsNullOrWhiteSpace(ei.GetString())) _empresaIe = ei.GetString()!;
                    if (doc.RootElement.TryGetProperty("EmpresaEndereco", out var ee) && !string.IsNullOrWhiteSpace(ee.GetString())) _empresaEndereco = ee.GetString()!;
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

    public void AtualizarConfiguracao(
        string? cloudUrl,
        string? terminalId,
        string? apiKey,
        string? empresaNome = null,
        string? empresaCnpj = null,
        string? empresaIe = null,
        string? empresaEndereco = null)
    {
        lock (_lock)
        {
            if (!string.IsNullOrWhiteSpace(terminalId)) _terminalId = terminalId.Trim();
            if (cloudUrl != null) _cloudUrl = cloudUrl.Trim();
            if (apiKey != null) _apiKey = apiKey.Trim();
            if (!string.IsNullOrWhiteSpace(empresaNome)) _empresaNome = empresaNome.Trim();
            if (!string.IsNullOrWhiteSpace(empresaCnpj)) _empresaCnpj = empresaCnpj.Trim();
            if (!string.IsNullOrWhiteSpace(empresaIe)) _empresaIe = empresaIe.Trim();
            if (!string.IsNullOrWhiteSpace(empresaEndereco)) _empresaEndereco = empresaEndereco.Trim();

            try
            {
                var payload = JsonSerializer.Serialize(new
                {
                    TerminalId = _terminalId,
                    CloudUrl = _cloudUrl,
                    ApiKey = _apiKey,
                    EmpresaNome = _empresaNome,
                    EmpresaCnpj = _empresaCnpj,
                    EmpresaIe = _empresaIe,
                    EmpresaEndereco = _empresaEndereco
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
            UltimoStatus: statusDesc,
            EmpresaNome: _empresaNome,
            EmpresaCnpj: _empresaCnpj,
            EmpresaIe: _empresaIe,
            EmpresaEndereco: _empresaEndereco);
    }

    public async Task<ResultadoSincronizacao> BaixarCatalogoNuvemAsync(CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_cloudUrl))
            return new ResultadoSincronizacao(false, 0, 0, "URL da Nuvem não configurada.");

        var online = await TestarConexaoNuvemAsync(cancellationToken);
        if (!online)
            return new ResultadoSincronizacao(false, 0, 0, "Sem conexão com o servidor de Nuvem.");

        try
        {
            var uri = new Uri(new Uri(_cloudUrl), $"/api/v1/sync/catalogo-atualizado?terminalId={_terminalId}").ToString();
            using var req = new HttpRequestMessage(HttpMethod.Get, uri);
            if (!string.IsNullOrWhiteSpace(_apiKey))
            {
                req.Headers.Add("X-PDV-ApiKey", _apiKey);
            }

            var resp = await _httpClient.SendAsync(req, cancellationToken);
            if (!resp.IsSuccessStatusCode)
            {
                return new ResultadoSincronizacao(false, 0, 1, $"Falha ao baixar catálogo: {resp.StatusCode}");
            }

            var produtosNuvem = await resp.Content.ReadFromJsonAsync<List<ProdutoNuvemSyncDto>>(cancellationToken: cancellationToken);
            if (produtosNuvem == null || produtosNuvem.Count == 0)
            {
                return new ResultadoSincronizacao(true, 0, 0, "Nenhum produto pendente de atualização na nuvem.");
            }

            int atualizados = 0;
            foreach (var item in produtosNuvem)
            {
                var local = await _produtoRepository.ObterPorCodigoBarrasAsync(item.CodigoBarras, cancellationToken);
                if (local != null)
                {
                    local.AtualizarDados(
                        item.Nome,
                        item.PrecoVenda,
                        item.PrecoCusto,
                        local.EstoqueAtual,
                        item.EstoqueMinimo);
                    await _produtoRepository.AtualizarAsync(local, cancellationToken);
                }
                else
                {
                    var novo = new Produto(
                        item.CodigoBarras,
                        item.Nome,
                        item.PrecoVenda,
                        item.PrecoCusto,
                        item.EstoqueAtual,
                        item.EstoqueMinimo);
                    await _produtoRepository.AdicionarAsync(novo, cancellationToken);
                }
                atualizados++;
            }

            await _unitOfWork.CommitAsync(cancellationToken);
            _logger.LogInformation("Catálogo sincronizado da nuvem com sucesso: {Qtd} produtos processados.", atualizados);
            return new ResultadoSincronizacao(true, atualizados, 0, $"Catálogo atualizado: {atualizados} produtos sincronizados da nuvem com sucesso!");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao baixar catálogo da nuvem.");
            return new ResultadoSincronizacao(false, 0, 1, $"Erro na sincronização de catálogo: {ex.Message}");
        }
    }

    public async Task<ResultadoSincronizacao> EnviarHeartbeatAsync(CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_cloudUrl))
            return new ResultadoSincronizacao(false, 0, 0, "URL da Nuvem não configurada.");

        try
        {
            var uri = new Uri(new Uri(_cloudUrl), "/api/v1/sync/heartbeat").ToString();
            var pendentes = await _sincronizacaoRepository.ObterTotalPendentesAsync(cancellationToken);

            using var req = new HttpRequestMessage(HttpMethod.Post, uri)
            {
                Content = JsonContent.Create(new
                {
                    TerminalId = _terminalId,
                    Versao = "1.0.0-PRO",
                    Pendentes = pendentes,
                    Hostname = Environment.MachineName,
                    DataHora = DateTime.UtcNow
                })
            };

            if (!string.IsNullOrWhiteSpace(_apiKey))
            {
                req.Headers.Add("X-PDV-ApiKey", _apiKey);
            }

            var resp = await _httpClient.SendAsync(req, cancellationToken);
            return new ResultadoSincronizacao(resp.IsSuccessStatusCode, 1, 0, "Telemetria enviada com sucesso.");
        }
        catch
        {
            return new ResultadoSincronizacao(false, 0, 1, "Falha ao enviar telemetria.");
        }
    }
}

public record ProdutoNuvemSyncDto(
    Guid Id,
    string CodigoBarras,
    string Nome,
    decimal PrecoVenda,
    decimal PrecoCusto,
    decimal EstoqueAtual,
    decimal EstoqueMinimo);
