using PDV.Domain.Enums;
using PDV.Domain.Exceptions;

namespace PDV.Domain.Entities;

/// <summary>
/// Cobrança Pix persistida. O ciclo de vida é controlado aqui e as transições só são aceitas a partir do
/// estado correto: Pendente → Confirmada → Utilizada (ou Pendente → Expirada).
/// O <see cref="Status"/> é token de concorrência no banco: duas operações simultâneas sobre a mesma cobrança
/// (confirmação dupla ou duas vendas) não conseguem ambas gravar.
/// </summary>
public class CobrancaPix : BaseEntity
{
    public const int MinutosValidade = 15;

    public string TxId { get; private set; } = string.Empty;
    public decimal Valor { get; private set; }
    public string Provedor { get; private set; } = string.Empty;
    public StatusCobrancaPix Status { get; private set; } = StatusCobrancaPix.Pendente;
    public DateTime ExpiraEm { get; private set; }
    public string OperadorMatricula { get; private set; } = string.Empty;
    public Guid CaixaId { get; private set; }
    public string TerminalId { get; private set; } = "CX01";

    public MetodoConfirmacaoPix? MetodoConfirmacao { get; private set; }
    public DateTime? ConfirmadoEm { get; private set; }
    public Guid? SupervisorId { get; private set; }
    public string? SupervisorMatricula { get; private set; }
    public string? ObservacaoConfirmacao { get; private set; }

    public Guid? VendaId { get; private set; }
    public DateTime? UtilizadoEm { get; private set; }

    protected CobrancaPix() { }

    public CobrancaPix(string txId, decimal valor, string provedor, string operadorMatricula, Guid caixaId, string terminalId, DateTime agoraUtc)
    {
        if (string.IsNullOrWhiteSpace(txId))
            throw new DomainException("O identificador da cobrança Pix é obrigatório.");
        if (valor <= 0)
            throw new DomainException("O valor da cobrança Pix deve ser maior que zero.");
        if (decimal.Round(valor, 2) != valor)
            throw new DomainException("O valor da cobrança Pix deve ter no máximo 2 casas decimais.");
        if (caixaId == Guid.Empty)
            throw new DomainException("É necessário um caixa aberto para gerar uma cobrança Pix.");
        if (string.IsNullOrWhiteSpace(operadorMatricula))
            throw new DomainException("O operador da cobrança Pix é obrigatório.");

        TxId = txId.Trim();
        Valor = valor;
        Provedor = provedor;
        OperadorMatricula = operadorMatricula.Trim();
        CaixaId = caixaId;
        TerminalId = string.IsNullOrWhiteSpace(terminalId) ? "CX01" : terminalId.Trim();
        Status = StatusCobrancaPix.Pendente;
        CriadoEm = agoraUtc;
        ExpiraEm = agoraUtc.AddMinutes(MinutosValidade);
    }

    public bool Expirou(DateTime agoraUtc) => Status == StatusCobrancaPix.Pendente && agoraUtc > ExpiraEm;

    /// <summary>Confirma o recebimento. Só a partir de Pendente e dentro da validade.</summary>
    public void Confirmar(MetodoConfirmacaoPix metodo, DateTime agoraUtc, Guid? supervisorId = null, string? supervisorMatricula = null, string? observacao = null)
    {
        if (Status == StatusCobrancaPix.Confirmada || Status == StatusCobrancaPix.Utilizada)
            throw new ConflitoException($"A cobrança Pix {TxId} já foi confirmada e não pode ser confirmada novamente.");
        if (Status != StatusCobrancaPix.Pendente)
            throw new DomainException($"A cobrança Pix {TxId} não está pendente (situação: {Status}).");
        if (Expirou(agoraUtc))
            throw new DomainException($"A cobrança Pix {TxId} expirou. Gere uma nova cobrança.");
        if (metodo == MetodoConfirmacaoPix.ManualSupervisor && (supervisorId == null || string.IsNullOrWhiteSpace(supervisorMatricula)))
            throw new DomainException("A confirmação manual exige a identificação do Supervisor.");

        Status = StatusCobrancaPix.Confirmada;
        MetodoConfirmacao = metodo;
        ConfirmadoEm = agoraUtc;
        SupervisorId = supervisorId;
        SupervisorMatricula = supervisorMatricula?.Trim();
        ObservacaoConfirmacao = string.IsNullOrWhiteSpace(observacao) ? null : observacao.Trim()[..Math.Min(observacao.Trim().Length, 300)];
        RegistrarAtualizacao();
    }

    /// <summary>Vincula a cobrança confirmada a uma venda. Só uma vez, com o mesmo valor do pagamento.</summary>
    public void Utilizar(Guid vendaId, Guid caixaId, decimal valorPagamento, DateTime agoraUtc)
    {
        if (Status == StatusCobrancaPix.Utilizada)
            throw new ConflitoException($"A cobrança Pix {TxId} já foi utilizada em outra venda.");
        if (Status != StatusCobrancaPix.Confirmada)
            throw new DomainException($"O Pix {TxId} ainda não teve o recebimento confirmado. Aguarde a confirmação antes de finalizar a venda.");
        if (valorPagamento != Valor)
            throw new DomainException($"O valor do pagamento Pix (R$ {valorPagamento:F2}) é diferente do valor da cobrança {TxId} (R$ {Valor:F2}).");
        if (caixaId != CaixaId)
            throw new DomainException($"A cobrança Pix {TxId} pertence a outro caixa.");

        Status = StatusCobrancaPix.Utilizada;
        VendaId = vendaId;
        UtilizadoEm = agoraUtc;
        RegistrarAtualizacao();
    }
}
