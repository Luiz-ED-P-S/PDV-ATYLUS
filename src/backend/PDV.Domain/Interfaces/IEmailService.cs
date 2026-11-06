namespace PDV.Domain.Interfaces;

public interface IEmailService
{
    Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default);
    Task SendVerificationCodeAsync(string toEmail, string code, int expirationMinutes = 15, CancellationToken cancellationToken = default);
}
