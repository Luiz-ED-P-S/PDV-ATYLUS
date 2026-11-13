namespace PDV.Application.Commands.Auth;

/// <summary>
/// Política de PIN: define o que é um PIN "temporário" (de fábrica ou trivial) e o que é aceito como PIN novo.
/// Funciona somente com o PIN em texto informado no momento (login/troca); nada é gravado nem registrado em log.
/// </summary>
public static class PoliticaPin
{
    public const int Minimo = 4;
    public const int Maximo = 8;

    /// <summary>PINs da carga inicial (seed). Nunca podem ser reutilizados como PIN novo.</summary>
    public static readonly IReadOnlySet<string> PinsDeFabrica = new HashSet<string> { "0000", "1234" };

    /// <summary>
    /// PIN temporário: o operador deve trocá-lo antes de usar o sistema.
    /// É temporário o PIN de fábrica ou qualquer PIN trivial (repetido ou sequencial).
    /// </summary>
    public static bool EhTemporario(string? pin)
    {
        var p = (pin ?? string.Empty).Trim();
        return p.Length > 0 && (PinsDeFabrica.Contains(p) || EhTrivial(p));
    }

    /// <summary>Retorna a mensagem de erro se o PIN novo não for aceito; null se for válido.</summary>
    public static string? Validar(string? novoPin)
    {
        var p = (novoPin ?? string.Empty).Trim();
        if (p.Length == 0) return "O novo PIN é obrigatório.";
        if (!p.All(char.IsAsciiDigit)) return "O PIN deve conter apenas números.";
        if (p.Length < Minimo || p.Length > Maximo) return $"O PIN deve ter entre {Minimo} e {Maximo} dígitos.";
        if (PinsDeFabrica.Contains(p)) return "Não é permitido reutilizar o PIN inicial de fábrica.";
        if (EhTrivial(p)) return "O PIN não pode ser sequencial nem formado por dígitos repetidos (ex.: 1234, 4321, 1111, 1212).";
        return null;
    }

    private static bool EhTrivial(string p)
    {
        if (p.Length < 2 || !p.All(char.IsAsciiDigit)) return false;

        // Sequência crescente ou decrescente (inclui a volta 9→0): 1234, 4321, 7890, 0123
        var cresc = true;
        var decresc = true;
        for (var i = 1; i < p.Length; i++)
        {
            var passo = (p[i] - p[i - 1] + 10) % 10;
            if (passo != 1) cresc = false;
            if (passo != 9) decresc = false;
        }
        if (cresc || decresc) return true;

        // Bloco repetido: 0000, 1111, 1212, 123123
        for (var tamanho = 1; tamanho <= p.Length / 2; tamanho++)
        {
            if (p.Length % tamanho != 0) continue;
            var bloco = p[..tamanho];
            if (string.Concat(Enumerable.Repeat(bloco, p.Length / tamanho)) == p) return true;
        }
        return false;
    }
}

/// <summary>
/// Opções de segurança decididas no servidor. A exigência de troca do PIN temporário só pode ser
/// desligada em Development/Testing (testes automatizados); em qualquer outro ambiente é sempre obrigatória.
/// </summary>
public sealed class OpcoesSeguranca
{
    public bool ExigirTrocaPinTemporario { get; init; } = true;

    public static OpcoesSeguranca Para(string ambiente, bool? exigirConfigurado) => new()
    {
        ExigirTrocaPinTemporario = !(exigirConfigurado == false &&
                                     (string.Equals(ambiente, "Development", StringComparison.OrdinalIgnoreCase) ||
                                      string.Equals(ambiente, "Testing", StringComparison.OrdinalIgnoreCase)))
    };
}
