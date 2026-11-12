using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using PDV.API.Administracao;
using PDV.API.BackgroundWorkers;
using PDV.API.Middlewares;
using PDV.API.Security;
using PDV.Application;
using PDV.Domain.Entities;
using PDV.Domain.Enums;
using PDV.Infrastructure;
using PDV.Infrastructure.Context;
using PDV.Infrastructure.Persistence;

// Versão desktop: o Electron lê a saída do servidor; força UTF-8 para acentos corretos nos logs e mensagens de erro.
if (Environment.GetEnvironmentVariable("PDV_DESKTOP_MODE") == "1")
{
    Console.OutputEncoding = new System.Text.UTF8Encoding(false);
}

var builder = WebApplication.CreateBuilder(args);

// Configuração das camadas Clean Architecture
builder.Services.AddApplication();

// Pix: simulação somente com Pix:PermitirSimulacao=true E ambiente Development/Testing (decidido no servidor)
builder.Services.AddSingleton(PDV.Application.Commands.Pix.OpcoesPix.Para(
    builder.Environment.EnvironmentName,
    bool.TryParse(builder.Configuration["Pix:PermitirSimulacao"], out var pixSimulacao) && pixSimulacao));
builder.Services.AddInfrastructure(builder.Configuration);

// Controllers e Swagger
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "PDV Atylus API", Version = "v1", Description = "API do Ponto de Venda Offline-First com Clean Architecture e CQRS" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Token obtido em POST /api/v1/auth/login"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        }
    });
});

// Autenticação local e offline: JWT assinado com chave simétrica guardada em diretório de dados protegido
builder.Services.AddSingleton(sp => JwtOptions.Carregar(
    sp.GetRequiredService<IConfiguration>(),
    sp.GetRequiredService<IHostEnvironment>(),
    sp.GetRequiredService<ILoggerFactory>().CreateLogger("PDV.Seguranca.ChaveJwt")));
builder.Services.AddSingleton<JwtTokenService>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<LoginAttemptLimiter>(sp => new LoginAttemptLimiter(sp.GetRequiredService<TimeProvider>()));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        // Recusa tokens de operadores desativados ou emitidos antes de troca de PIN/perfil
        options.Events = new JwtBearerEvents { OnTokenValidated = ValidadorSessaoOperador.ValidarAsync };
    })
    .AddScheme<AuthenticationSchemeOptions, SyncApiKeyAuthenticationHandler>(SyncApiKeyAuthenticationHandler.NomeEsquema, null);

builder.Services
    .AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<JwtOptions>((options, jwt) => options.TokenValidationParameters = jwt.ParametrosValidacao());

builder.Services.AddAuthorization(options =>
{
    // Qualquer endpoint sem regra explícita exige usuário autenticado (rede de segurança)
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

// Worker de Backup em segundo plano no Google Drive e Worker de Sincronização em Nuvem (Offline-First)
builder.Services.AddHostedService<GoogleDriveBackupWorker>();
builder.Services.AddHostedService<CloudSyncWorker>();

// Habilitar CORS para o frontend (Vite React na porta 5173, 5000 ou produção)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowLocalhost", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000", "https://localhost:5173", "http://localhost:5000", "https://localhost:5000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Modo de diagnóstico: "PDV.API --verificar-banco" mostra a situação do banco e as migrations pendentes,
// sem alterar nada (não cria chave, não aplica migrations, não sobe o servidor).
if (args.Contains("--verificar-banco"))
{
    using var escopoDiagnostico = app.Services.CreateScope();
    Console.OutputEncoding = System.Text.Encoding.UTF8;
    var diagnostico = escopoDiagnostico.ServiceProvider.GetRequiredService<MigradorBancoDados>().Diagnosticar();
    Console.WriteLine(diagnostico.Relatorio());
    Environment.ExitCode = diagnostico.Situacao == SituacaoBanco.Incompativel ? 1 : 0;
    return;
}

// Comando administrativo: autoriza explicitamente a atualização de um banco existente (confirmando arquivo e versão).
// Não carrega a chave JWT nem sobe o servidor.
if (args.Contains(ComandoAtualizarBanco.Argumento))
{
    using var escopoAtualizacao = app.Services.CreateScope();
    Console.OutputEncoding = System.Text.Encoding.UTF8;
    Environment.ExitCode = ComandoAtualizarBanco.Executar(
        args, escopoAtualizacao.ServiceProvider.GetRequiredService<MigradorBancoDados>(), Console.Out);
    return;
}

// Carrega a chave de autenticação ANTES de tocar no banco: sem chave confiável a API não inicia (falha segura)
try
{
    app.Services.GetRequiredService<JwtOptions>();
}
catch (ChaveJwtException ex)
{
    app.Logger.LogCritical("Falha ao carregar a chave de autenticação ({Tipo}): {Mensagem}", ex.Tipo, ex.Message);
    throw;
}

// Inicialização automática do banco SQLite e Carga Inicial (Seed)
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<PdvDbContext>();

    // Banco novo: criado pelas migrations. Banco existente: apenas diagnosticado — se precisar de atualização
    // (inclusive baseline de bancos criados pelo antigo EnsureCreated), o PDV NÃO inicia e informa o comando
    // administrativo --atualizar-banco. Nenhuma migração de banco existente acontece na inicialização normal.
    try
    {
        scope.ServiceProvider.GetRequiredService<MigradorBancoDados>().Executar();
    }
    catch (MigracaoBancoException ex) when (ex.Etapa == EtapaMigracao.Autorizacao)
    {
        app.Logger.LogCritical("ATUALIZAÇÃO DO BANCO NECESSÁRIA: {Mensagem}", ex.Message);
        throw;
    }
    catch (MigracaoBancoException ex)
    {
        app.Logger.LogCritical("Falha na preparação do banco de dados ({Etapa}): {Mensagem}", ex.Etapa, ex.Message);
        throw;
    }

    try
    {
        context.Database.ExecuteSqlRaw("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;");
    }
    catch
    {
        // Contingência para provedores em memória ou bloqueios transitórios
    }

    // Cria operadores padrão caso a tabela esteja vazia
    if (!context.Operadores.Any())
    {
        context.Operadores.AddRange(
            new Operador("Operador Caixa 01", "OP01", "0000", PerfilOperador.Operador),
            new Operador("Gerente Geral", "GER01", "1234", PerfilOperador.Supervisor)
        );
        context.SaveChanges();
    }

    // Cria produtos iniciais de exemplo se o catálogo estiver vazio
    if (!context.Produtos.Any())
    {
        context.Produtos.AddRange(
            new Produto("7894900010015", "Refrigerante Coca-Cola 2L", 9.50m, 6.00m, 50, 10),
            new Produto("7891000100103", "Leite Integral Ninho 1L", 5.80m, 3.90m, 30, 5),
            new Produto("7891910000197", "Açúcar Refinado União 1kg", 4.20m, 2.70m, 40, 10),
            new Produto("7896004000153", "Café Torrado e Moído Pilão 500g", 18.90m, 12.50m, 25, 5),
            new Produto("7891024131238", "Biscoito Recheado Passatempo 130g", 3.20m, 1.80m, 60, 15)
        );
        context.SaveChanges();
    }
}

// Pipeline HTTP
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "PDV Atylus API v1");
    });
}

app.UseCors("AllowLocalhost");

// Suporte para servir a SPA React compilada a partir de wwwroot (com detecção flexível de caminho)
string? wwwrootDir = Environment.GetEnvironmentVariable("PDV_WWWROOT");

if (string.IsNullOrWhiteSpace(wwwrootDir) || !Directory.Exists(wwwrootDir))
{
    var candidates = new List<string?>
    {
        Path.Combine(AppContext.BaseDirectory, "wwwroot"),
        Environment.ProcessPath != null ? Path.Combine(Path.GetDirectoryName(Environment.ProcessPath)!, "wwwroot") : null,
        Environment.ProcessPath != null ? Path.GetFullPath(Path.Combine(Path.GetDirectoryName(Environment.ProcessPath)!, "../../src/backend/PDV.API/wwwroot")) : null,
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../wwwroot")),
        Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"),
        Path.Combine(Directory.GetCurrentDirectory(), "src/backend/PDV.API/wwwroot")
    };

    wwwrootDir = candidates.FirstOrDefault(p => !string.IsNullOrEmpty(p) && Directory.Exists(p) && File.Exists(Path.Combine(p, "index.html")));
}

if (!string.IsNullOrEmpty(wwwrootDir) && Directory.Exists(wwwrootDir))
{
    Console.WriteLine($"[SPA] Servindo frontend de: {wwwrootDir}");
    var physicalProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwrootDir);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = physicalProvider });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = physicalProvider });
}
else
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Endpoint de Healthcheck para verificação de status da API
app.MapGet("/health", () => Results.Ok(new { status = "healthy", version = "1.0.0", timestamp = DateTime.UtcNow }))
   .AllowAnonymous();

// Fallback para SPA React (roteamento no cliente) — a tela de login precisa carregar sem token
if (!string.IsNullOrEmpty(wwwrootDir) && Directory.Exists(wwwrootDir) && File.Exists(Path.Combine(wwwrootDir, "index.html")))
{
    var physicalProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwrootDir);
    app.MapFallbackToFile("index.html", new StaticFileOptions { FileProvider = physicalProvider }).AllowAnonymous();
}
else
{
    app.MapFallbackToFile("index.html").AllowAnonymous();
}

app.Run();

// Exposto para testes de integração (WebApplicationFactory)
public partial class Program { }
