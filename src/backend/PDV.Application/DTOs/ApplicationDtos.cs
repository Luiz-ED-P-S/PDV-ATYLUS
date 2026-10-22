using PDV.Domain.Entities;
using PDV.Domain.Enums;

namespace PDV.Application.DTOs;

public record ProdutoDto(
    Guid Id,
    string CodigoBarras,
    string Nome,
    decimal PrecoVenda,
    decimal PrecoCusto,
    decimal EstoqueAtual,
    decimal EstoqueMinimo,
    bool Ativo)
{
    public static ProdutoDto FromEntity(Produto p) =>
        new(p.Id, p.CodigoBarras, p.Nome, p.PrecoVenda, p.PrecoCusto, p.EstoqueAtual, p.EstoqueMinimo, p.Ativo);
}

public record ItemVendaDto(
    Guid ProdutoId,
    string ProdutoNome,
    string CodigoBarras,
    decimal Quantidade,
    decimal PrecoUnitario,
    decimal Subtotal);

public record PagamentoVendaDto(
    FormaPagamento FormaPagamento,
    decimal Valor,
    decimal Troco,
    string? TxId);

public record VendaDto(
    Guid Id,
    Guid CaixaId,
    string OperadorId,
    DateTime DataVenda,
    decimal ValorTotal,
    decimal Desconto,
    decimal ValorLiquido,
    StatusVenda Status,
    string? MotivoCancelamento,
    List<ItemVendaDto> Itens,
    List<PagamentoVendaDto> Pagamentos)
{
    public static VendaDto FromEntity(Venda v) =>
        new(
            v.Id,
            v.CaixaId,
            v.OperadorId,
            v.DataVenda,
            v.ValorTotal,
            v.Desconto,
            v.ValorLiquido,
            v.Status,
            v.MotivoCancelamento,
            v.Itens.Select(i => new ItemVendaDto(i.ProdutoId, i.ProdutoNome, i.CodigoBarras, i.Quantidade, i.PrecoUnitario, i.Subtotal)).ToList(),
            v.Pagamentos.Select(p => new PagamentoVendaDto(p.FormaPagamento, p.Valor, p.Troco, p.TxId)).ToList());
}

public record MovimentacaoCaixaDto(
    Guid Id,
    TipoMovimentacaoCaixa Tipo,
    decimal Valor,
    string Motivo,
    string OperadorId,
    DateTime DataHora);

public record CaixaDto(
    Guid Id,
    string OperadorId,
    DateTime DataAbertura,
    DateTime? DataFechamento,
    decimal SaldoInicial,
    decimal? SaldoFinalInformado,
    StatusCaixa Status,
    string? ObservacoesFechamento,
    List<MovimentacaoCaixaDto> Movimentacoes)
{
    public static CaixaDto FromEntity(Caixa c) =>
        new(
            c.Id,
            c.OperadorId,
            c.DataAbertura,
            c.DataFechamento,
            c.SaldoInicial,
            c.SaldoFinalInformado,
            c.Status,
            c.ObservacoesFechamento,
            c.Movimentacoes.Select(m => new MovimentacaoCaixaDto(m.Id, m.Tipo, m.Valor, m.Motivo, m.OperadorId, m.DataHora)).ToList());
}

public record FechamentoCegoResultadoDto(
    Guid CaixaId,
    decimal SaldoEsperadoSistema,
    decimal SaldoInformadoOperador,
    decimal Diferenca,
    string StatusConferencia);
