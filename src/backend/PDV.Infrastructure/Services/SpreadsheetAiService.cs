using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PDV.Domain.Interfaces;

namespace PDV.Infrastructure.Services;

public class SpreadsheetAiService : ISpreadsheetAiService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<SpreadsheetAiService> _logger;
    private readonly HttpClient _httpClient;

    public SpreadsheetAiService(IConfiguration configuration, ILogger<SpreadsheetAiService> logger, HttpClient httpClient)
    {
        _configuration = configuration;
        _logger = logger;
        _httpClient = httpClient;
    }

    public async Task<MapeamentoColunasResult> AnalisarPlanilhaAsync(
        string nomeArquivo,
        List<string> cabecalhos,
        List<List<string>> amostraLinhas,
        CancellationToken cancellationToken = default)
    {
        var geminiKey = _configuration["AI:GeminiApiKey"];
        var openAiKey = _configuration["AI:OpenAiApiKey"];

        if (!string.IsNullOrWhiteSpace(geminiKey))
        {
            try
            {
                return await ChamarGeminiAsync(geminiKey, cabecalhos, amostraLinhas, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha na chamada da API do Gemini. Aplicando detector heurístico local.");
            }
        }
        else if (!string.IsNullOrWhiteSpace(openAiKey))
        {
            try
            {
                return await ChamarOpenAiAsync(openAiKey, cabecalhos, amostraLinhas, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha na chamada da API da OpenAI. Aplicando detector heurístico local.");
            }
        }

        // Fallback Heurístico Local (Offline-First / Zero Config)
        return MapearPorHeuristica(cabecalhos, amostraLinhas);
    }

    private async Task<MapeamentoColunasResult> ChamarGeminiAsync(
        string apiKey,
        List<string> cabecalhos,
        List<List<string>> amostras,
        CancellationToken cancellationToken)
    {
        var prompt = MontarPrompt(cabecalhos, amostras);
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={apiKey}";

        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    parts = new[]
                    {
                        new { text = prompt }
                    }
                }
            },
            generationConfig = new
            {
                response_mime_type = "application/json"
            }
        };

        var response = await _httpClient.PostAsJsonAsync(url, requestBody, cancellationToken);
        response.EnsureSuccessStatusCode();

        var jsonResponse = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(jsonResponse);
        var candidateText = doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString();

        if (string.IsNullOrWhiteSpace(candidateText))
            return MapearPorHeuristica(cabecalhos, amostras);

        return InterpretarJsonResposta(candidateText, cabecalhos);
    }

    private async Task<MapeamentoColunasResult> ChamarOpenAiAsync(
        string apiKey,
        List<string> cabecalhos,
        List<List<string>> amostras,
        CancellationToken cancellationToken)
    {
        var prompt = MontarPrompt(cabecalhos, amostras);
        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

        var requestBody = new
        {
            model = "gpt-4o-mini",
            response_format = new { type = "json_object" },
            messages = new[]
            {
                new { role = "system", content = "Você é um assistente especialista em mapeamento de colunas de planilhas para sistemas de PDV." },
                new { role = "user", content = prompt }
            }
        };

        request.Content = JsonContent.Create(requestBody);
        var response = await _httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var jsonResponse = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(jsonResponse);
        var content = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        if (string.IsNullOrWhiteSpace(content))
            return MapearPorHeuristica(cabecalhos, amostras);

        return InterpretarJsonResposta(content, cabecalhos);
    }

    private static string MontarPrompt(List<string> cabecalhos, List<List<string>> amostras)
    {
        var linhasExemplo = string.Join("\n", amostras.Take(3).Select((linha, idx) => $"Linha {idx + 1}: " + string.Join(" | ", linha)));

        return $@"Analise o cabeçalho e os dados abaixo e identifique qual coluna representa o Código de Barras, Nome, Preço de Venda e Estoque. Retorne estritamente um JSON com o mapeamento.

Cabeçalhos disponíveis:
{string.Join(", ", cabecalhos)}

Amostra dos Dados:
{linhasExemplo}

Formato esperado do JSON:
{{
  ""codigoBarras"": ""nome_exato_da_coluna"",
  ""nome"": ""nome_exato_da_coluna"",
  ""precoVenda"": ""nome_exato_da_coluna"",
  ""precoCusto"": ""nome_exato_da_coluna"",
  ""estoque"": ""nome_exato_da_coluna"",
  ""confianca"": 0.95,
  ""observacoes"": ""Mapeamento identificado com base nos dados""
}}";
    }

    private static MapeamentoColunasResult InterpretarJsonResposta(string jsonTexto, List<string> cabecalhos)
    {
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var parsed = JsonSerializer.Deserialize<JsonMapeamentoDto>(jsonTexto, options);

        if (parsed == null)
            return MapearPorHeuristica(cabecalhos, new List<List<string>>());

        return new MapeamentoColunasResult(
            parsed.CodigoBarras,
            parsed.Nome,
            parsed.PrecoVenda,
            parsed.PrecoCusto,
            parsed.Estoque,
            parsed.Confianca > 0 ? parsed.Confianca : 0.9,
            parsed.Observacoes ?? "Mapeamento gerado com sucesso por Inteligência Artificial.");
    }

    private static MapeamentoColunasResult MapearPorHeuristica(List<string> cabecalhos, List<List<string>> _)
    {
        string? EncontrarColuna(params string[] sinonimos)
        {
            return cabecalhos.FirstOrDefault(c =>
                sinonimos.Any(s => c.Trim().ToLower().Contains(s.ToLower())));
        }

        var colCodigo = EncontrarColuna("cod", "barras", "barcode", "ean", "gtin", "sku");
        var colNome = EncontrarColuna("nome", "descricao", "desc", "produto", "item", "titulo");
        var colPrecoVenda = EncontrarColuna("preco", "venda", "valor", "unitario", "pv");
        var colPrecoCusto = EncontrarColuna("custo", "compra", "pc");
        var colEstoque = EncontrarColuna("estoque", "qtd", "quantidade", "saldo", "unidades");

        return new MapeamentoColunasResult(
            colCodigo,
            colNome,
            colPrecoVenda,
            colPrecoCusto,
            colEstoque,
            0.85,
            "Mapeamento identificado por análise heurística offline local.");
    }

    private class JsonMapeamentoDto
    {
        [JsonPropertyName("codigoBarras")]
        public string? CodigoBarras { get; set; }

        [JsonPropertyName("nome")]
        public string? Nome { get; set; }

        [JsonPropertyName("precoVenda")]
        public string? PrecoVenda { get; set; }

        [JsonPropertyName("precoCusto")]
        public string? PrecoCusto { get; set; }

        [JsonPropertyName("estoque")]
        public string? Estoque { get; set; }

        [JsonPropertyName("confianca")]
        public double Confianca { get; set; }

        [JsonPropertyName("observacoes")]
        public string? Observacoes { get; set; }
    }
}
