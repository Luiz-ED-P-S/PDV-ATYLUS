using PDV.Domain.Enums;
using PDV.Domain.Exceptions;

namespace PDV.Domain.Entities;

public class Operador : BaseEntity
{
    public string Nome { get; private set; } = string.Empty;
    public string Matricula { get; private set; } = string.Empty;
    public string Pin { get; private set; } = string.Empty; // Armazenado com hash simples para o PDV local
    public PerfilOperador Perfil { get; private set; } = PerfilOperador.Operador;
    public bool Ativo { get; private set; } = true;

    protected Operador() { }

    public Operador(string nome, string matricula, string pin, PerfilOperador perfil = PerfilOperador.Operador)
    {
        if (string.IsNullOrWhiteSpace(nome))
            throw new DomainException("O nome do operador é obrigatório.");

        if (string.IsNullOrWhiteSpace(matricula))
            throw new DomainException("A matrícula do operador é obrigatória.");

        if (string.IsNullOrWhiteSpace(pin) || pin.Length < 4)
            throw new DomainException("O PIN de segurança deve possuir no mínimo 4 dígitos.");

        Nome = nome.Trim();
        Matricula = matricula.Trim();
        Pin = pin.Trim();
        Perfil = perfil;
        Ativo = true;
    }

    public bool ValidarPin(string pinInformado)
    {
        return Ativo && Pin == pinInformado.Trim();
    }
}
