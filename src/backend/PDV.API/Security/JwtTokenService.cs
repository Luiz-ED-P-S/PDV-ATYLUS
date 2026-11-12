using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using PDV.Application.Commands.Auth;

namespace PDV.API.Security;

/// <summary>
/// Perfis de acesso usados como "roles" nos tokens e nos atributos [Authorize].
/// Os nomes coincidem com o enum PerfilOperador.
/// </summary>
public static class Perfis
{
    public const string Operador = "Operador";
    public const string Supervisor = "Supervisor";
}

public static class PdvClaims
{
    public const string Matricula = "matricula";
}

public class JwtOptions
{
    public const string Issuer = "PDV-ATYLUS";
    public const string Audience = "PDV-ATYLUS-Terminais";

    public SymmetricSecurityKey ChaveAssinatura { get; init; } = null!;
    public TimeSpan Validade { get; init; } = TimeSpan.FromHours(12);

    /// <summary>
    /// Resolve a chave de assinatura totalmente offline:
    /// 1) variável de ambiente PDV_JWT_KEY ou configuração Jwt:SigningKey (Base64, mín. 32 bytes);
    /// 2) caso contrário, gera uma chave aleatória e a persiste em "jwt-signing.key" na pasta de dados
    ///    (mesma lógica de diretório do banco). O arquivo é ignorado pelo Git (*.key).
    /// </summary>
    public static JwtOptions Carregar(IConfiguration configuration, IHostEnvironment environment)
    {
        var horas = configuration.GetValue<double?>("Jwt:ExpiracaoHoras") ?? 12;
        var chaveConfigurada = Environment.GetEnvironmentVariable("PDV_JWT_KEY") ?? configuration["Jwt:SigningKey"];

        byte[] chave;
        if (!string.IsNullOrWhiteSpace(chaveConfigurada))
        {
            chave = Convert.FromBase64String(chaveConfigurada.Trim());
        }
        else
        {
            var arquivo = Path.Combine(ResolverDiretorioDados(environment), "jwt-signing.key");
            if (File.Exists(arquivo))
            {
                chave = Convert.FromBase64String(File.ReadAllText(arquivo).Trim());
            }
            else
            {
                chave = RandomNumberGenerator.GetBytes(64);
                File.WriteAllText(arquivo, Convert.ToBase64String(chave));
            }
        }

        if (chave.Length < 32)
            throw new InvalidOperationException("A chave de assinatura JWT deve possuir no mínimo 32 bytes.");

        return new JwtOptions
        {
            ChaveAssinatura = new SymmetricSecurityKey(chave),
            Validade = TimeSpan.FromHours(horas)
        };
    }

    private static string ResolverDiretorioDados(IHostEnvironment environment)
    {
        var customDataDir = Environment.GetEnvironmentVariable("PDV_DATA_DIR");
        if (!string.IsNullOrWhiteSpace(customDataDir))
        {
            Directory.CreateDirectory(customDataDir);
            return customDataDir;
        }

        if (Environment.GetEnvironmentVariable("PDV_DESKTOP_MODE") == "1")
        {
            var appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "PDV-ATYLUS");
            Directory.CreateDirectory(appData);
            return appData;
        }

        return environment.ContentRootPath;
    }

    public TokenValidationParameters ParametrosValidacao() => new()
    {
        ValidateIssuer = true,
        ValidIssuer = Issuer,
        ValidateAudience = true,
        ValidAudience = Audience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = ChaveAssinatura,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(1),
        NameClaimType = ClaimTypes.Name,
        RoleClaimType = ClaimTypes.Role
    };
}

public class JwtTokenService
{
    private readonly JwtOptions _options;

    public JwtTokenService(JwtOptions options)
    {
        _options = options;
    }

    public (string Token, DateTime ExpiraEm) GerarToken(OperadorAutenticadoDto operador)
    {
        var expiraEm = DateTime.UtcNow.Add(_options.Validade);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, operador.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.NameIdentifier, operador.Id.ToString()),
            new(ClaimTypes.Name, operador.Nome),
            new(PdvClaims.Matricula, operador.Matricula),
            new(ClaimTypes.Role, operador.Perfil.ToString())
        };

        var token = new JwtSecurityToken(
            issuer: JwtOptions.Issuer,
            audience: JwtOptions.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiraEm,
            signingCredentials: new SigningCredentials(_options.ChaveAssinatura, SecurityAlgorithms.HmacSha256));

        return (new JwtSecurityTokenHandler().WriteToken(token), expiraEm);
    }
}

public static class ClaimsPrincipalExtensions
{
    public static string? ObterMatricula(this ClaimsPrincipal user) => user.FindFirst(PdvClaims.Matricula)?.Value;

    public static Guid? ObterOperadorId(this ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;
}
