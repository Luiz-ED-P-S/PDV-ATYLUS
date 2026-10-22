using System.Collections.Concurrent;
using PDV.Domain.Interfaces;

namespace PDV.Infrastructure.Services;

public class PixSimulatorService : IPixService
{
    private static readonly ConcurrentDictionary<string, PixStatusRecord> _pixTransactions = new();

    private record PixStatusRecord(string TxId, decimal Valor, DateTime CriadoEm, DateTime ExpiraEm, bool Pago, DateTime? DataPagamento);

    public Task<PixResult> GerarQrCodeAsync(decimal valor, string descricao, CancellationToken cancellationToken = default)
    {
        var txId = $"PIX{DateTime.UtcNow:yyyyMMddHHmmss}{Random.Shared.Next(1000, 9999)}";
        var expiraEm = DateTime.UtcNow.AddMinutes(15);

        // Payload Pix padrão EMV (BR Code) simulado
        var copiaECola = $"00020126580014br.gov.bcb.pix0136{Guid.NewGuid()}520400005303986540{valor:F2}5802BR5910PDV ATYLUS6009SAO PAULO62070503***6304{Random.Shared.Next(1000, 9999):X4}";

        // QR Code SVG embutido em Base64 para exibição direta no front-end sem bibliotecas pesadas de terceiros
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

        var base64Svg = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(svgQrCode));
        var dataUri = $"data:image/svg+xml;base64,{base64Svg}";

        _pixTransactions[txId] = new PixStatusRecord(txId, valor, DateTime.UtcNow, expiraEm, false, null);

        return Task.FromResult(new PixResult(txId, dataUri, copiaECola, valor, expiraEm));
    }

    public Task<PixStatusResult> ConsultarStatusAsync(string txId, CancellationToken cancellationToken = default)
    {
        if (_pixTransactions.TryGetValue(txId, out var record))
        {
            return Task.FromResult(new PixStatusResult(record.TxId, record.Pago, record.DataPagamento, record.Valor));
        }

        return Task.FromResult(new PixStatusResult(txId, false, null, 0));
    }

    public Task SimularPagamentoAsync(string txId, CancellationToken cancellationToken = default)
    {
        if (_pixTransactions.TryGetValue(txId, out var record))
        {
            _pixTransactions[txId] = record with { Pago = true, DataPagamento = DateTime.UtcNow };
        }

        return Task.CompletedTask;
    }
}
