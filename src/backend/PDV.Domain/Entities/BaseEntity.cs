namespace PDV.Domain.Entities;

public abstract class BaseEntity
{
    public Guid Id { get; protected set; } = Guid.NewGuid();
    public DateTime CriadoEm { get; protected set; } = DateTime.UtcNow;
    public DateTime? AtualizadoEm { get; protected set; }

    public void RegistrarAtualizacao()
    {
        AtualizadoEm = DateTime.UtcNow;
    }
}
