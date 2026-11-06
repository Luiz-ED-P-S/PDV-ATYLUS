using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using PDV.Application.DTOs;
using PDV.Application.Interfaces;
using PDV.Domain.Entities;
using PDV.Domain.Interfaces;
using PDV.Infrastructure.Context;

namespace PDV.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly PdvDbContext _context;
    private readonly IEmailService _emailService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        PdvDbContext context,
        IEmailService emailService,
        IConfiguration configuration,
        ILogger<AuthService> logger)
    {
        _context = context;
        _emailService = emailService;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<AuthResponseDto> RegisterAsync(RegisterRequestDto dto, CancellationToken cancellationToken = default)
    {
        var emailNormalized = dto.Email.Trim().ToLowerInvariant();

        // Verifica se já existe conta com este e-mail
        var jaExiste = await _context.Users.AnyAsync(u => u.Email == emailNormalized, cancellationToken);
        if (jaExiste)
        {
            return new AuthResponseDto(false, "Este e-mail já está cadastrado no sistema.");
        }

        // Instancia entidade (o construtor aplica BCrypt.HashPassword e gera OTP de 6 dígitos)
        var user = new User(dto.Nome, emailNormalized, dto.Senha);

        await _context.Users.AddAsync(user, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Novo usuário cadastrado: {Email}. Enviando código OTP...", user.Email);

        // Envia o código de 6 dígitos por e-mail via MailKit
        try
        {
            await _emailService.SendVerificationCodeAsync(user.Email, user.VerificationCode!, 15, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar e-mail OTP para {Email}. Código salvo no banco para contingência.", user.Email);
        }

        return new AuthResponseDto(
            true,
            "Cadastro realizado com sucesso! Enviamos um código de verificação de 6 dígitos para o seu e-mail (válido por 15 minutos).",
            null,
            new { user.Id, user.Nome, user.Email, user.IsVerified }
        );
    }

    public async Task<AuthResponseDto> VerifyAsync(VerifyCodeRequestDto dto, CancellationToken cancellationToken = default)
    {
        var emailNormalized = dto.Email.Trim().ToLowerInvariant();

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == emailNormalized, cancellationToken);
        if (user == null)
        {
            return new AuthResponseDto(false, "Usuário não encontrado.");
        }

        if (user.IsVerified)
        {
            return new AuthResponseDto(true, "Esta conta já foi verificada anteriormente. Você pode realizar o login.");
        }

        var codigoValido = user.ValidarCodigo(dto.Codigo);
        if (!codigoValido)
        {
            return new AuthResponseDto(false, "Código de verificação incorreto ou expirado. Solicite um novo código se necessário.");
        }

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("E-mail verificado com sucesso para a conta: {Email}", user.Email);

        return new AuthResponseDto(
            true,
            "E-mail confirmado com sucesso! Sua conta está ativada e pronta para login.",
            null,
            new { user.Id, user.Nome, user.Email, user.IsVerified }
        );
    }

    public async Task<AuthResponseDto> LoginAsync(LoginRequestDto dto, CancellationToken cancellationToken = default)
    {
        var emailNormalized = dto.Email.Trim().ToLowerInvariant();

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == emailNormalized, cancellationToken);

        // Prevenção de timing attack e enumeração: se o usuário não existe ou a senha falha, resposta genérica
        if (user == null || !user.ValidarSenha(dto.Senha))
        {
            return new AuthResponseDto(false, "E-mail ou senha incorretos.");
        }

        // Regra de segurança: Usuário só loga se IsVerified for true
        if (!user.IsVerified)
        {
            return new AuthResponseDto(
                false,
                "A sua conta ainda não foi verificada. Por favor, confirme o código enviado ao seu e-mail antes de efetuar o login."
            );
        }

        // Gera token JWT de autenticação
        var token = GerarJwtToken(user);

        _logger.LogInformation("Login bem-sucedido para: {Email}", user.Email);

        return new AuthResponseDto(
            true,
            "Login realizado com sucesso!",
            token,
            new { user.Id, user.Nome, user.Email, user.IsVerified }
        );
    }

    private string GerarJwtToken(User user)
    {
        var secretKey = _configuration["Jwt:SecretKey"] ?? "AtylusPDV_OfflineFirst_Secret_Key_2026_MinLength32Chars!";
        var issuer = _configuration["Jwt:Issuer"] ?? "AtylusPDV";
        var audience = _configuration["Jwt:Audience"] ?? "AtylusPDVClient";

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Nome),
            new(ClaimTypes.Email, user.Email),
            new("isVerified", user.IsVerified.ToString())
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(12),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
