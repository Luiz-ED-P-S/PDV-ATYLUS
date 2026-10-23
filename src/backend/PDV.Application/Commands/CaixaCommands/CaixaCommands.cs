using FluentValidation;
using MediatR;
using PDV.Application.DTOs;
using PDV.Domain.Entities;
using PDV.Domain.Enums;
using PDV.Domain.Exceptions;
using PDV.Domain.Interfaces;

namespace PDV.Application.Commands.CaixaCommands;

public record AbrirCaixaCommand(string OperadorId, decimal SaldoInicial) : IRequest<CaixaDto>;

public class AbrirCaixaCommandValidator : AbstractValidator<AbrirCaixaCommand>
{
    public AbrirCaixaCommandValidator()
    {
        RuleFor(x => x.SaldoInicial).GreaterThanOrEqualTo(0).WithMessage("O saldo inicial não pode ser negativo.");
    }
}

public class AbrirCaixaCommandHandler : IRequestHandler<AbrirCaixaCommand, CaixaDto>
{
    private readonly ICaixaRepository _caixaRepository;
    private readonly IUnitOfWork _unitOfWork;

    public AbrirCaixaCommandHandler(ICaixaRepository caixaRepository, IUnitOfWork unitOfWork)
    {
        _caixaRepository = caixaRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<CaixaDto> Handle(AbrirCaixaCommand request, CancellationToken cancellationToken)
    {
        var caixaExistente = await _caixaRepository.ObterCaixaAbertoAsync(cancellationToken);
        if (caixaExistente != null)
            throw new DomainException("Já existe um caixa aberto no sistema. Feche o caixa atual antes de abrir um novo.");

        var novoCaixa = new Caixa(request.OperadorId, request.SaldoInicial);
        await _caixaRepository.AdicionarAsync(novoCaixa, cancellationToken);
        await _unitOfWork.CommitAsync(cancellationToken);

        return CaixaDto.FromEntity(novoCaixa);
    }
}

public record RegistrarMovimentacaoCommand(
    Guid CaixaId,
    TipoMovimentacaoCaixa Tipo,
    decimal Valor,
    string Motivo,
    string OperadorId) : IRequest<MovimentacaoCaixaDto>;

public class RegistrarMovimentacaoCommandHandler : IRequestHandler<RegistrarMovimentacaoCommand, MovimentacaoCaixaDto>
{
    private readonly ICaixaRepository _caixaRepository;
    private readonly IUnitOfWork _unitOfWork;

    public RegistrarMovimentacaoCommandHandler(ICaixaRepository caixaRepository, IUnitOfWork unitOfWork)
    {
        _caixaRepository = caixaRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<MovimentacaoCaixaDto> Handle(RegistrarMovimentacaoCommand request, CancellationToken cancellationToken)
    {
        var caixa = await _caixaRepository.ObterPorIdAsync(request.CaixaId, cancellationToken);
        if (caixa == null || caixa.Status != StatusCaixa.Aberto)
            throw new DomainException("O caixa especificado não existe ou não está aberto.");

        caixa.AdicionarMovimentacao(request.Tipo, request.Valor, request.Motivo, request.OperadorId);
        await _caixaRepository.AtualizarAsync(caixa, cancellationToken);
        await _unitOfWork.CommitAsync(cancellationToken);

        var mov = caixa.Movimentacoes.Last();
        return new MovimentacaoCaixaDto(mov.Id, mov.Tipo, mov.Valor, mov.Motivo, mov.OperadorId, mov.DataHora);
    }
}

public record FecharCaixaCegoCommand(
    Guid CaixaId,
    decimal SaldoInformado,
    string? Observacoes = null) : IRequest<FechamentoCegoResultadoDto>;

public class FecharCaixaCegoCommandHandler : IRequestHandler<FecharCaixaCegoCommand, FechamentoCegoResultadoDto>
{
    private readonly ICaixaRepository _caixaRepository;
    private readonly IVendaRepository _vendaRepository;
    private readonly IGoogleDriveBackupService _googleDriveBackupService;
    private readonly IUnitOfWork _unitOfWork;

    public FecharCaixaCegoCommandHandler(
        ICaixaRepository caixaRepository,
        IVendaRepository vendaRepository,
        IGoogleDriveBackupService googleDriveBackupService,
        IUnitOfWork unitOfWork)
    {
        _caixaRepository = caixaRepository;
        _vendaRepository = vendaRepository;
        _googleDriveBackupService = googleDriveBackupService;
        _unitOfWork = unitOfWork;
    }

    public async Task<FechamentoCegoResultadoDto> Handle(FecharCaixaCegoCommand request, CancellationToken cancellationToken)
    {
        var caixa = await _caixaRepository.ObterPorIdAsync(request.CaixaId, cancellationToken);
        if (caixa == null || caixa.Status != StatusCaixa.Aberto)
            throw new DomainException("Caixa não localizado ou já finalizado.");

        // Calcula total esperado no sistema pelo somatório de entradas e saídas
        var vendas = await _vendaRepository.ObterVendasPorCaixaAsync(caixa.Id, cancellationToken);
        var vendasDinheiro = vendas
            .Where(v => v.Status == StatusVenda.Concluida)
            .SelectMany(v => v.Pagamentos)
            .Where(p => p.FormaPagamento == FormaPagamento.Dinheiro)
            .Sum(p => p.Valor - p.Troco);

        var suprimentos = caixa.Movimentacoes.Where(m => m.Tipo == TipoMovimentacaoCaixa.Suprimento).Sum(m => m.Valor);
        var sangrias = caixa.Movimentacoes.Where(m => m.Tipo == TipoMovimentacaoCaixa.Sangria).Sum(m => m.Valor);

        var saldoEsperado = suprimentos + vendasDinheiro - sangrias;
        var diferenca = request.SaldoInformado - saldoEsperado;

        caixa.FecharCego(request.SaldoInformado, request.Observacoes);
        await _caixaRepository.AtualizarAsync(caixa, cancellationToken);
        await _unitOfWork.CommitAsync(cancellationToken);

        // Dispara backup automático no Google Drive ao fechar o caixa
        try
        {
            await _googleDriveBackupService.RealizarBackupAsync(cancellationToken);
        }
        catch
        {
            // Silencioso ou enfileirado: o worker tratará contingência offline
        }

        string status = diferenca switch
        {
            0 => "Exato (Sem divergência)",
            > 0 => $"Sobra de caixa (+R$ {diferenca:F2})",
            _ => $"Falta de caixa (-R$ {Math.Abs(diferenca):F2})"
        };

        return new FechamentoCegoResultadoDto(
            caixa.Id,
            saldoEsperado,
            request.SaldoInformado,
            diferenca,
            status);
    }
}
