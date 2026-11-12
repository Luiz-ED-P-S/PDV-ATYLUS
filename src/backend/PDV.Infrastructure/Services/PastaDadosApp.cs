namespace PDV.Infrastructure.Services;

/// <summary>
/// Pasta de dados auxiliares do aplicativo (configuração de sincronização/empresa).
/// Respeita PDV_DATA_DIR (usada pela versão desktop e pelos testes); sem ela, mantém o comportamento anterior
/// (%APPDATA%\PDV-ATYLUS). Só resolve o caminho — não cria nem lê nada.
/// </summary>
public static class PastaDadosApp
{
    public static string Resolver()
    {
        var personalizada = Environment.GetEnvironmentVariable("PDV_DATA_DIR");
        return !string.IsNullOrWhiteSpace(personalizada)
            ? personalizada
            : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "PDV-ATYLUS");
    }
}
