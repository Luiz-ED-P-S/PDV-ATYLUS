using PDV.Domain.Enums;
using PDV.Domain.Exceptions;

namespace PDV.Domain.Entities;

public class RegistroSincronizacao : BaseEntity
{
    public string TerminalId { get; private set; } = "CX01";
    public string TipoEntidade { get; private set; } = string.Empty;
    public Guid EntidadeId { get; private set; }
    public string Operacao { get; private set; } = string.Empty; // Criar, Atualizar, Cancelar
    public string PayloadJson { get; private set; } = string.Empty;
    public StatusSincronizacao Status { get; private set; } = StatusSincronizacao.Pendente;
    public int Tentativas { get; private set; } = 0;
    public DateTime? UltimaTentativaEm { get; private set; }
    public string? MensagemErro { get; private set; }
    public DateTime? SincronizadoEm { get; private set; }

    protected RegistroSincronizacao() { }

    public RegistroSincronizacao(
        string terminalId,
        string tipoEntidade,
        Guid entidadeId,
        string operacao,
        string payloadJson)
    {
        if (string.IsNullOrWhiteSpace(tipoEntidade))
            throw new DomainException("O tipo de entidade para sincronização é obrigatório.");

        if (entidadeId == Guid.Empty)
            throw new DomainException("O identificador da entidade é obrigatório.");

        if (string.IsNullOrWhiteSpace(operacao))
            throw new DomainException("A operação de sincronização é obrigatória.");

        TerminalId = string.IsNullOrWhiteSpace(terminalId) ? "CX01" : terminalId.Trim();
        TipoEntidade = tipoEntidade.Trim();
        EntidadeId = entidadeId;
        Operacao = operacao.Trim();
        PayloadJson = payloadJson ?? "{}";
        Status = StatusSincronizacao.Pendente;
        Tentativas = 0;
    }

    public void MarcarComoSincronizado()
    {
        Status = StatusSincronizacao.Sincronizado;
        SincronizadoEm = DateTime.UtcNow;
        MensagemErro = null;
        RegistrarAtualizacao();
    }

    public void RegistrarFalha(string erro)
    {
        Status = StatusSincronizacao.Falha;
        Tentativas++;
        UltimaTentativaEm = DateTime.UtcNow;
        MensagemErro = erro;
        RegistrarAtualizacao();
    }

    public void Retentar()
    {
        Status = StatusSincronizacao.Pendente;
        RegistrarAtualizacao();
    }
}
