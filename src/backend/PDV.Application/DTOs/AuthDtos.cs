using System.ComponentModel.DataAnnotations;

namespace PDV.Application.DTOs;

public record RegisterRequestDto(
    [Required(ErrorMessage = "O nome é obrigatório.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "O nome deve ter entre 2 e 100 caracteres.")]
    string Nome,

    [Required(ErrorMessage = "O e-mail é obrigatório.")]
    [EmailAddress(ErrorMessage = "Formato de e-mail inválido.")]
    string Email,

    [Required(ErrorMessage = "A senha é obrigatória.")]
    [StringLength(100, MinimumLength = 6, ErrorMessage = "A senha deve ter no mínimo 6 caracteres.")]
    string Senha
);

public record VerifyCodeRequestDto(
    [Required(ErrorMessage = "O e-mail é obrigatório.")]
    [EmailAddress(ErrorMessage = "Formato de e-mail inválido.")]
    string Email,

    [Required(ErrorMessage = "O código de verificação é obrigatório.")]
    [StringLength(6, MinimumLength = 6, ErrorMessage = "O código deve ter 6 dígitos.")]
    string Codigo
);

public record LoginRequestDto(
    [Required(ErrorMessage = "O e-mail é obrigatório.")]
    [EmailAddress(ErrorMessage = "Formato de e-mail inválido.")]
    string Email,

    [Required(ErrorMessage = "A senha é obrigatória.")]
    string Senha
);

public record AuthResponseDto(
    bool Sucesso,
    string Mensagem,
    string? Token = null,
    object? Usuario = null
);
