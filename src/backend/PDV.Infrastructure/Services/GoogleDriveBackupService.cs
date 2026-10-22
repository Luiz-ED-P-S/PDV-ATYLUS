using System.IO.Compression;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Drive.v3;
using Google.Apis.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PDV.Domain.Interfaces;

namespace PDV.Infrastructure.Services;

public class GoogleDriveBackupService : IGoogleDriveBackupService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<GoogleDriveBackupService> _logger;
    private readonly string _backupFolder;
    private readonly string _dbPath;

    public GoogleDriveBackupService(IConfiguration configuration, ILogger<GoogleDriveBackupService> logger)
    {
        _configuration = configuration;
        _logger = logger;
        _backupFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "backups");
        _dbPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "pdv.db");

        if (!Directory.Exists(_backupFolder))
        {
            Directory.CreateDirectory(_backupFolder);
        }
    }

    public async Task<string> RealizarBackupAsync(CancellationToken cancellationToken = default)
    {
        var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
        var zipFileName = $"pdv_backup_{timestamp}.zip";
        var zipFilePath = Path.Combine(_backupFolder, zipFileName);

        _logger.LogInformation("Iniciando compactação de backup local do banco SQLite em: {Path}", zipFilePath);

        // Copia e compacta o SQLite de forma segura (mesmo em uso)
        if (File.Exists(_dbPath))
        {
            var tempDbCopy = Path.Combine(_backupFolder, $"temp_pdv_{timestamp}.db");
            try
            {
                File.Copy(_dbPath, tempDbCopy, true);

                using (var zip = ZipFile.Open(zipFilePath, ZipArchiveMode.Create))
                {
                    zip.CreateEntryFromFile(tempDbCopy, "pdv.db", CompressionLevel.Optimal);
                }
            }
            finally
            {
                if (File.Exists(tempDbCopy))
                    File.Delete(tempDbCopy);
            }
        }
        else
        {
            _logger.LogWarning("Arquivo do banco SQLite não encontrado em {DbPath}. Criando zip vazio de contingência.", _dbPath);
            using (var zip = ZipFile.Open(zipFilePath, ZipArchiveMode.Create)) { }
        }

        // Tenta enviar para o Google Drive se as credenciais existirem
        var credentialsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "credentials.json");
        if (File.Exists(credentialsPath))
        {
            try
            {
                await EnviarArquivoParaGoogleDriveAsync(zipFilePath, credentialsPath, cancellationToken);
                _logger.LogInformation("Backup enviado com sucesso para o Google Drive: {File}", zipFileName);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Não foi possível enviar o backup para o Google Drive (modo offline ativo). O arquivo permanecerá na fila local.");
            }
        }
        else
        {
            _logger.LogInformation("Arquivo 'credentials.json' do Google Drive não configurado. Backup salvo na pasta local: {Folder}", _backupFolder);
        }

        return zipFilePath;
    }

    public async Task SincronizarBackupsPendentesAsync(CancellationToken cancellationToken = default)
    {
        var credentialsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "credentials.json");
        if (!File.Exists(credentialsPath))
            return;

        var zipFiles = Directory.GetFiles(_backupFolder, "*.zip");
        foreach (var file in zipFiles)
        {
            try
            {
                await EnviarArquivoParaGoogleDriveAsync(file, credentialsPath, cancellationToken);
                _logger.LogInformation("Backup pendente sincronizado com Google Drive: {File}", Path.GetFileName(file));
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Tentativa de sincronização de backup pendente falhou (aguardando conexão).");
                break;
            }
        }
    }

    private async Task EnviarArquivoParaGoogleDriveAsync(string filePath, string credentialsPath, CancellationToken cancellationToken)
    {
        GoogleCredential credential;
        using (var stream = new FileStream(credentialsPath, FileMode.Open, FileAccess.Read))
        {
            credential = GoogleCredential.FromStream(stream).CreateScoped(DriveService.ScopeConstants.DriveFile);
        }

        using var driveService = new DriveService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = "PDV-Atylus"
        });

        var fileMetadata = new Google.Apis.Drive.v3.Data.File
        {
            Name = Path.GetFileName(filePath),
            MimeType = "application/zip"
        };

        var folderId = _configuration["GoogleDrive:FolderId"];
        if (!string.IsNullOrWhiteSpace(folderId))
        {
            fileMetadata.Parents = new List<string> { folderId };
        }

        await using var uploadStream = new FileStream(filePath, FileMode.Open, FileAccess.Read);
        var request = driveService.Files.Create(fileMetadata, uploadStream, "application/zip");
        request.Fields = "id, name, createdTime";

        await request.UploadAsync(cancellationToken);
    }
}
