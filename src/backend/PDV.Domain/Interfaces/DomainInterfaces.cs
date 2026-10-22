using PDV.Domain.Entities;
using PDV.Domain.Enums;

namespace PDV.Domain.Interfaces;

public interface IRepository<T> where T : BaseEntity
{
    Task<T?> ObterPorIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<T>> ObterTodosAsync(CancellationToken cancellationToken = default);
    Task AdicionarAsync(T entity, CancellationToken cancellationToken = default);
    Task AtualizarAsync(T entity, CancellationToken cancellationToken = default);
    Task RemoverAsync(T entity, CancellationToken cancellationToken = default);
}

public interface IProdutoRepository : IRepository<Produto>
{
    Task<Produto?> ObterPorCodigoBarrasAsync(string codigoBarras, CancellationToken cancellationToken = default);
    Task<List<Produto>> BuscarPorNomeOuCodigoAsync(string termo, CancellationToken cancellationToken = default);
}

public interface ICaixaRepository : IRepository<Caixa>
{
    Task<Caixa?> ObterCaixaAbertoAsync(CancellationToken cancellationToken = default);
    Task<List<Caixa>> ObterHistoricoCaixasAsync(int quantidade = 10, CancellationToken cancellationToken = default);
}

public interface IVendaRepository : IRepository<Venda>
{
    Task<List<Venda>> ObterVendasPorCaixaAsync(Guid caixaId, CancellationToken cancellationToken = default);
    Task<Venda?> ObterVendaCompletaPorIdAsync(Guid id, CancellationToken cancellationToken = default);
}

public interface IPixService
{
    Task<PixResult> GerarQrCodeAsync(decimal valor, string descricao, CancellationToken cancellationToken = default);
    Task<PixStatusResult> ConsultarStatusAsync(string txId, CancellationToken cancellationToken = default);
    Task SimularPagamentoAsync(string txId, CancellationToken cancellationToken = default);
}

public record PixResult(string TxId, string QrCodeBase64, string CopiaECola, decimal Valor, DateTime ExpiraEm);
public record PixStatusResult(string TxId, bool Pago, DateTime? DataPagamento, decimal Valor);

public interface IGoogleDriveBackupService
{
    Task<string> RealizarBackupAsync(CancellationToken cancellationToken = default);
    Task SincronizarBackupsPendentesAsync(CancellationToken cancellationToken = default);
}

public interface ISpreadsheetAiService
{
    Task<MapeamentoColunasResult> AnalisarPlanilhaAsync(string nomeArquivo, List<string> cabecalhos, List<List<string>> amostraLinhas, CancellationToken cancellationToken = default);
}

public record MapeamentoColunasResult(
    string? ColunaCodigoBarras,
    string? ColunaNome,
    string? ColunaPrecoVenda,
    string? ColunaPrecoCusto,
    string? ColunaEstoque,
    double Confianca,
    string? Observacoes);
