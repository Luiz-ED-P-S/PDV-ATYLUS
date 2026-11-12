using MediatR;
using PDV.Domain.Entities;
using PDV.Domain.Enums;
using PDV.Domain.Exceptions;
using PDV.Domain.Interfaces;

namespace PDV.Application.Commands.Auth;

/// <summary>
/// Dados do operador autenticado com sucesso (nunca inclui o hash do PIN).
/// </summary>
public record OperadorAutenticadoDto(
    Guid Id,
    string Nome,
    string Matricula,
    PerfilOperador Perfil,
    bool UsaPinPadrao);

/// <summary>
/// Autentica um operador ativo por matrícula + PIN, validando o hash BCrypt armazenado no SQLite.
/// Retorna null quando as credenciais são inválidas (sem revelar se a matrícula existe).
/// </summary>
public record AutenticarOperadorCommand(string Matricula, string Pin) : IRequest<OperadorAutenticadoDto?>;

public class AutenticarOperadorCommandHandler : IRequestHandler<AutenticarOperadorCommand, OperadorAutenticadoDto?>
{
    // PINs criados pela carga inicial (seed). Usados apenas para alertar o usuário a trocá-los.
    private static readonly HashSet<string> PinsPadraoSeed = new() { "0000", "1234" };

    // Hash fictício usado para equalizar o tempo de resposta quando a matrícula não existe.
    private static readonly string HashFicticio = BCrypt.Net.BCrypt.HashPassword("pin-inexistente-atylus");

    private readonly IOperadorRepository _operadorRepository;

    public AutenticarOperadorCommandHandler(IOperadorRepository operadorRepository)
    {
        _operadorRepository = operadorRepository;
    }

    public async Task<OperadorAutenticadoDto?> Handle(AutenticarOperadorCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Matricula) || string.IsNullOrWhiteSpace(request.Pin))
            return null;

        var operador = await _operadorRepository.ObterPorMatriculaAsync(request.Matricula.Trim(), cancellationToken);

        if (operador == null)
        {
            BCrypt.Net.BCrypt.Verify(request.Pin.Trim(), HashFicticio);
            return null;
        }

        if (!operador.ValidarPin(request.Pin))
            return null;

        return ParaDto(operador, PinsPadraoSeed.Contains(request.Pin.Trim()));
    }

    internal static OperadorAutenticadoDto ParaDto(Operador operador, bool usaPinPadrao) =>
        new(operador.Id, operador.Nome, operador.Matricula, operador.Perfil, usaPinPadrao);
}

/// <summary>
/// Valida um PIN de supervisor ativo (autorização pontual de operações sensíveis no terminal).
/// </summary>
public record ValidarPinSupervisorCommand(string Pin) : IRequest<OperadorAutenticadoDto?>;

public class ValidarPinSupervisorCommandHandler : IRequestHandler<ValidarPinSupervisorCommand, OperadorAutenticadoDto?>
{
    private readonly IOperadorRepository _operadorRepository;

    public ValidarPinSupervisorCommandHandler(IOperadorRepository operadorRepository)
    {
        _operadorRepository = operadorRepository;
    }

    public async Task<OperadorAutenticadoDto?> Handle(ValidarPinSupervisorCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Pin))
            return null;

        var supervisores = await _operadorRepository.ObterSupervisoresAtivosAsync(cancellationToken);
        var supervisor = supervisores.FirstOrDefault(s => s.ValidarPin(request.Pin));
        return supervisor == null ? null : AutenticarOperadorCommandHandler.ParaDto(supervisor, false);
    }
}

/// <summary>
/// Troca o PIN do próprio operador autenticado, exigindo o PIN atual.
/// </summary>
public record AlterarPinCommand(Guid OperadorId, string PinAtual, string NovoPin) : IRequest<bool>;

public class AlterarPinCommandHandler : IRequestHandler<AlterarPinCommand, bool>
{
    private readonly IOperadorRepository _operadorRepository;
    private readonly IUnitOfWork _unitOfWork;

    public AlterarPinCommandHandler(IOperadorRepository operadorRepository, IUnitOfWork unitOfWork)
    {
        _operadorRepository = operadorRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<bool> Handle(AlterarPinCommand request, CancellationToken cancellationToken)
    {
        var operador = await _operadorRepository.ObterPorIdAsync(request.OperadorId, cancellationToken);
        if (operador == null || !operador.Ativo || !operador.ValidarPin(request.PinAtual))
            return false;

        var novoPin = (request.NovoPin ?? string.Empty).Trim();
        if (novoPin == request.PinAtual.Trim())
            throw new DomainException("O novo PIN deve ser diferente do PIN atual.");

        operador.AtualizarPin(novoPin);
        await _unitOfWork.CommitAsync(cancellationToken);
        return true;
    }
}
