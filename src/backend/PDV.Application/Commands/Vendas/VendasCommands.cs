using FluentValidation;
using MediatR;
using PDV.Application.DTOs;
using PDV.Domain.Entities;
using PDV.Domain.Enums;
using PDV.Domain.Exceptions;
using PDV.Domain.Interfaces;

namespace PDV.Application.Commands.Vendas;

public record CriarVendaItemInput(
    Guid ProdutoId,
    decimal Quantidade,
    decimal PrecoUnitario);

public record CriarVendaPagamentoInput(
    FormaPagamento FormaPagamento,
    decimal Valor,
    decimal Troco = 0,
    string? TxId = null);

public record CriarVendaCommand(
    string OperadorId,
    decimal Desconto,
    List<CriarVendaItemInput> Itens,
    List<CriarVendaPagamentoInput> Pagamentos) : IRequest<VendaDto>;

public class CriarVendaCommandValidator : AbstractValidator<CriarVendaCommand>
{
    public CriarVendaCommandValidator()
    {
        RuleFor(x => x.Desconto).GreaterThanOrEqualTo(0).WithMessage("O desconto não pode ser negativo.");
        RuleFor(x => x.Itens).NotEmpty().WithMessage("A venda deve possuir pelo menos um item.");
        RuleForEach(x => x.Itens).ChildRules(item =>
        {
            item.RuleFor(i => i.ProdutoId).NotEmpty().WithMessage("O identificador do produto é obrigatório.");
            item.RuleFor(i => i.Quantidade).GreaterThan(0).WithMessage("A quantidade do item deve ser maior que zero.");
            item.RuleFor(i => i.PrecoUnitario).GreaterThan(0).WithMessage("O preço unitário deve ser maior que zero.");
        });
        RuleFor(x => x.Pagamentos).NotEmpty().WithMessage("A venda deve possuir pelo menos uma forma de pagamento informada.");
        RuleForEach(x => x.Pagamentos).ChildRules(pag =>
        {
            pag.RuleFor(p => p.Valor).GreaterThan(0).WithMessage("O valor do pagamento deve ser maior que zero.");
        });
    }
}

public class CriarVendaCommandHandler : IRequestHandler<CriarVendaCommand, VendaDto>
{
    private readonly IVendaRepository _vendaRepository;
    private readonly ICaixaRepository _caixaRepository;
    private readonly IProdutoRepository _produtoRepository;

    public CriarVendaCommandHandler(
        IVendaRepository vendaRepository,
        ICaixaRepository caixaRepository,
        IProdutoRepository produtoRepository)
    {
        _vendaRepository = vendaRepository;
        _caixaRepository = caixaRepository;
        _produtoRepository = produtoRepository;
    }

    public async Task<VendaDto> Handle(CriarVendaCommand request, CancellationToken cancellationToken)
    {
        var caixaAberto = await _caixaRepository.ObterCaixaAbertoAsync(cancellationToken);
        if (caixaAberto == null)
            throw new DomainException("Não é possível realizar vendas: nenhum caixa está aberto no momento. Abra o caixa primeiro [F3].");

        var venda = new Venda(caixaAberto.Id, request.OperadorId, request.Desconto);

        // Processa e debita os itens do estoque
        foreach (var itemInput in request.Itens)
        {
            var produto = await _produtoRepository.ObterPorIdAsync(itemInput.ProdutoId, cancellationToken);
            if (produto == null)
                throw new DomainException($"Produto de ID '{itemInput.ProdutoId}' não foi localizado no catálogo.");

            produto.DebitarEstoque(itemInput.Quantidade);
            await _produtoRepository.AtualizarAsync(produto, cancellationToken);

            venda.AdicionarItem(
                produto.Id,
                produto.Nome,
                produto.CodigoBarras,
                itemInput.Quantidade,
                itemInput.PrecoUnitario);
        }

        // Processa os pagamentos
        foreach (var pag in request.Pagamentos)
        {
            venda.AdicionarPagamento(pag.FormaPagamento, pag.Valor, pag.Troco, pag.TxId);
        }

        var totalPagoSemTroco = request.Pagamentos.Sum(p => p.Valor - p.Troco);
        if (totalPagoSemTroco < venda.ValorLiquido)
        {
            throw new DomainException($"Total recebido (R$ {totalPagoSemTroco:F2}) é insuficiente para cobrir o valor líquido da venda (R$ {venda.ValorLiquido:F2}).");
        }

        await _vendaRepository.AdicionarAsync(venda, cancellationToken);

        return VendaDto.FromEntity(venda);
    }
}

public record CancelarVendaCommand(Guid VendaId, string Motivo, string SupervisorPin) : IRequest<bool>;

public class CancelarVendaCommandHandler : IRequestHandler<CancelarVendaCommand, bool>
{
    private readonly IVendaRepository _vendaRepository;
    private readonly IProdutoRepository _produtoRepository;

    public CancelarVendaCommandHandler(IVendaRepository vendaRepository, IProdutoRepository produtoRepository)
    {
        _vendaRepository = vendaRepository;
        _produtoRepository = produtoRepository;
    }

    public async Task<bool> Handle(CancelarVendaCommand request, CancellationToken cancellationToken)
    {
        var venda = await _vendaRepository.ObterVendaCompletaPorIdAsync(request.VendaId, cancellationToken);
        if (venda == null)
            throw new DomainException($"Venda de ID '{request.VendaId}' não encontrada.");

        venda.Cancelar(request.Motivo);

        // Estorna o estoque de todos os itens da venda
        foreach (var item in venda.Itens)
        {
            var produto = await _produtoRepository.ObterPorIdAsync(item.ProdutoId, cancellationToken);
            if (produto != null)
            {
                produto.EstornarEstoque(item.Quantidade);
                await _produtoRepository.AtualizarAsync(produto, cancellationToken);
            }
        }

        await _vendaRepository.AtualizarAsync(venda, cancellationToken);
        return true;
    }
}
