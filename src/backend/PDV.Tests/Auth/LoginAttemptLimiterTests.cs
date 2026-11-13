using PDV.API.Security;

namespace PDV.Tests.Auth;

public class LoginAttemptLimiterTests
{
    private sealed class RelogioFalso : TimeProvider
    {
        public DateTimeOffset Agora { get; set; } = new(2026, 1, 1, 8, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Agora;
    }

    [Fact]
    public void BloqueiaAposMaximoDeFalhas_ELiberaAposTempo()
    {
        var relogio = new RelogioFalso();
        var limiter = new LoginAttemptLimiter(relogio, maxTentativas: 3, tempoBloqueio: TimeSpan.FromMinutes(5));

        limiter.RegistrarFalha("OP01");
        limiter.RegistrarFalha("OP01");
        Assert.Null(limiter.TempoRestanteBloqueio("OP01"));

        limiter.RegistrarFalha("OP01");
        Assert.NotNull(limiter.TempoRestanteBloqueio("OP01"));
        Assert.Null(limiter.TempoRestanteBloqueio("GER01")); // outras chaves não são afetadas

        relogio.Agora = relogio.Agora.AddMinutes(5).AddSeconds(1);
        Assert.Null(limiter.TempoRestanteBloqueio("OP01"));
    }

    [Fact]
    public void SucessoZeraContagemDeFalhas()
    {
        var limiter = new LoginAttemptLimiter(new RelogioFalso(), maxTentativas: 2);

        limiter.RegistrarFalha("OP01");
        limiter.RegistrarSucesso("OP01");
        limiter.RegistrarFalha("OP01");

        Assert.Null(limiter.TempoRestanteBloqueio("OP01"));
    }
}
