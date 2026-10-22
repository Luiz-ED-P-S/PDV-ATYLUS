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

    public ImporterController(ISpreadsheetAiService spreadsheetAiService, IProdutoRepository produtoRepository)
    {
        _spreadsheetAiService = spreadsheetAiService;
        _produtoRepository = produtoRepository;
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

        return Ok(new ConfirmarImportacaoResponse(
            request.Produtos.Count,
            importados,
            atualizados,
            erros));
    }
}
