using Microsoft.AspNetCore.Mvc;
using PDV.Application.DTOs;
using PDV.Domain.Entities;
using PDV.Domain.Interfaces;

namespace PDV.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class ImporterController : ControllerBase
{
    private readonly ISpreadsheetAiService _spreadsheetAiService;
    private readonly IProdutoRepository _produtoRepository;
    private readonly IUnitOfWork _unitOfWork;

    public ImporterController(
        ISpreadsheetAiService spreadsheetAiService,
        IProdutoRepository produtoRepository,
        IUnitOfWork unitOfWork)
    {
        _spreadsheetAiService = spreadsheetAiService;
        _produtoRepository = produtoRepository;
        _unitOfWork = unitOfWork;
    }

    [HttpPost("analyze")]
    public async Task<ActionResult<MapeamentoColunasResult>> AnalisarPlanilha([FromBody] AnalisarPlanilhaRequest request)
    {
        if (request.Cabecalhos == null || request.Cabecalhos.Count == 0)
            return BadRequest(new { message = "Os cabeçalhos da planilha não foram informados." });

        var mapeamento = await _spreadsheetAiService.AnalisarPlanilhaAsync(
            request.NomeArquivo,
            request.Cabecalhos,
            request.AmostraLinhas ?? new List<List<string>>());

        return Ok(mapeamento);
    }

    [HttpPost("confirm")]
    public async Task<ActionResult<ConfirmarImportacaoResponse>> ConfirmarImportacao([FromBody] ConfirmarImportacaoRequest request)
    {
        if (request.Produtos == null || request.Produtos.Count == 0)
            return BadRequest(new { message = "Nenhum produto enviado para importação." });

        int importados = 0;
        int atualizados = 0;
        var erros = new List<string>();

        foreach (var item in request.Produtos)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(item.CodigoBarras) || string.IsNullOrWhiteSpace(item.Nome))
                {
                    erros.Add($"Item ignorado por falta de nome ou código de barras.");
                    continue;
                }

                if (item.PrecoVenda <= 0)
                {
                    erros.Add($"Erro ao importar '{item.Nome}': O preço de venda deve ser maior que zero.");
                    continue;
                }

                if (item.PrecoCusto > item.PrecoVenda)
                {
                    erros.Add($"Bloqueio de preço de custo elevado: '{item.Nome}' possui preço de custo (R$ {item.PrecoCusto:N2}) superior ao preço de venda (R$ {item.PrecoVenda:N2}). Operação bloqueada.");
                    continue;
                }

                var existente = await _produtoRepository.ObterPorCodigoBarrasAsync(item.CodigoBarras);
                if (existente != null)
                {
                    existente.AtualizarPrecos(item.PrecoVenda, item.PrecoCusto);
                    await _produtoRepository.AtualizarAsync(existente);
                    atualizados++;
                }
                else
                {
                    var novoProduto = new Produto(
                        item.CodigoBarras,
                        item.Nome,
                        item.PrecoVenda,
                        item.PrecoCusto,
                        item.EstoqueAtual);

                    await _produtoRepository.AdicionarAsync(novoProduto);
                    importados++;
                }
            }
            catch (Exception ex)
            {
                erros.Add($"Erro ao importar '{item.Nome}': {ex.Message}");
            }
        }

        if (importados > 0 || atualizados > 0)
        {
            await _unitOfWork.CommitAsync();
        }

        return Ok(new ConfirmarImportacaoResponse(
            request.Produtos.Count,
            importados,
            atualizados,
            erros));
    }
}
