using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using PDV.Domain.Interfaces;

namespace PDV.Infrastructure.Services;

public class MailKitEmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<MailKitEmailService> _logger;

    public MailKitEmailService(IConfiguration configuration, ILogger<MailKitEmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendVerificationCodeAsync(string toEmail, string code, int expirationMinutes = 15, CancellationToken cancellationToken = default)
    {
        var subject = "Seu Código de Confirmação de Cadastro";
        var htmlBody = $@"
        <div style=""font-family: Arial, sans-serif; background-color: #f4f6f9; padding: 30px;"">
            <div style=""max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);"">
                <h2 style=""color: #1e293b; margin-top: 0;"">Confirmação de Conta</h2>
                <p style=""color: #475569; font-size: 15px;"">Use o código de verificação abaixo para ativar sua conta. Ele é válido por <strong>{expirationMinutes} minutos</strong>:</p>
                <div style=""text-align: center; margin: 28px 0;"">
                    <span style=""display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0284c7; background: #f0f9ff; border: 1px solid #bae6fd; padding: 12px 24px; border-radius: 8px;"">
                        {code}
                    </span>
                </div>
                <p style=""color: #94a3b8; font-size: 13px;"">Se você não solicitou este cadastro, desconsidere esta mensagem com segurança.</p>
            </div>
        </div>";

        var host = _configuration["Smtp:Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            _logger.LogWarning("[MailKit] SMTP não configurado no appsettings. Código simulado OTP para testes: [{Code}] enviado para: {Email}", code, toEmail);
            return;
        }

        await SendEmailAsync(toEmail, subject, htmlBody, cancellationToken);
    }

    public async Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        var host = _configuration["Smtp:Host"];
        var portStr = _configuration["Smtp:Port"];
        var userName = _configuration["Smtp:UserName"];
        var password = _configuration["Smtp:Password"];
        var fromEmail = _configuration["Smtp:FromEmail"] ?? "noreply@sistema.com";
        var fromName = _configuration["Smtp:FromName"] ?? "Sistema de Autenticação";

        // Se SMTP não estiver configurado (ambiente de teste/dev local), apenas loga com segurança
        if (string.IsNullOrWhiteSpace(host))
        {
            _logger.LogWarning("[MailKit] SMTP não configurado no appsettings. Código simulado enviado para: {Email} | Assunto: {Subject}", toEmail, subject);
            return;
        }

        int port = int.TryParse(portStr, out var p) ? p : 587;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromEmail));
        message.To.Add(new MailboxAddress(toEmail, toEmail));
        message.Subject = subject;

        var bodyBuilder = new BodyBuilder
        {
            HtmlBody = htmlBody
        };
        message.Body = bodyBuilder.ToMessageBody();

        using var client = new SmtpClient();
        try
        {
            // Conecta ao servidor SMTP usando STARTTLS ou SSL dependendo da porta
            var secureOption = port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;
            await client.ConnectAsync(host, port, secureOption, cancellationToken);

            if (!string.IsNullOrWhiteSpace(userName) && !string.IsNullOrWhiteSpace(password))
            {
                await client.AuthenticateAsync(userName, password, cancellationToken);
            }

            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);

            _logger.LogInformation("[MailKit] E-mail enviado com sucesso para: {Email}", toEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[MailKit] Erro ao enviar e-mail via SMTP para: {Email}", toEmail);
            throw;
        }
    }
}
