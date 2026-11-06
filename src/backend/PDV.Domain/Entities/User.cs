using System.Security.Cryptography;
using PDV.Domain.Exceptions;

namespace PDV.Domain.Entities;

/// <summary>
/// Entidade de Usuário para autenticação segura com verificação OTP por e-mail.
/// </summary>
public class User : BaseEntity
{
    public string Nome { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public bool IsVerified { get; private set; } = false;
    public string? VerificationCode { get; private set; }
    public DateTime? VerificationCodeExpiresAt { get; private set; }
    public DateTime? VerifiedAt { get; private set; }

    protected User() { }

    public User(string nome, string email, string plainPassword)
    {
        if (string.IsNullOrWhiteSpace(nome))
            throw new DomainException("O nome do usuário é obrigatório.");

        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            throw new DomainException("E-mail inválido.");

        if (string.IsNullOrWhiteSpace(plainPassword) || plainPassword.Length < 6)
            throw new DomainException("A senha deve possuir no mínimo 6 caracteres.");

        Nome = nome.Trim();
        Email = email.Trim().ToLowerInvariant();
        IsVerified = false;

        // Criptografia de senha com BCrypt e Salt automático (WorkFactor padrão seguro = 12)
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(plainPassword, workFactor: 12);

        // Gera o código OTP inicial de 6 dígitos criptograficamente seguro
        GerarCodigoVerificacao(15);
    }

    /// <summary>
    /// Gera um código numérico de 6 dígitos aleatório usando CSPRNG (RandomNumberGenerator)
    /// </summary>
    public void GerarCodigoVerificacao(int validadeMinutos = 15)
    {
        // Geração segura contra previsibilidade (evita System.Random)
        var codigoNumerico = RandomNumberGenerator.GetInt32(100000, 1000000);
        VerificationCode = codigoNumerico.ToString();
        VerificationCodeExpiresAt = DateTime.UtcNow.AddMinutes(validadeMinutos);
        RegistrarAtualizacao();
    }

    /// <summary>
    /// Valida o código OTP informado pelo usuário
    /// </summary>
    public bool ValidarCodigo(string codigoInformado)
    {
        if (string.IsNullOrWhiteSpace(codigoInformado) || string.IsNullOrWhiteSpace(VerificationCode))
            return false;

        if (VerificationCodeExpiresAt == null || DateTime.UtcNow > VerificationCodeExpiresAt.Value)
            return false;

        if (VerificationCode.Trim() != codigoInformado.Trim())
            return false;

        IsVerified = true;
        VerifiedAt = DateTime.UtcNow;
        VerificationCode = null;
        VerificationCodeExpiresAt = null;
        RegistrarAtualizacao();

        return true;
    }

    /// <summary>
    /// Valida a senha fornecida comparando com o hash BCrypt salvo
    /// </summary>
    public bool ValidarSenha(string plainPassword)
    {
        if (string.IsNullOrWhiteSpace(plainPassword) || string.IsNullOrWhiteSpace(PasswordHash))
            return false;

        try
        {
            return BCrypt.Net.BCrypt.Verify(plainPassword, PasswordHash);
        }
        catch
        {
            return false;
        }
    }
}
