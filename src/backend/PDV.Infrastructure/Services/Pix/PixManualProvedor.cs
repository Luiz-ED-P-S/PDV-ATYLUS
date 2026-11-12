using PDV.Application.Commands.Pix;
using PDV.Domain.Interfaces;

namespace PDV.Infrastructure.Services.Pix;

/// <summary>
/// Provedor padrão enquanto não há integração com um PSP: não gera QR Code (nada fictício é exibido como
/// cobrança bancária). O cliente paga pela chave Pix da loja e um Supervisor confirma o recebimento.
/// </summary>
public sealed class PixManualProvedor : IPixProvedor
{
    public string Nome => ProvedoresPix.Manual;
    public bool CobrancaBancaria => false;

    public Task<DadosPagamentoPix> PrepararAsync(string txId, decimal valor, string descricao, CancellationToken cancellationToken = default) =>
        Task.FromResult(new DadosPagamentoPix(null, null,
            $"Receba R$ {valor:F2} pela chave Pix da loja e confira o crédito no aplicativo do banco. " +
            "Em seguida, um Supervisor deve confirmar o recebimento (confirmação manual, não bancária)."));
}
