using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using PDV.Domain.Entities;
using PDV.Domain.Interfaces;

namespace PDV.Infrastructure.Services;

public class TokenService : ITokenService
{
    private readonly IConfiguration _configuration;

    public TokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string GerarToken(Operador operador)
    {
        var secretKey = _configuration["Jwt:SecretKey"] ?? "AtylusPDV_OfflineFirst_Secret_Key_2026_MinLength32Chars!";
        var issuer = _configuration["Jwt:Issuer"] ?? "AtylusPDV";
        var audience = _configuration["Jwt:Audience"] ?? "AtylusPDVClient";
        var expiracaoHorasStr = _configuration["Jwt:ExpiracaoHoras"] ?? "12";
        if (!double.TryParse(expiracaoHorasStr, out var expiracaoHoras))
        {
            expiracaoHoras = 12;
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, operador.Id.ToString()),
            new(ClaimTypes.Name, operador.Nome),
            new("matricula", operador.Matricula),
            new(ClaimTypes.Role, operador.Perfil.ToString())
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(expiracaoHoras),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
