using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Win32;
using PDV.Domain.Entities;
using PDV.Domain.Enums;
using PDV.Domain.Interfaces;

namespace PDV.Infrastructure.Services;

public class ThermalPrinterService : IThermalPrinterService
{
    private readonly ILogger<ThermalPrinterService> _logger;
    private readonly IConfiguration _configuration;
    private readonly ConfiguracaoImpressora _configPadrao;

    public ThermalPrinterService(ILogger<ThermalPrinterService> logger, IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;

        var tipo = _configuration.GetValue("Printer:TipoConexao", TipoConexaoImpressora.SpoolerWindows);
        var nome = _configuration.GetValue("Printer:NomeOuEndereco", "Default") ?? "Default";
        var largura = _configuration.GetValue("Printer:Largura", LarguraBobina.Mm80);
        var corte = _configuration.GetValue("Printer:CortarPapel", true);
        var gaveta = _configuration.GetValue("Printer:AcionarGaveta", true);

        _configPadrao = new ConfiguracaoImpressora(tipo, nome, largura, corte, gaveta);
    }

    public List<string> ObterImpressorasInstaladas()
    {
        var lista = new List<string>();

        try
        {
            if (OperatingSystem.IsWindows())
            {
                using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows NT\CurrentVersion\Devices");
                if (key != null)
                {
                    lista.AddRange(key.GetValueNames());
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao listar impressoras via Registro do Windows");
        }

        if (lista.Count == 0)
        {
            lista.Add("Microsoft Print to PDF");
            lista.Add("Simulador ESC/POS (Virtual)");
        }

        return lista;
    }

    public async Task<ResultadoImpressao> ImprimirCupomVendaAsync(
        Venda venda,
        ConfiguracaoImpressora? config = null,
        bool abrirGaveta = false,
        CancellationToken cancellationToken = default)
    {
        config ??= _configPadrao;
        var builder = new EscPosBuilder(config.Largura);

        // Cabeçalho da Empresa
        builder.AlinharCentro()
               .TamanhoDuplo(true)
               .Negrito(true)
               .Linha("ATYLUS PDV")
               .TamanhoDuplo(false)
               .Negrito(false)
               .Linha("SISTEMA DE FRENTE DE CAIXA")
               .Linha("CNPJ: 00.000.000/0001-00 - IE: ISENTO")
               .Linha("RUA PRINCIPAL, 100 - CENTRO")
               .Divisor('=');

        // Identificação do Documento
        builder.AlinharCentro()
               .Negrito(true)
               .Linha("COMPROVANTE DE VENDA - NÃO FISCAL")
               .Negrito(false)
               .AlinharEsquerda()
               .Linha($"Venda: #{venda.Id.ToString()[..8].ToUpper()}")
               .Linha($"Data/Hora: {venda.DataVenda:dd/MM/yyyy HH:mm:ss}")
               .Linha($"Operador : {venda.OperadorId}");

        if (!string.IsNullOrWhiteSpace(venda.ClienteNome))
        {
            builder.Linha($"Cliente  : {venda.ClienteNome}");
        }
        if (!string.IsNullOrWhiteSpace(venda.ClienteDocumento))
        {
            builder.Linha($"CPF/CNPJ : {venda.ClienteDocumento}");
        }

        builder.Divisor('-');

        // Cabeçalho de Itens
        builder.Negrito(true)
               .LinhaDuasColunas("ITEM CÓD DESCRIÇÃO", "VALOR (R$)")
               .Negrito(false)
               .Divisor('-');

        // Lista de Itens
        int idx = 1;
        foreach (var item in venda.Itens)
        {
            builder.LinhaItemVenda(
                idx++,
                item.ProdutoNome,
                item.Quantidade,
                "UN",
                item.PrecoUnitario,
                item.Subtotal
            );
        }

        builder.Divisor('-');

        // Totais
        builder.LinhaDuasColunas("Qtd. Total de Itens:", venda.Itens.Sum(i => i.Quantidade).ToString("N2"))
               .LinhaDuasColunas("Subtotal Bruto:", $"R$ {venda.ValorTotal:N2}");

        if (venda.Desconto > 0)
        {
            builder.LinhaDuasColunas("Desconto Concedido:", $"- R$ {venda.Desconto:N2}");
        }

        builder.Negrito(true)
               .TamanhoDuplo(true)
               .LinhaDuasColunas("TOTAL:", $"R$ {venda.ValorLiquido:N2}")
               .TamanhoDuplo(false)
               .Negrito(false)
               .Divisor('-');

        // Pagamentos
        builder.Negrito(true)
               .Linha("FORMAS DE PAGAMENTO:")
               .Negrito(false);

        foreach (var pag in venda.Pagamentos)
        {
            builder.LinhaDuasColunas($"  {pag.FormaPagamento}:", $"R$ {pag.Valor:N2}");
            if (pag.Troco > 0)
            {
                builder.LinhaDuasColunas("  Troco em Dinheiro:", $"R$ {pag.Troco:N2}");
            }
        }

        builder.Divisor('=');

        // Rodapé
        builder.AlinharCentro()
               .Linha("Obrigado pela preferência!")
               .Linha("Volte Sempre!")
               .Linha("www.atylus.com.br")
               .AvancarLinhas(2);

        // Abertura de gaveta
        if (abrirGaveta || (config.AcionarGaveta && venda.Pagamentos.Any(p => p.FormaPagamento == FormaPagamento.Dinheiro)))
        {
            builder.AcionarGaveta();
        }

        // Corte do papel
        if (config.CortarPapel)
        {
            builder.CortarPapel();
        }

        var bytes = builder.Build();
        return await DespacharBytesAsync(bytes, config, cancellationToken);
    }

    public async Task<ResultadoImpressao> ImprimirFechamentoCaixaAsync(
        Caixa caixa,
        List<Venda> vendas,
        ConfiguracaoImpressora? config = null,
        CancellationToken cancellationToken = default)
    {
        config ??= _configPadrao;
        var builder = new EscPosBuilder(config.Largura);

        builder.AlinharCentro()
               .TamanhoDuplo(true)
               .Negrito(true)
               .Linha("FECHAMENTO DE CAIXA")
               .TamanhoDuplo(false)
               .Negrito(false)
               .Linha("RELATÓRIO GERENCIAL")
               .Divisor('=')
               .AlinharEsquerda()
               .Linha($"Caixa ID   : {caixa.Id.ToString()[..8].ToUpper()}")
               .Linha($"Operador   : {caixa.OperadorId}")
               .Linha($"Abertura   : {caixa.DataAbertura:dd/MM/yyyy HH:mm:ss}")
               .Linha($"Fechamento : {(caixa.DataFechamento.HasValue ? caixa.DataFechamento.Value.ToString("dd/MM/yyyy HH:mm:ss") : "Aberto")}")
               .Divisor('-');

        // Totais Financeiros
        var totalVendas = vendas.Where(v => v.Status == StatusVenda.Concluida).Sum(v => v.ValorLiquido);
        var dinheiro = vendas.SelectMany(v => v.Pagamentos).Where(p => p.FormaPagamento == FormaPagamento.Dinheiro).Sum(p => p.Valor - p.Troco);
        var pix = vendas.SelectMany(v => v.Pagamentos).Where(p => p.FormaPagamento == FormaPagamento.Pix).Sum(p => p.Valor);
        var cartaoCred = vendas.SelectMany(v => v.Pagamentos).Where(p => p.FormaPagamento == FormaPagamento.CartaoCredito).Sum(p => p.Valor);
        var cartaoDeb = vendas.SelectMany(v => v.Pagamentos).Where(p => p.FormaPagamento == FormaPagamento.CartaoDebito).Sum(p => p.Valor);

        var suprimentos = caixa.Movimentacoes.Where(m => m.Tipo == TipoMovimentacaoCaixa.Suprimento).Sum(m => m.Valor);
        var sangrias = caixa.Movimentacoes.Where(m => m.Tipo == TipoMovimentacaoCaixa.Sangria).Sum(m => m.Valor);
        var saldoEsperado = caixa.SaldoInicial + dinheiro + suprimentos - sangrias;

        builder.Negrito(true).Linha("RESUMO DE VENDAS:").Negrito(false)
               .LinhaDuasColunas("Qtd. Vendas Concluídas:", vendas.Count(v => v.Status == StatusVenda.Concluida).ToString())
               .LinhaDuasColunas("Total Faturado:", $"R$ {totalVendas:N2}")
               .Divisor('-')
               .Negrito(true).Linha("TOTAIS POR FORMA DE PAGAMENTO:").Negrito(false)
               .LinhaDuasColunas("  Dinheiro:", $"R$ {dinheiro:N2}")
               .LinhaDuasColunas("  Pix:", $"R$ {pix:N2}")
               .LinhaDuasColunas("  Cartão de Crédito:", $"R$ {cartaoCred:N2}")
               .LinhaDuasColunas("  Cartão de Débito:", $"R$ {cartaoDeb:N2}")
               .Divisor('-')
               .Negrito(true).Linha("CONCILIAÇÃO DO CAIXA FÍSICO:").Negrito(false)
               .LinhaDuasColunas("  (+) Saldo Inicial:", $"R$ {caixa.SaldoInicial:N2}")
               .LinhaDuasColunas("  (+) Vendas Dinheiro:", $"R$ {dinheiro:N2}")
               .LinhaDuasColunas("  (+) Suprimentos:", $"R$ {suprimentos:N2}")
               .LinhaDuasColunas("  (-) Sangrias:", $"R$ {sangrias:N2}")
               .Negrito(true)
               .LinhaDuasColunas("  (=) Total Esperado Dinheiro:", $"R$ {saldoEsperado:N2}");

        if (caixa.SaldoFinalInformado.HasValue)
        {
            var diferenca = caixa.SaldoFinalInformado.Value - saldoEsperado;
            builder.LinhaDuasColunas("  (=) Informado pelo Operador:", $"R$ {caixa.SaldoFinalInformado.Value:N2}")
                   .LinhaDuasColunas("  Diferença de Caixa:", $"R$ {diferenca:N2}");
        }

        builder.Negrito(false).Divisor('=')
               .AvancarLinhas(2);

        if (config.CortarPapel)
        {
            builder.CortarPapel();
        }

        var bytes = builder.Build();
        return await DespacharBytesAsync(bytes, config, cancellationToken);
    }

    public async Task<ResultadoImpressao> ImprimirComprovanteMovimentacaoAsync(
        Caixa caixa,
        MovimentacaoCaixa mov,
        ConfiguracaoImpressora? config = null,
        CancellationToken cancellationToken = default)
    {
        config ??= _configPadrao;
        var builder = new EscPosBuilder(config.Largura);

        builder.AlinharCentro()
               .TamanhoDuplo(true)
               .Negrito(true)
               .Linha(mov.Tipo == TipoMovimentacaoCaixa.Sangria ? "SANGRIA DE CAIXA" : "SUPRIMENTO DE CAIXA")
               .TamanhoDuplo(false)
               .Negrito(false)
               .Divisor('=')
               .AlinharEsquerda()
               .Linha($"Data/Hora: {mov.DataHora:dd/MM/yyyy HH:mm:ss}")
               .Linha($"Caixa ID : {caixa.Id.ToString()[..8].ToUpper()}")
               .Linha($"Operador : {mov.OperadorId}")
               .Linha($"Motivo   : {mov.Motivo}")
               .Divisor('-')
               .Negrito(true)
               .TamanhoDuplo(true)
               .LinhaDuasColunas("VALOR:", $"R$ {mov.Valor:N2}")
               .TamanhoDuplo(false)
               .Negrito(false)
               .Divisor('-')
               .AvancarLinhas(3)
               .AlinharCentro()
               .Linha("___________________________________")
               .Linha("Assinatura do Responsável")
               .AvancarLinhas(2);

        if (config.CortarPapel)
        {
            builder.CortarPapel();
        }

        var bytes = builder.Build();
        return await DespacharBytesAsync(bytes, config, cancellationToken);
    }

    public async Task<ResultadoImpressao> AcionarGavetaAsync(ConfiguracaoImpressora? config = null, CancellationToken cancellationToken = default)
    {
        config ??= _configPadrao;
        var builder = new EscPosBuilder(config.Largura);
        builder.AcionarGaveta();

        var bytes = builder.Build();
        return await DespacharBytesAsync(bytes, config, cancellationToken);
    }

    public async Task<ResultadoImpressao> TestarImpressaoAsync(ConfiguracaoImpressora config, CancellationToken cancellationToken = default)
    {
        var builder = new EscPosBuilder(config.Largura);
        builder.AlinharCentro()
               .TamanhoDuplo(true)
               .Negrito(true)
               .Linha("TESTE DE IMPRESSÃO ESC/POS")
               .TamanhoDuplo(false)
               .Negrito(false)
               .Linha("ATYLUS PDV MODERNO")
               .Divisor('=')
               .AlinharEsquerda()
               .Linha($"Data/Hora: {DateTime.Now:dd/MM/yyyy HH:mm:ss}")
               .Linha($"Conexão  : {config.TipoConexao}")
               .Linha($"Destino  : {config.NomeOuEndereco}")
               .Linha($"Largura  : {(int)config.Largura}mm")
               .Divisor('-')
               .Linha("Teste de caracteres acentuados: ÁÉÍÓÚ çãõ")
               .Linha("Teste de alinhamento:")
               .AlinharEsquerda().Linha("<<< Alinhado à Esquerda")
               .AlinharCentro().Linha("--- Centralizado ---")
               .AlinharDireita().Linha("Alinhado à Direita >>>")
               .Divisor('=');

        if (config.AcionarGaveta)
        {
            builder.AcionarGaveta();
        }

        if (config.CortarPapel)
        {
            builder.CortarPapel();
        }

        var bytes = builder.Build();
        return await DespacharBytesAsync(bytes, config, cancellationToken);
    }

    private async Task<ResultadoImpressao> DespacharBytesAsync(byte[] bytes, ConfiguracaoImpressora config, CancellationToken cancellationToken)
    {
        try
        {
            // Salva backup local do cupom em pasta temp/logs para auditoria e teste offline
            var pastaAudit = Path.Combine(AppContext.BaseDirectory, "logs", "receipts");
            Directory.CreateDirectory(pastaAudit);
            var arquivoAudit = Path.Combine(pastaAudit, $"cupom_{DateTime.Now:yyyyMMdd_HHmmss_fff}.bin");
            await File.WriteAllBytesAsync(arquivoAudit, bytes, cancellationToken);

            if (config.TipoConexao == TipoConexaoImpressora.SpoolerWindows)
            {
                var nomeImpressora = config.NomeOuEndereco;
                if (string.IsNullOrWhiteSpace(nomeImpressora) || nomeImpressora.Equals("Default", StringComparison.OrdinalIgnoreCase))
                {
                    // Se não especificada, pega a primeira disponível ou padrão
                    var instaladas = ObterImpressorasInstaladas();
                    nomeImpressora = instaladas.FirstOrDefault(i => !i.Contains("PDF", StringComparison.OrdinalIgnoreCase)) 
                                     ?? instaladas.FirstOrDefault() 
                                     ?? "Simulador";
                }

                if (nomeImpressora.Contains("Simulador", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogInformation("Impressão simulada em arquivo: {ArquivoAudit} ({Tamanho} bytes)", arquivoAudit, bytes.Length);
                    return new ResultadoImpressao(true, $"Cupom gerado com sucesso no simulador local ({bytes.Length} bytes).", bytes.Length);
                }

                bool ok = RawPrinterHelper.EnviarBytesParaImpressoraWindows(nomeImpressora, bytes, out var erro);
                if (ok)
                {
                    _logger.LogInformation("Impressão enviada com sucesso para impressora Windows: {Nome} ({Bytes} bytes)", nomeImpressora, bytes.Length);
                    return new ResultadoImpressao(true, $"Cupom impresso com sucesso em '{nomeImpressora}'.", bytes.Length);
                }
                else
                {
                    _logger.LogWarning("Falha ao imprimir no Spooler Windows: {Erro}. Salvo em {ArquivoAudit}", erro, arquivoAudit);
                    return new ResultadoImpressao(false, erro, bytes.Length);
                }
            }
            else if (config.TipoConexao == TipoConexaoImpressora.RedeTcp)
            {
                var partes = config.NomeOuEndereco.Split(':');
                var ip = partes[0];
                int porta = partes.Length > 1 && int.TryParse(partes[1], out var p) ? p : 9100;

                var (sucesso, erro) = await RawPrinterHelper.EnviarBytesParaImpressoraRedeAsync(ip, porta, bytes, cancellationToken);
                return new ResultadoImpressao(sucesso, sucesso ? $"Cupom enviado via TCP para {ip}:{porta}." : erro, bytes.Length);
            }
            else
            {
                // Modo simulador
                return new ResultadoImpressao(true, $"Cupom processado no modo simulador ({bytes.Length} bytes).", bytes.Length);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao despachar cupom para impressora térmica");
            return new ResultadoImpressao(false, $"Erro na impressão: {ex.Message}");
        }
    }
}
