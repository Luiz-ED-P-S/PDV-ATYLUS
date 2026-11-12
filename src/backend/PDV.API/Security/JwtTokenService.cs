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

    public const string ClaimCarimbo = "sstamp";

    public SymmetricSecurityKey ChaveAssinatura { get; }
    public TimeSpan Validade { get; }

    private readonly byte[] _chave;

    public JwtOptions(byte[] chave, TimeSpan validade)
    {
        if (chave.Length < JwtKeyStore.TamanhoMinimoBytes)
            throw new ChaveJwtException(TipoFalhaChaveJwt.ConfiguracaoInvalida,
                $"A chave de assinatura deve possuir no mínimo {JwtKeyStore.TamanhoMinimoBytes} bytes.");

        _chave = chave;
        ChaveAssinatura = new SymmetricSecurityKey(chave);
        Validade = validade;
    }

    /// <summary>
    /// Resolve a chave de assinatura totalmente offline, sem nunca registrá-la em log:
    /// 1) PDV_JWT_KEY ou Jwt:SigningKey (Base64, mín. 32 bytes) — inválida = falha de inicialização;
    /// 2) caso contrário, arquivo protegido gerenciado por <see cref="JwtKeyStore"/> no diretório de dados
    ///    (PDV_JWT_KEY_DIR → PDV_DATA_DIR → %APPDATA%\PDV-ATYLUS), migrando a chave legada da pasta de instalação.
    /// </summary>
    public static JwtOptions Carregar(IConfiguration configuration, IHostEnvironment environment, ILogger logger)
    {
        var validade = TimeSpan.FromHours(configuration.GetValue<double?>("Jwt:ExpiracaoHoras") ?? 12);
        var chaveConfigurada = Environment.GetEnvironmentVariable("PDV_JWT_KEY") ?? configuration["Jwt:SigningKey"];

        if (!string.IsNullOrWhiteSpace(chaveConfigurada))
        {
            byte[] chave;
            try
            {
                chave = Convert.FromBase64String(chaveConfigurada.Trim());
            }
            catch (FormatException)
            {
                throw new ChaveJwtException(TipoFalhaChaveJwt.ConfiguracaoInvalida,
                    "A chave definida em PDV_JWT_KEY/Jwt:SigningKey não é Base64 válido.");
            }
            return new JwtOptions(chave, validade);
        }

        var diretorio = JwtKeyStore.ResolverDiretorio(
            Environment.GetEnvironmentVariable("PDV_JWT_KEY_DIR") ?? configuration["Jwt:DiretorioChave"],
            Environment.GetEnvironmentVariable("PDV_DATA_DIR"),
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData));

        // Versões anteriores gravavam a chave na pasta de execução (ContentRoot); ela é migrada se for válida.
        var store = new JwtKeyStore(diretorio, logger, diretorioLegado: environment.ContentRootPath);
        return new JwtOptions(store.ObterOuCriarChave(), validade);
    }

    /// <summary>
    /// Vincula o token ao estado de segurança do operador (hash do PIN + perfil) sem expor esse estado:
    /// HMAC-SHA256 com a chave de assinatura, truncado a 128 bits.
    /// </summary>
    public string CalcularCarimbo(string estadoSegurancaOperador)
    {
        var mac = HMACSHA256.HashData(_chave, Encoding.UTF8.GetBytes(estadoSegurancaOperador));
        return Base64UrlEncoder.Encode(mac.AsSpan(0, 16).ToArray());
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
            new(ClaimTypes.Role, operador.Perfil.ToString()),
            new(JwtOptions.ClaimCarimbo, _options.CalcularCarimbo(operador.EstadoSeguranca))
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
