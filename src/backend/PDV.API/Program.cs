using Microsoft.EntityFrameworkCore;
using PDV.API.BackgroundWorkers;
using PDV.API.Middlewares;
using PDV.Application;
using PDV.Domain.Entities;
using PDV.Domain.Enums;
using PDV.Infrastructure;
using PDV.Infrastructure.Context;

var builder = WebApplication.CreateBuilder(args);

// Configuração das camadas Clean Architecture
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// Controllers e Swagger
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "PDV Atylus API", Version = "v1", Description = "API do Ponto de Venda Offline-First com Clean Architecture e CQRS" });
});

// Worker de Backup em segundo plano no Google Drive
builder.Services.AddHostedService<GoogleDriveBackupWorker>();

// Habilitar CORS para o frontend (Vite React na porta 5173 ou produção)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowLocalhost", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000", "https://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Inicialização automática do banco SQLite e Carga Inicial (Seed)
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<PdvDbContext>();
    context.Database.EnsureCreated();

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
var wwwrootDir = Path.Combine(AppContext.BaseDirectory, "wwwroot");
if (!Directory.Exists(wwwrootDir))
{
    var altPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../wwwroot"));
    if (Directory.Exists(altPath)) wwwrootDir = altPath;
    else
    {
        var localPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        if (Directory.Exists(localPath)) wwwrootDir = localPath;
    }
}

if (Directory.Exists(wwwrootDir))
{
    var physicalProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwrootDir);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = physicalProvider });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = physicalProvider });
}
else
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseAuthorization();
app.MapControllers();

// Fallback para SPA React (roteamento no cliente)
if (Directory.Exists(wwwrootDir) && File.Exists(Path.Combine(wwwrootDir, "index.html")))
{
    var physicalProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwrootDir);
    app.MapFallbackToFile("index.html", new StaticFileOptions { FileProvider = physicalProvider });
}
else
{
    app.MapFallbackToFile("index.html");
}

app.Run();
