using PDV.Domain.Enums;
using PDV.Domain.Exceptions;

namespace PDV.Domain.Entities;

public class Operador : BaseEntity
{
    public string Nome { get; private set; } = string.Empty;
    public string Matricula { get; private set; } = string.Empty;
    public string Pin { get; private set; } = string.Empty; // Hash BCrypt
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
        Perfil = perfil;
        Ativo = true;

        // Se o PIN já é um hash BCrypt válido, preserva; caso contrário, gera o hash
        if (pin.StartsWith("$2a$") || pin.StartsWith("$2b$") || pin.StartsWith("$2y$"))
        {
            Pin = pin;
        }
        else
        {
            Pin = BCrypt.Net.BCrypt.HashPassword(pin.Trim());
        }
    }

    public void AtualizarPin(string novoPin)
    {
        if (string.IsNullOrWhiteSpace(novoPin) || novoPin.Length < 4)
            throw new DomainException("O novo PIN deve possuir no mínimo 4 dígitos.");

        Pin = BCrypt.Net.BCrypt.HashPassword(novoPin.Trim());
        RegistrarAtualizacao();
    }

    public bool ValidarPin(string pinInformado)
    {
        if (!Ativo || string.IsNullOrWhiteSpace(Pin) || string.IsNullOrWhiteSpace(pinInformado))
            return false;

        var pinTrim = pinInformado.Trim();

        try
        {
            if (Pin.StartsWith("$2a$") || Pin.StartsWith("$2b$") || Pin.StartsWith("$2y$"))
            {
                return BCrypt.Net.BCrypt.Verify(pinTrim, Pin);
            }
            return Pin == pinTrim;
        }
        catch
        {
            return false;
        }
    }
}
