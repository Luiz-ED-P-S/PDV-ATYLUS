using System.Security.Cryptography;
using MediatR;
using PDV.Domain.Entities;
using PDV.Domain.Enums;
using PDV.Domain.Exceptions;
using PDV.Domain.Interfaces;

namespace PDV.Application.Commands.Pix;

/// <summary>
/// Configuração do Pix decidida no servidor (nunca pelo cliente). A simulação só é permitida quando
/// configurada (Pix:PermitirSimulacao=true) E o ambiente é Development ou Testing.
/// </summary>
public sealed class OpcoesPix
{
    public bool PermitirSimulacao { get; init; }

    public static OpcoesPix Para(string ambiente, bool simulacaoConfigurada) => new()
    {
        PermitirSimulacao = simulacaoConfigurada &&
                            (string.Equals(ambiente, "Development", StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(ambiente, "Testing", StringComparison.OrdinalIgnoreCase))
    };
}

public record CobrancaPixDto(
    string TxId,
    decimal Valor,
    StatusCobrancaPix Status,
    string Provedor,
    bool CobrancaBancaria,
    bool Simulada,
    DateTime ExpiraEm,
    string? QrCodeBase64,
    string? CopiaECola,
    string? Instrucoes,
    MetodoConfirmacaoPix? MetodoConfirmacao,
    DateTime? ConfirmadoEm,
    string? SupervisorMatricula,
    bool ConfirmacaoManual,
    Guid? VendaId)
{
    public static CobrancaPixDto De(CobrancaPix c, IPixProvedor provedor, DateTime agoraUtc, DadosPagamentoPix? dados = null) => new(
        c.TxId,
        c.Valor,
        c.Expirou(agoraUtc) ? StatusCobrancaPix.Expirada : c.Status,
        c.Provedor,
        provedor.CobrancaBancaria && c.Provedor == provedor.Nome,
        c.Provedor == ProvedoresPix.Simulador,
        c.ExpiraEm,
        dados?.QrCodeBase64,
        dados?.CopiaECola,
        dados?.Instrucoes,
        c.MetodoConfirmacao,
        c.ConfirmadoEm,
        c.SupervisorMatricula,
        c.MetodoConfirmacao == MetodoConfirmacaoPix.ManualSupervisor,
        c.VendaId);
}

public static class ProvedoresPix
{
    public const string Simulador = "Simulador";
    public const string Manual = "Manual";
}

// ---------- Gerar cobrança ----------

public record GerarCobrancaPixCommand(decimal Valor, string? Descricao, string OperadorMatricula, string? TerminalId) : IRequest<CobrancaPixDto>;

public class GerarCobrancaPixCommandHandler : IRequestHandler<GerarCobrancaPixCommand, CobrancaPixDto>
{
    private readonly ICobrancaPixRepository _cobrancas;
    private readonly ICaixaRepository _caixas;
    private readonly IPixProvedor _provedor;
    private readonly IUnitOfWork _unitOfWork;
    private readonly TimeProvider _relogio;

    public GerarCobrancaPixCommandHandler(ICobrancaPixRepository cobrancas, ICaixaRepository caixas, IPixProvedor provedor, IUnitOfWork unitOfWork, TimeProvider relogio)
    {
        _cobrancas = cobrancas;
        _caixas = caixas;
        _provedor = provedor;
        _unitOfWork = unitOfWork;
        _relogio = relogio;
    }

    public async Task<CobrancaPixDto> Handle(GerarCobrancaPixCommand request, CancellationToken cancellationToken)
    {
        var caixa = await _caixas.ObterCaixaAbertoAsync(cancellationToken)
                    ?? throw new DomainException("Não é possível gerar cobrança Pix: nenhum caixa está aberto.");

        var agora = _relogio.GetUtcNow().UtcDateTime;
        // Identificador gerado no servidor: data/hora + 64 bits aleatórios (índice único no banco)
        var txId = $"PDV{agora:yyyyMMddHHmmss}{Convert.ToHexString(RandomNumberGenerator.GetBytes(8))}";
        var cobranca = new CobrancaPix(txId, request.Valor, _provedor.Nome, request.OperadorMatricula, caixa.Id, request.TerminalId ?? "CX01", agora);

        var dados = await _provedor.PrepararAsync(txId, request.Valor, request.Descricao ?? "Venda PDV Atylus", cancellationToken);
        await _cobrancas.AdicionarAsync(cobranca, cancellationToken);
        await _unitOfWork.CommitAsync(cancellationToken);

        return CobrancaPixDto.De(cobranca, _provedor, agora, dados);
    }
}

// ---------- Consultar ----------

public record ObterCobrancaPixQuery(string TxId) : IRequest<CobrancaPixDto?>;

public class ObterCobrancaPixQueryHandler : IRequestHandler<ObterCobrancaPixQuery, CobrancaPixDto?>
{
    private readonly ICobrancaPixRepository _cobrancas;
    private readonly IPixProvedor _provedor;
    private readonly TimeProvider _relogio;

    public ObterCobrancaPixQueryHandler(ICobrancaPixRepository cobrancas, IPixProvedor provedor, TimeProvider relogio)
    {
        _cobrancas = cobrancas;
        _provedor = provedor;
        _relogio = relogio;
    }

    public async Task<CobrancaPixDto?> Handle(ObterCobrancaPixQuery request, CancellationToken cancellationToken)
    {
        var cobranca = await _cobrancas.ObterPorTxIdAsync(request.TxId, cancellationToken);
        return cobranca == null ? null : CobrancaPixDto.De(cobranca, _provedor, _relogio.GetUtcNow().UtcDateTime);
    }
}

// ---------- Simulação (somente Development/Testing autorizados) ----------

public record SimularPagamentoPixCommand(string TxId) : IRequest<CobrancaPixDto>;

public class SimularPagamentoPixCommandHandler : IRequestHandler<SimularPagamentoPixCommand, CobrancaPixDto>
{
    private readonly ICobrancaPixRepository _cobrancas;
    private readonly IPixProvedor _provedor;
    private readonly IUnitOfWork _unitOfWork;
    private readonly OpcoesPix _opcoes;
    private readonly TimeProvider _relogio;

    public SimularPagamentoPixCommandHandler(ICobrancaPixRepository cobrancas, IPixProvedor provedor, IUnitOfWork unitOfWork, OpcoesPix opcoes, TimeProvider relogio)
    {
        _cobrancas = cobrancas;
        _provedor = provedor;
        _unitOfWork = unitOfWork;
        _opcoes = opcoes;
        _relogio = relogio;
    }

    public async Task<CobrancaPixDto> Handle(SimularPagamentoPixCommand request, CancellationToken cancellationToken)
    {
        if (!_opcoes.PermitirSimulacao)
            throw new DomainException("A simulação de pagamento Pix está desabilitada neste ambiente.");

        var cobranca = await _cobrancas.ObterPorTxIdAsync(request.TxId, cancellationToken)
                       ?? throw new DomainException("Cobrança Pix não encontrada.");
        if (cobranca.Provedor != ProvedoresPix.Simulador)
            throw new DomainException("Somente cobranças geradas pelo simulador podem ter o pagamento simulado.");

        var agora = _relogio.GetUtcNow().UtcDateTime;
        cobranca.Confirmar(MetodoConfirmacaoPix.Simulacao, agora);
        await _unitOfWork.CommitAsync(cancellationToken);
        return CobrancaPixDto.De(cobranca, _provedor, agora);
    }
}

// ---------- Confirmação manual por Supervisor ----------

public record ConfirmarPixManualCommand(string TxId, string SupervisorMatricula, string SupervisorPin, string? Observacao) : IRequest<ResultadoConfirmacaoManual>;

/// <param name="SupervisorAutorizado">false quando matrícula/PIN não pertencem a um Supervisor ativo.</param>
public record ResultadoConfirmacaoManual(bool SupervisorAutorizado, CobrancaPixDto? Cobranca);

public class ConfirmarPixManualCommandHandler : IRequestHandler<ConfirmarPixManualCommand, ResultadoConfirmacaoManual>
{
    // Hash fictício para equalizar o tempo de resposta quando a matrícula não existe
    private static readonly string HashFicticio = BCrypt.Net.BCrypt.HashPassword("supervisor-inexistente-atylus");

    private readonly ICobrancaPixRepository _cobrancas;
    private readonly IOperadorRepository _operadores;
    private readonly IPixProvedor _provedor;
    private readonly IUnitOfWork _unitOfWork;
    private readonly TimeProvider _relogio;
    private readonly PDV.Application.Commands.Auth.OpcoesSeguranca _opcoesSeguranca;

    public ConfirmarPixManualCommandHandler(ICobrancaPixRepository cobrancas, IOperadorRepository operadores, IPixProvedor provedor, IUnitOfWork unitOfWork, TimeProvider relogio, PDV.Application.Commands.Auth.OpcoesSeguranca opcoesSeguranca)
    {
        _opcoesSeguranca = opcoesSeguranca;
        _cobrancas = cobrancas;
        _operadores = operadores;
        _provedor = provedor;
        _unitOfWork = unitOfWork;
        _relogio = relogio;
    }

    public async Task<ResultadoConfirmacaoManual> Handle(ConfirmarPixManualCommand request, CancellationToken cancellationToken)
    {
        var cobranca = await _cobrancas.ObterPorTxIdAsync(request.TxId, cancellationToken)
                       ?? throw new DomainException("Cobrança Pix não encontrada.");

        var matricula = (request.SupervisorMatricula ?? string.Empty).Trim().ToUpperInvariant();
        var supervisor = string.IsNullOrEmpty(matricula) ? null : await _operadores.ObterPorMatriculaAsync(matricula, cancellationToken);
        if (supervisor == null)
        {
            BCrypt.Net.BCrypt.Verify(request.SupervisorPin ?? string.Empty, HashFicticio);
            return new ResultadoConfirmacaoManual(false, null);
        }
        if (supervisor.Perfil != PerfilOperador.Supervisor || !supervisor.ValidarPin(request.SupervisorPin ?? string.Empty))
            return new ResultadoConfirmacaoManual(false, null);
        // PIN de fábrica/trivial não confirma recebimento: o supervisor precisa trocá-lo primeiro
        if (_opcoesSeguranca.ExigirTrocaPinTemporario && PDV.Application.Commands.Auth.PoliticaPin.EhTemporario(request.SupervisorPin))
            return new ResultadoConfirmacaoManual(false, null);

        var agora = _relogio.GetUtcNow().UtcDateTime;
        cobranca.Confirmar(MetodoConfirmacaoPix.ManualSupervisor, agora, supervisor.Id, supervisor.Matricula, request.Observacao);
        await _unitOfWork.CommitAsync(cancellationToken);
        return new ResultadoConfirmacaoManual(true, CobrancaPixDto.De(cobranca, _provedor, agora));
    }
}
