using System.Runtime.Versioning;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using Microsoft.Extensions.Logging;
using PDV.API.Security;

namespace PDV.Tests.Seguranca;

/// <summary>
/// Testes do armazenamento da chave JWT usando apenas pastas temporárias.
/// </summary>
public class JwtKeyStoreTests : IDisposable
{
    private readonly string _raiz = Path.Combine(Path.GetTempPath(), "pdv-keystore-" + Guid.NewGuid().ToString("N"));
    private readonly LoggerDeTeste _logger = new();
    private readonly List<Action> _limpezas = new();

    private string Dados => Path.Combine(_raiz, "dados");
    private string Arquivo => Path.Combine(Dados, JwtKeyStore.NomeArquivo);

    public JwtKeyStoreTests()
    {
        Directory.CreateDirectory(_raiz);
    }

    private JwtKeyStore Store(string? legado = null) => new(Dados, _logger, legado);

    // ---------- Resolução do diretório ----------

    [Fact]
    public void Diretorio_SegueOrdemDePrioridade_ENaoDependeDaPastaDeInstalacao()
    {
        Assert.Equal(@"C:\chaves", JwtKeyStore.ResolverDiretorio(@"C:\chaves", @"D:\dados", @"E:\appdata"));
        Assert.Equal(@"D:\dados", JwtKeyStore.ResolverDiretorio(null, @"D:\dados", @"E:\appdata"));
        Assert.Equal(Path.Combine(@"E:\appdata", "PDV-ATYLUS"), JwtKeyStore.ResolverDiretorio(null, null, @"E:\appdata"));
        Assert.Equal(Path.Combine(@"E:\appdata", "PDV-ATYLUS"), JwtKeyStore.ResolverDiretorio("  ", "", @"E:\appdata"));
    }

    // ---------- Criação, persistência e preservação ----------

    [Fact]
    public void ArquivoInexistente_GeraChaveDe64Bytes_EReutilizaNasProximasInicializacoes()
    {
        var primeira = Store().ObterOuCriarChave();
        var conteudo = File.ReadAllText(Arquivo);
        var dataEscrita = File.GetLastWriteTimeUtc(Arquivo);

        var segunda = Store().ObterOuCriarChave();

        Assert.Equal(64, primeira.Length);
        Assert.Equal(primeira, segunda);
        Assert.Equal(conteudo, File.ReadAllText(Arquivo));
        Assert.Equal(dataEscrita, File.GetLastWriteTimeUtc(Arquivo));
        Assert.Empty(Directory.GetFiles(Dados, "*.tmp"));
    }

    [Fact]
    public void ChaveExistenteValida_EPreservadaSemAlteracao()
    {
        Directory.CreateDirectory(Dados);
        var chave = RandomNumberGenerator.GetBytes(48);
        File.WriteAllText(Arquivo, Convert.ToBase64String(chave));

        Assert.Equal(chave, Store().ObterOuCriarChave());
        Assert.Equal(Convert.ToBase64String(chave), File.ReadAllText(Arquivo));
    }

    [Fact]
    public void ChaveLegadaDaPastaDeInstalacao_EMigradaComMesmoConteudo_EOriginalMantido()
    {
        var legado = Path.Combine(_raiz, "instalacao-antiga");
        Directory.CreateDirectory(legado);
        var chave = RandomNumberGenerator.GetBytes(64);
        var arquivoLegado = Path.Combine(legado, JwtKeyStore.NomeArquivo);
        File.WriteAllText(arquivoLegado, Convert.ToBase64String(chave));

        var obtida = Store(legado).ObterOuCriarChave();

        Assert.Equal(chave, obtida);
        Assert.Equal(Convert.ToBase64String(chave), File.ReadAllText(Arquivo));
        Assert.True(File.Exists(arquivoLegado));
        Assert.Contains(_logger.Mensagens, m => m.Contains("migrada"));
    }

    [Fact]
    public void ChaveLegadaCorrompida_EIgnorada_ENovaChaveGerada()
    {
        var legado = Path.Combine(_raiz, "instalacao-antiga");
        Directory.CreateDirectory(legado);
        File.WriteAllText(Path.Combine(legado, JwtKeyStore.NomeArquivo), "não é base64 ###");

        var obtida = Store(legado).ObterOuCriarChave();

        Assert.Equal(64, obtida.Length);
        Assert.Equal("não é base64 ###", File.ReadAllText(Path.Combine(legado, JwtKeyStore.NomeArquivo)));
    }

    // ---------- Arquivo corrompido / inválido ----------

    [Theory]
    [InlineData("conteúdo corrompido ###")]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAA==")] // 16 bytes: menor que o mínimo de 32
    public void ArquivoCorrompidoOuCurto_VaiParaQuarentena_ENovaChaveEGeradaComAviso(string conteudoInvalido)
    {
        Directory.CreateDirectory(Dados);
        File.WriteAllText(Arquivo, conteudoInvalido);

        var nova = Store().ObterOuCriarChave();

        Assert.Equal(64, nova.Length);
        Assert.Equal(Convert.ToBase64String(nova), File.ReadAllText(Arquivo));
        var quarentena = Assert.Single(Directory.GetFiles(Dados, JwtKeyStore.NomeArquivo + ".corrompida-*"));
        Assert.Equal(conteudoInvalido, File.ReadAllText(quarentena));
        Assert.Contains(_logger.Registros, r => r.Nivel == LogLevel.Warning && r.Mensagem.Contains("corrompida"));
    }

    // ---------- Falhas de acesso: falha segura, sem gerar chave substituta ----------

    [Fact]
    public void CaminhoDaChaveInacessivel_FalhaComMensagemClara_ESemGerarChave()
    {
        Directory.CreateDirectory(Arquivo); // o "arquivo" é um diretório: leitura negada pelo sistema

        var ex = Assert.Throws<ChaveJwtException>(() => Store().ObterOuCriarChave());

        Assert.Equal(TipoFalhaChaveJwt.AcessoNegado, ex.Tipo);
        Assert.Contains("ler o arquivo de chave", ex.Message);
        Assert.Contains("PDV_JWT_KEY_DIR", ex.Message);
        Assert.Empty(Directory.GetFiles(Dados));
    }

    [Fact]
    public void DiretorioDeDadosNaoPodeSerCriado_FalhaSemGerarChave()
    {
        File.WriteAllText(Dados, "um arquivo ocupando o caminho do diretório");

        var ex = Assert.Throws<ChaveJwtException>(() => Store().ObterOuCriarChave());

        Assert.Equal(TipoFalhaChaveJwt.AcessoNegado, ex.Tipo);
        Assert.Contains("diretório", ex.Message);
    }

    [Fact]
    public void LeituraNegadaPorPermissao_NaoGeraChaveNova_ENaoAlteraArquivo()
    {
        if (!OperatingSystem.IsWindows()) return;

        var original = Store().ObterOuCriarChave();
        var conteudo = File.ReadAllText(Arquivo);
        NegarAoUsuarioAtual(Arquivo, FileSystemRights.ReadData);

        var ex = Assert.Throws<ChaveJwtException>(() => Store().ObterOuCriarChave());

        Assert.Equal(TipoFalhaChaveJwt.AcessoNegado, ex.Tipo);
        Assert.IsType<UnauthorizedAccessException>(ex.InnerException);
        Assert.Empty(Directory.GetFiles(Dados, "*.corrompida-*"));
        RemoverNegacoes();
        Assert.Equal(conteudo, File.ReadAllText(Arquivo));
        Assert.Equal(original, Store().ObterOuCriarChave());
    }

    [Fact]
    public void GravacaoNegadaNoDiretorio_FalhaSemCriarArquivos()
    {
        if (!OperatingSystem.IsWindows()) return;

        Directory.CreateDirectory(Dados);
        NegarAoUsuarioAtual(Dados, FileSystemRights.CreateFiles);

        var ex = Assert.Throws<ChaveJwtException>(() => Store().ObterOuCriarChave());

        Assert.Equal(TipoFalhaChaveJwt.AcessoNegado, ex.Tipo);
        Assert.Contains("gravar", ex.Message);
        RemoverNegacoes();
        Assert.Empty(Directory.GetFileSystemEntries(Dados));
    }

    // ---------- Proteção da chave ----------

    [Fact]
    public void ArquivoCriado_TemAcessoRestritoAoUsuarioAtualESystem()
    {
        if (!OperatingSystem.IsWindows()) return;

        Store().ObterOuCriarChave();
        VerificarAclRestrita(Arquivo);
    }

    [SupportedOSPlatform("windows")]
    private static void VerificarAclRestrita(string caminho)
    {
        var acl = new FileInfo(caminho).GetAccessControl();
        var regras = acl.GetAccessRules(includeExplicit: true, includeInherited: true, typeof(SecurityIdentifier))
            .Cast<FileSystemAccessRule>().ToList();
        var permitidos = new[] { WindowsIdentity.GetCurrent().User!, new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null) };

        Assert.True(acl.AreAccessRulesProtected);                       // sem herança da pasta
        Assert.NotEmpty(regras);
        foreach (var regra in regras)
        {
            Assert.False(regra.IsInherited);
            Assert.Contains((SecurityIdentifier)regra.IdentityReference, permitidos);
        }
    }

    [Fact]
    public void ConteudoDaChave_NuncaApareceNosLogs()
    {
        Directory.CreateDirectory(Dados);
        File.WriteAllText(Arquivo, "corrompido");
        var chave = Store().ObterOuCriarChave();                       // gera com aviso
        Store(legado: null).ObterOuCriarChave();                         // reutiliza

        var base64 = Convert.ToBase64String(chave);
        Assert.NotEmpty(_logger.Mensagens);
        Assert.All(_logger.Mensagens, m => Assert.DoesNotContain(base64[..16], m));
    }

    [Fact]
    public void ChaveConfiguradaInvalida_FalhaNaInicializacao()
    {
        var curta = Assert.Throws<ChaveJwtException>(() => new JwtOptions(new byte[16], TimeSpan.FromHours(1)));
        Assert.Equal(TipoFalhaChaveJwt.ConfiguracaoInvalida, curta.Tipo);
    }

    // ---------- utilitários ----------

    [SupportedOSPlatform("windows")]
    private void NegarAoUsuarioAtual(string caminho, FileSystemRights direitos)
    {
        var usuario = WindowsIdentity.GetCurrent().User!;
        var regra = new FileSystemAccessRule(usuario, direitos, AccessControlType.Deny);
        if (Directory.Exists(caminho))
        {
            var info = new DirectoryInfo(caminho);
            var acl = info.GetAccessControl();
            acl.AddAccessRule(regra);
            info.SetAccessControl(acl);
            _limpezas.Add(() => { var a = info.GetAccessControl(); a.RemoveAccessRule(regra); info.SetAccessControl(a); });
        }
        else
        {
            var info = new FileInfo(caminho);
            var acl = info.GetAccessControl();
            acl.AddAccessRule(regra);
            info.SetAccessControl(acl);
            _limpezas.Add(() => { var a = info.GetAccessControl(); a.RemoveAccessRule(regra); info.SetAccessControl(a); });
        }
    }

    private void RemoverNegacoes()
    {
        foreach (var limpar in _limpezas) limpar();
        _limpezas.Clear();
    }

    public void Dispose()
    {
        try { RemoverNegacoes(); } catch { /* melhor esforço */ }
        try { Directory.Delete(_raiz, recursive: true); } catch { /* temporário */ }
    }

    private sealed class LoggerDeTeste : ILogger
    {
        public List<(LogLevel Nivel, string Mensagem)> Registros { get; } = new();
        public IEnumerable<string> Mensagens => Registros.Select(r => r.Mensagem);

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            => Registros.Add((logLevel, formatter(state, exception) + (exception?.Message ?? string.Empty)));
    }
}
