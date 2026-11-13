using System.Runtime.Versioning;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;

namespace PDV.API.Security;

public enum TipoFalhaChaveJwt
{
    /// <summary>O arquivo ou o diretório da chave não pôde ser lido, criado ou gravado (permissão, bloqueio, disco).</summary>
    AcessoNegado,
    /// <summary>Chave informada por configuração/variável de ambiente é inválida.</summary>
    ConfiguracaoInvalida
}

/// <summary>
/// Falha segura: a API não sobe sem uma chave confiável. A mensagem nunca contém o conteúdo da chave.
/// </summary>
public class ChaveJwtException : Exception
{
    public TipoFalhaChaveJwt Tipo { get; }
    public string? Caminho { get; }

    public ChaveJwtException(TipoFalhaChaveJwt tipo, string mensagem, string? caminho = null, Exception? interna = null)
        : base(mensagem, interna)
    {
        Tipo = tipo;
        Caminho = caminho;
    }
}

/// <summary>
/// Guarda a chave de assinatura dos tokens em um diretório de dados persistente, fora da pasta de instalação.
///
/// Regras:
/// - Chave válida existente: é reutilizada (sessões continuam válidas após reinício/atualização).
/// - Arquivo inexistente: migra a chave legada (pasta de instalação), se válida; senão gera uma nova.
/// - Arquivo corrompido/curto: é preservado em quarentena (*.corrompida-*) e uma nova chave é gerada, com aviso no log.
/// - Falha de permissão/acesso: NÃO gera chave substituta; lança <see cref="ChaveJwtException"/> e a API não inicia.
/// - O arquivo é criado com acesso restrito ao usuário atual (e SYSTEM no Windows).
/// </summary>
public sealed class JwtKeyStore
{
    public const string NomeArquivo = "jwt-signing.key";
    public const int TamanhoMinimoBytes = 32;
    private const int TamanhoGeradoBytes = 64;

    private readonly string _diretorio;
    private readonly string? _diretorioLegado;
    private readonly ILogger _logger;

    public string CaminhoArquivo => Path.Combine(_diretorio, NomeArquivo);

    public JwtKeyStore(string diretorio, ILogger logger, string? diretorioLegado = null)
    {
        _diretorio = Path.GetFullPath(diretorio);
        _diretorioLegado = string.IsNullOrWhiteSpace(diretorioLegado) ? null : Path.GetFullPath(diretorioLegado);
        _logger = logger;
    }

    /// <summary>
    /// Diretório da chave, independente da pasta de instalação:
    /// 1) PDV_JWT_KEY_DIR (explícito); 2) PDV_DATA_DIR (mesma pasta do banco); 3) %APPDATA%\PDV-ATYLUS
    /// (pasta de dados já usada pelo modo desktop e pela configuração de sincronização).
    /// </summary>
    public static string ResolverDiretorio(string? pdvJwtKeyDir, string? pdvDataDir, string pastaAppData)
    {
        if (!string.IsNullOrWhiteSpace(pdvJwtKeyDir)) return pdvJwtKeyDir;
        if (!string.IsNullOrWhiteSpace(pdvDataDir)) return pdvDataDir;
        return Path.Combine(pastaAppData, "PDV-ATYLUS");
    }

    public byte[] ObterOuCriarChave()
    {
        GarantirDiretorio();

        var existente = LerChave(CaminhoArquivo, out var corrompida);
        if (existente != null)
        {
            RestringirSeAberto(CaminhoArquivo);
            return existente;
        }

        if (corrompida)
        {
            var quarentena = $"{CaminhoArquivo}.corrompida-{DateTime.UtcNow:yyyyMMddHHmmss}";
            Executar(() => File.Move(CaminhoArquivo, quarentena), CaminhoArquivo, "mover o arquivo de chave corrompido para quarentena");
            _logger.LogWarning(
                "Chave de autenticação corrompida ou inválida em {Caminho}. O arquivo foi preservado em {Quarentena} " +
                "e uma nova chave será gerada; todas as sessões abertas precisarão de novo login.",
                CaminhoArquivo, quarentena);
            return GerarEGravar();
        }

        var legada = TentarMigrarLegada();
        if (legada != null)
            return legada;

        _logger.LogInformation("Nenhuma chave de autenticação encontrada. Gerando nova chave em {Caminho}.", CaminhoArquivo);
        return GerarEGravar();
    }

    private void GarantirDiretorio()
    {
        Executar(() => Directory.CreateDirectory(_diretorio), _diretorio, "criar ou acessar o diretório de dados da chave");
    }

    /// <summary>Retorna a chave, ou null se o arquivo não existe (corrompida=false) ou é inválido (corrompida=true).</summary>
    private byte[]? LerChave(string caminho, out bool corrompida)
    {
        corrompida = false;
        if (!File.Exists(caminho) && !Directory.Exists(caminho))
            return null;

        var conteudo = Executar(() => File.ReadAllText(caminho), caminho, "ler o arquivo de chave");
        try
        {
            var chave = Convert.FromBase64String(conteudo.Trim());
            if (chave.Length >= TamanhoMinimoBytes)
                return chave;
        }
        catch (FormatException)
        {
            // conteúdo não é Base64 válido
        }

        corrompida = true;
        return null;
    }

    private byte[]? TentarMigrarLegada()
    {
        if (_diretorioLegado == null)
            return null;

        var caminhoLegado = Path.Combine(_diretorioLegado, NomeArquivo);
        if (string.Equals(caminhoLegado, CaminhoArquivo, StringComparison.OrdinalIgnoreCase))
            return null;

        var chave = LerChave(caminhoLegado, out var corrompida);
        if (chave == null)
        {
            if (corrompida)
                _logger.LogWarning("Chave legada inválida em {Caminho} foi ignorada (arquivo mantido sem alterações).", caminhoLegado);
            return null;
        }

        if (!Gravar(chave))
            return LerChaveCriadaPorOutroProcesso();
        _logger.LogWarning(
            "Chave de autenticação migrada de {Origem} para {Destino}; as sessões existentes continuam válidas. " +
            "O arquivo antigo foi mantido e pode ser removido após validar o sistema.",
            caminhoLegado, CaminhoArquivo);
        return chave;
    }

    private byte[] GerarEGravar()
    {
        var chave = RandomNumberGenerator.GetBytes(TamanhoGeradoBytes);
        return Gravar(chave) ? chave : LerChaveCriadaPorOutroProcesso();
    }

    /// <summary>Outra instância do PDV criou a chave ao mesmo tempo: usa a dela para não invalidar sessões.</summary>
    private byte[] LerChaveCriadaPorOutroProcesso()
    {
        var chave = LerChave(CaminhoArquivo, out _);
        if (chave == null)
            throw new ChaveJwtException(TipoFalhaChaveJwt.AcessoNegado,
                $"O arquivo de chave '{CaminhoArquivo}' foi criado por outro processo, mas está inválido. " +
                "Encerre as outras instâncias do PDV e inicie novamente.", CaminhoArquivo);
        return chave;
    }

    /// <summary>
    /// Grava em arquivo temporário já protegido e move para o nome final, sem sobrescrever.
    /// Retorna false se outro processo criou o arquivo final no intervalo.
    /// </summary>
    private bool Gravar(byte[] chave)
    {
        var temporario = Path.Combine(_diretorio, $"{NomeArquivo}.{Guid.NewGuid():N}.tmp");
        try
        {
            Executar(() =>
            {
                using (var fluxo = CriarArquivoProtegido(temporario))
                using (var escritor = new StreamWriter(fluxo))
                {
                    escritor.Write(Convert.ToBase64String(chave));
                }
            }, temporario, "gravar o arquivo de chave");

            try
            {
                File.Move(temporario, CaminhoArquivo, overwrite: false);
            }
            catch (IOException) when (File.Exists(CaminhoArquivo))
            {
                return false;
            }
            catch (Exception ex) when (ex is UnauthorizedAccessException or IOException)
            {
                Executar(() => throw ex, CaminhoArquivo, "gravar o arquivo de chave");
            }
            return true;
        }
        finally
        {
            try { if (File.Exists(temporario)) File.Delete(temporario); } catch { /* melhor esforço */ }
        }
    }

    /// <summary>
    /// Chave criada por versões anteriores pode ter herdado permissões amplas. Restringe apenas se o arquivo
    /// pertence ao usuário atual, para nunca bloquear outra conta que também use a mesma chave.
    /// </summary>
    private void RestringirSeAberto(string caminho)
    {
        try
        {
            if (OperatingSystem.IsWindows())
            {
                var atual = new FileInfo(caminho).GetAccessControl();
                var dono = atual.GetOwner(typeof(SecurityIdentifier));
                if (!atual.AreAccessRulesProtected && dono == WindowsIdentity.GetCurrent().User)
                    ProtegerArquivo(caminho, criticoSeFalhar: false);
            }
            else if ((File.GetUnixFileMode(caminho) & (UnixFileMode.GroupRead | UnixFileMode.OtherRead | UnixFileMode.GroupWrite | UnixFileMode.OtherWrite)) != 0)
            {
                ProtegerArquivo(caminho, criticoSeFalhar: false);
            }
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException or PlatformNotSupportedException)
        {
            _logger.LogWarning("Não foi possível verificar as permissões do arquivo de chave {Caminho} ({Erro}).", caminho, ex.GetType().Name);
        }
    }

    private static FileStream CriarArquivoProtegido(string caminho)
    {
        if (OperatingSystem.IsWindows())
            return new FileInfo(caminho).Create(FileMode.CreateNew, FileSystemRights.FullControl, FileShare.None, 4096, FileOptions.None, SegurancaRestrita());

        var fluxo = new FileStream(caminho, new FileStreamOptions
        {
            Mode = FileMode.CreateNew,
            Access = FileAccess.Write,
            Share = FileShare.None,
            UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite
        });
        return fluxo;
    }

    /// <summary>Restringe o arquivo ao usuário atual (e SYSTEM no Windows), sem herança de permissões.</summary>
    private void ProtegerArquivo(string caminho, bool criticoSeFalhar)
    {
        try
        {
            if (OperatingSystem.IsWindows())
                new FileInfo(caminho).SetAccessControl(SegurancaRestrita());
            else
                File.SetUnixFileMode(caminho, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException or PlatformNotSupportedException or InvalidOperationException)
        {
            if (criticoSeFalhar) throw;
            _logger.LogWarning("Não foi possível restringir as permissões do arquivo de chave {Caminho} ({Erro}).", caminho, ex.GetType().Name);
        }
    }

    [SupportedOSPlatform("windows")]
    private static FileSecurity SegurancaRestrita()
    {
        var seguranca = new FileSecurity();
        seguranca.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
        var usuario = WindowsIdentity.GetCurrent().User!;
        seguranca.SetOwner(usuario);
        seguranca.AddAccessRule(new FileSystemAccessRule(usuario, FileSystemRights.FullControl, AccessControlType.Allow));
        seguranca.AddAccessRule(new FileSystemAccessRule(
            new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null), FileSystemRights.FullControl, AccessControlType.Allow));
        return seguranca;
    }

    private static void Executar(Action acao, string caminho, string operacao) =>
        Executar(() => { acao(); return true; }, caminho, operacao);

    private static T Executar<T>(Func<T> acao, string caminho, string operacao)
    {
        try
        {
            return acao();
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException or System.Security.SecurityException)
        {
            throw new ChaveJwtException(
                TipoFalhaChaveJwt.AcessoNegado,
                $"Não foi possível {operacao} em '{caminho}' ({ex.GetType().Name}). " +
                "A API não será iniciada para não invalidar sessões nem gerar uma chave substituta sem controle. " +
                "Verifique as permissões do usuário que executa o PDV nesse caminho, ou defina PDV_JWT_KEY_DIR " +
                "para um diretório gravável e protegido.",
                caminho, ex);
        }
    }
}
