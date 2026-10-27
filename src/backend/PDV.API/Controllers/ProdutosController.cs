using MediatR;
using Microsoft.AspNetCore.Mvc;
using PDV.Application.Commands.Produtos;
using PDV.Application.DTOs;
using PDV.Application.Queries.Produtos;

namespace PDV.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class ProdutosController : ControllerBase
{
    private readonly IMediator _mediator;

    public ProdutosController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<ProdutoDto>>> ObterProdutos([FromQuery] string? termo)
    {
        var produtos = await _mediator.Send(new ObterProdutosQuery(termo));
        return Ok(produtos);
    }

    [HttpGet("codigo/{codigoBarras}")]
    public async Task<ActionResult<ProdutoDto>> ObterPorCodigo(string codigoBarras)
    {
        var produto = await _mediator.Send(new ObterProdutoPorCodigoBarrasQuery(codigoBarras));
        if (produto == null)
            return NotFound(new { message = $"Produto com código '{codigoBarras}' não localizado." });

        return Ok(produto);
    }

    [HttpPost]
    public async Task<ActionResult<ProdutoDto>> CriarProduto([FromBody] CriarProdutoCommand command)
    {
        var produto = await _mediator.Send(command);
        return CreatedAtAction(nameof(ObterPorCodigo), new { codigoBarras = produto.CodigoBarras }, produto);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ProdutoDto>> AtualizarProduto(Guid id, [FromBody] AtualizarProdutoRequest request)
    {
        var produto = await _mediator.Send(new AtualizarProdutoCommand(
            id,
            request.Nome,
            request.PrecoVenda,
            request.PrecoCusto,
            request.EstoqueAtual,
            request.EstoqueMinimo));
        return Ok(produto);
    }
}

public record AtualizarProdutoRequest(
    string? Nome,
    decimal? PrecoVenda,
    decimal? PrecoCusto,
    decimal? EstoqueAtual,
    decimal? EstoqueMinimo);
