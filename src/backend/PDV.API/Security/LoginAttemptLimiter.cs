using System.Collections.Concurrent;

namespace PDV.API.Security;

/// <summary>
/// Bloqueio temporário em memória contra tentativa e erro de PIN (PINs numéricos curtos).
/// Após <see cref="MaxTentativas"/> falhas consecutivas para a mesma chave, novas tentativas
/// são recusadas durante <see cref="TempoBloqueio"/>. Funciona offline e sem alterar o banco.
/// </summary>
public class LoginAttemptLimiter
{
    public int MaxTentativas { get; }
    public TimeSpan TempoBloqueio { get; }

    private readonly ConcurrentDictionary<string, Registro> _registros = new(StringComparer.OrdinalIgnoreCase);
    private readonly TimeProvider _relogio;

    private sealed record Registro(int Falhas, DateTimeOffset? BloqueadoAte);

    public LoginAttemptLimiter(TimeProvider relogio, int maxTentativas = 5, TimeSpan? tempoBloqueio = null)
    {
        _relogio = relogio;
        MaxTentativas = maxTentativas;
        TempoBloqueio = tempoBloqueio ?? TimeSpan.FromMinutes(5);
    }

    /// <summary>Retorna o tempo restante de bloqueio, ou null se a chave pode tentar.</summary>
    public TimeSpan? TempoRestanteBloqueio(string chave)
    {
        if (_registros.TryGetValue(chave, out var reg) && reg.BloqueadoAte is { } ate)
        {
            var restante = ate - _relogio.GetUtcNow();
            if (restante > TimeSpan.Zero)
                return restante;

            _registros.TryRemove(chave, out _);
        }
        return null;
    }

    public void RegistrarFalha(string chave)
    {
        _registros.AddOrUpdate(
            chave,
            _ => new Registro(1, MaxTentativas <= 1 ? _relogio.GetUtcNow().Add(TempoBloqueio) : null),
            (_, atual) =>
            {
                var falhas = atual.Falhas + 1;
                return falhas >= MaxTentativas
                    ? new Registro(0, _relogio.GetUtcNow().Add(TempoBloqueio))
                    : new Registro(falhas, atual.BloqueadoAte);
            });
    }

    public void RegistrarSucesso(string chave) => _registros.TryRemove(chave, out _);
}
