using System.Text;
using PDV.Application.Commands.Pix;
using PDV.Domain.Interfaces;

namespace PDV.Infrastructure.Services.Pix;

/// <summary>
/// Provedor de SIMULAÇÃO (somente Development/Testing autorizados). Gera um QR Code ilustrativo que NÃO é
/// uma cobrança bancária; a confirmação acontece pela rota de simulação ou por Supervisor.
/// </summary>
public sealed class PixSimuladoProvedor : IPixProvedor
{
    public string Nome => ProvedoresPix.Simulador;
    public bool CobrancaBancaria => false;

    public Task<DadosPagamentoPix> PrepararAsync(string txId, decimal valor, string descricao, CancellationToken cancellationToken = default)
    {
        var copiaECola = $"SIMULACAO-SEM-VALOR-BANCARIO|{txId}|{valor:F2}";
        var svgQrCode = $@"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='200' height='200'>
            <rect width='200' height='200' fill='white'/>
            <!-- Moldura e Marcadores Pix -->
            <rect x='20' y='20' width='50' height='50' fill='black'/>
            <rect x='26' y='26' width='38' height='38' fill='white'/>
            <rect x='32' y='32' width='26' height='26' fill='black'/>
            <rect x='130' y='20' width='50' height='50' fill='black'/>
            <rect x='136' y='26' width='38' height='38' fill='white'/>
            <rect x='142' y='32' width='26' height='26' fill='black'/>
            <rect x='20' y='130' width='50' height='50' fill='black'/>
            <rect x='26' y='136' width='38' height='38' fill='white'/>
            <rect x='32' y='142' width='26' height='26' fill='black'/>
            <!-- Padrão Simulado de Dados -->
            <rect x='85' y='30' width='15' height='15' fill='black'/>
            <rect x='105' y='45' width='15' height='25' fill='black'/>
            <rect x='85' y='85' width='30' height='30' fill='#00BDAE'/>
            <rect x='40' y='85' width='20' height='15' fill='black'/>
            <rect x='135' y='95' width='25' height='20' fill='black'/>
            <rect x='85' y='140' width='20' height='25' fill='black'/>
            <rect x='125' y='135' width='30' height='20' fill='black'/>
            <text x='100' y='190' font-size='10' font-family='sans-serif' text-anchor='middle' fill='#555'>R$ {valor:F2}</text>
        </svg>";

        var dataUri = "data:image/svg+xml;base64," + Convert.ToBase64String(Encoding.UTF8.GetBytes(svgQrCode));
        return Task.FromResult(new DadosPagamentoPix(dataUri, copiaECola,
            "SIMULAÇÃO de Pix (ambiente de desenvolvimento/testes): este QR Code não é uma cobrança bancária."));
    }
}
