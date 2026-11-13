namespace PDV.Domain.Exceptions;

/// <summary>
/// Operação recusada porque o recurso mudou de estado concorrentemente ou já foi consumido
/// (ex.: cobrança Pix já confirmada ou já utilizada). Mapeada para HTTP 409.
/// </summary>
public class ConflitoException : DomainException
{
    public ConflitoException(string message) : base(message) { }
    public ConflitoException(string message, Exception innerException) : base(message, innerException) { }
}
