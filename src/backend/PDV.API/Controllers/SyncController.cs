using Microsoft.AspNetCore.Mvc;
using PDV.Domain.Interfaces;

namespace PDV.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class SyncController : ControllerBase
{
    private readonly ICloudSyncService _cloudSyncService;
    private readonly ILogger<SyncController> _logger;

    public SyncController(ICloudSyncService cloudSyncService, ILogger<SyncController> logger)
    {
        _cloudSyncService = cloudSyncService;
        _logger = logger;
    }

    [HttpGet("status")]
    public async Task<ActionResult<StatusSincronizacaoDto>> ObterStatus(CancellationToken cancellationToken)
    {
        var status = await _cloudSyncService.ObterStatusAsync(cancellationToken);
        return Ok(status);
    }

    [HttpPost("forcar")]
    public async Task<ActionResult<ResultadoSincronizacao>> ForcarSincronizacao(CancellationToken cancellationToken)
    {
        var resultado = await _cloudSyncService.SincronizarFilaAsync(cancellationToken);
        return Ok(resultado);
    }

    [HttpPost("testar-conexao")]
    public async Task<ActionResult<bool>> TestarConexao(CancellationToken cancellationToken)
    {
        var online = await _cloudSyncService.TestarConexaoNuvemAsync(cancellationToken);
        return Ok(new { online });
    }

    [HttpPost("config")]
    public IActionResult AtualizarConfiguracao([FromBody] AtualizarConfigSyncRequest request)
    {
        _cloudSyncService.AtualizarConfiguracao(request.CloudUrl, request.TerminalId, request.ApiKey);
        return Ok(new { message = "Configuração de sincronização em nuvem atualizada com sucesso." });
    }

    [HttpPost("puxar-catalogo")]
    public async Task<ActionResult<ResultadoSincronizacao>> PuxarCatalogoNuvem(CancellationToken cancellationToken)
    {
        var resultado = await _cloudSyncService.BaixarCatalogoNuvemAsync(cancellationToken);
        return Ok(resultado);
    }

    [HttpPost("heartbeat")]
    public IActionResult ReceberHeartbeat([FromBody] HeartbeatPayloadRequest payload)
    {
        _logger.LogInformation("Heartbeat recebido do terminal {Terminal} (Versão {Versao}) com {Pendentes} pendentes.", payload.TerminalId, payload.Versao, payload.Pendentes);
        return Ok(new { sucesso = true, timestamp = DateTime.UtcNow });
    }

    [HttpPost("receber-lote")]
    public IActionResult ReceberLote([FromBody] List<LoteSincronizacaoItemRequest> itens)
    {
        _logger.LogInformation("Recebido lote de sincronização multi-terminal com {Total} registros.", itens.Count);
        // Idempotência: o Hub de Nuvem armazena e confirma o recebimento dos registros
        return Ok(new
        {
            sucesso = true,
            processados = itens.Count,
            recebidoEm = DateTime.UtcNow
        });
    }
}

public record AtualizarConfigSyncRequest(string? CloudUrl, string? TerminalId, string? ApiKey);

public record HeartbeatPayloadRequest(
    string TerminalId,
    string Versao,
    int Pendentes,
    string Hostname,
    DateTime DataHora);

public record LoteSincronizacaoItemRequest(
    Guid Id,
    string TerminalId,
    string TipoEntidade,
    Guid EntidadeId,
    string Operacao,
    string PayloadJson,
    DateTime CriadoEm);
