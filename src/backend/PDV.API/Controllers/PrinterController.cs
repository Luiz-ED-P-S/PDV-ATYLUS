using Microsoft.AspNetCore.Mvc;
using PDV.Domain.Enums;
using PDV.Domain.Interfaces;

namespace PDV.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class PrinterController : ControllerBase
{
    private readonly IThermalPrinterService _printerService;
    private readonly IVendaRepository _vendaRepository;
    private readonly ICaixaRepository _caixaRepository;

    public PrinterController(
        IThermalPrinterService printerService,
        IVendaRepository vendaRepository,
        ICaixaRepository caixaRepository)
    {
        _printerService = printerService;
        _vendaRepository = vendaRepository;
        _caixaRepository = caixaRepository;
    }

    /// <summary>
    /// Retorna as impressoras instaladas no sistema operacional (Windows Spooler)
    /// </summary>
    [HttpGet("installed")]
    public IActionResult ObterImpressorasInstaladas()
    {
        var lista = _printerService.ObterImpressorasInstaladas();
        return Ok(lista);
    }

    /// <summary>
    /// Imprime cupom não fiscal ESC/POS de uma venda específica
    /// </summary>
    [HttpPost("print-sale/{vendaId:guid}")]
    public async Task<IActionResult> ImprimirVenda(
        Guid vendaId,
        [FromQuery] bool abrirGaveta = false,
        [FromBody] ConfiguracaoImpressoraDto? configDto = null,
        CancellationToken cancellationToken = default)
    {
        var venda = await _vendaRepository.ObterVendaCompletaPorIdAsync(vendaId, cancellationToken);
        if (venda == null)
        {
            return NotFound(new { mensagem = "Venda não encontrada para impressão." });
        }

        var config = ConverterDto(configDto);
        var resultado = await _printerService.ImprimirCupomVendaAsync(venda, config, abrirGaveta, cancellationToken);

        if (!resultado.Sucesso)
        {
            return BadRequest(resultado);
        }

        return Ok(resultado);
    }

    /// <summary>
    /// Imprime relatório gerencial de fechamento de caixa
    /// </summary>
    [HttpPost("print-cashier/{caixaId:guid}")]
    public async Task<IActionResult> ImprimirFechamentoCaixa(
        Guid caixaId,
        [FromBody] ConfiguracaoImpressoraDto? configDto = null,
        CancellationToken cancellationToken = default)
    {
        var caixa = await _caixaRepository.ObterPorIdAsync(caixaId, cancellationToken);
        if (caixa == null)
        {
            return NotFound(new { mensagem = "Caixa não encontrado." });
        }

        var vendas = await _vendaRepository.ObterVendasPorCaixaAsync(caixaId, cancellationToken);
        var config = ConverterDto(configDto);
        var resultado = await _printerService.ImprimirFechamentoCaixaAsync(caixa, vendas, config, cancellationToken);

        return Ok(resultado);
    }

    /// <summary>
    /// Aciona a abertura da gaveta de dinheiro através do pino RJ11/RJ12 da impressora
    /// </summary>
    [HttpPost("open-drawer")]
    public async Task<IActionResult> AbrirGaveta(
        [FromBody] ConfiguracaoImpressoraDto? configDto = null,
        CancellationToken cancellationToken = default)
    {
        var config = ConverterDto(configDto);
        var resultado = await _printerService.AcionarGavetaAsync(config, cancellationToken);
        return Ok(resultado);
    }

    /// <summary>
    /// Realiza teste de impressão com diagnóstico de alinhamento, cortes e acentuação
    /// </summary>
    [HttpPost("test")]
    public async Task<IActionResult> TestarImpressora(
        [FromBody] ConfiguracaoImpressoraDto configDto,
        CancellationToken cancellationToken = default)
    {
        var config = ConverterDto(configDto) ?? new ConfiguracaoImpressora();
        var resultado = await _printerService.TestarImpressaoAsync(config, cancellationToken);
        return Ok(resultado);
    }

    private static ConfiguracaoImpressora? ConverterDto(ConfiguracaoImpressoraDto? dto)
    {
        if (dto == null) return null;
        return new ConfiguracaoImpressora(
            TipoConexao: dto.TipoConexao,
            NomeOuEndereco: string.IsNullOrWhiteSpace(dto.NomeOuEndereco) ? "Default" : dto.NomeOuEndereco,
            Largura: dto.Largura == 58 ? LarguraBobina.Mm58 : LarguraBobina.Mm80,
            CortarPapel: dto.CortarPapel,
            AcionarGaveta: dto.AcionarGaveta,
            Vias: dto.Vias <= 0 ? 1 : dto.Vias
        );
    }
}

public record ConfiguracaoImpressoraDto(
    TipoConexaoImpressora TipoConexao = TipoConexaoImpressora.SpoolerWindows,
    string NomeOuEndereco = "Default",
    int Largura = 80,
    bool CortarPapel = true,
    bool AcionarGaveta = true,
    int Vias = 1
);
