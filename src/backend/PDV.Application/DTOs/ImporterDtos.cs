namespace PDV.Application.DTOs;

public record AnalisarPlanilhaRequest(
    string NomeArquivo,
    List<string> Cabecalhos,
    List<List<string>> AmostraLinhas);

public record ConfirmarImportacaoItem(
    string CodigoBarras,
    string Nome,
    decimal PrecoVenda,
    decimal PrecoCusto,
    decimal EstoqueAtual);

public record ConfirmarImportacaoRequest(
    List<ConfirmarImportacaoItem> Produtos);

public record ConfirmarImportacaoResponse(
    int TotalRecebidos,
    int TotalImportadosComSucesso,
    int TotalAtualizados,
    List<string> Erros);
