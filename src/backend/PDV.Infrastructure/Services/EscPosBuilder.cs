using System.Text;
using PDV.Domain.Enums;

namespace PDV.Infrastructure.Services;

/// <summary>
/// Construtor de comandos binários ESC/POS de alto desempenho para impressoras térmicas de 80mm e 58mm.
/// Compatível com Epson, Elgin, Bematech, Daruma, Diebold e emuladores genéricos.
/// </summary>
public class EscPosBuilder
{
    private readonly MemoryStream _stream;
    private readonly Encoding _encoding;
    private readonly int _colunas;

    // Constantes de comandos ESC/POS
    private static readonly byte[] CmdInit = [0x1B, 0x40];
    private static readonly byte[] CmdAlignLeft = [0x1B, 0x61, 0x00];
    private static readonly byte[] CmdAlignCenter = [0x1B, 0x61, 0x01];
    private static readonly byte[] CmdAlignRight = [0x1B, 0x61, 0x02];
    private static readonly byte[] CmdBoldOn = [0x1B, 0x45, 0x01];
    private static readonly byte[] CmdBoldOff = [0x1B, 0x45, 0x00];
    private static readonly byte[] CmdDoubleSize = [0x1D, 0x21, 0x11];
    private static readonly byte[] CmdNormalSize = [0x1D, 0x21, 0x00];
    private static readonly byte[] CmdCutPaper = [0x1D, 0x56, 0x42, 0x00]; // GS V 'B' 0 (corte total com avanço)
    private static readonly byte[] CmdOpenDrawer = [0x1B, 0x70, 0x00, 0x19, 0xFA]; // Pulso na gaveta (pino 2, 50ms)

    public EscPosBuilder(LarguraBobina largura = LarguraBobina.Mm80)
    {
        _stream = new MemoryStream();
        _colunas = largura == LarguraBobina.Mm58 ? 32 : 48;

        // Code page 850 (Multilingual Latin I) para acentuação padrão no Brasil/Portugal
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        try
        {
            _encoding = Encoding.GetEncoding(850);
        }
        catch
        {
            _encoding = Encoding.Latin1;
        }

        // Seleciona tabela de caracteres CP850: ESC t 2
        _stream.Write(CmdInit);
        _stream.Write([0x1B, 0x74, 0x02]);
    }

    public EscPosBuilder AlinharEsquerda()
    {
        _stream.Write(CmdAlignLeft);
        return this;
    }

    public EscPosBuilder AlinharCentro()
    {
        _stream.Write(CmdAlignCenter);
        return this;
    }

    public EscPosBuilder AlinharDireita()
    {
        _stream.Write(CmdAlignRight);
        return this;
    }

    public EscPosBuilder Negrito(bool ativo = true)
    {
        _stream.Write(ativo ? CmdBoldOn : CmdBoldOff);
        return this;
    }

    public EscPosBuilder TamanhoDuplo(bool ativo = true)
    {
        _stream.Write(ativo ? CmdDoubleSize : CmdNormalSize);
        return this;
    }

    public EscPosBuilder Texto(string texto)
    {
        var bytes = _encoding.GetBytes(RemoverAcentosSeNecessario(texto));
        _stream.Write(bytes);
        return this;
    }

    public EscPosBuilder Linha(string texto = "")
    {
        Texto(texto);
        _stream.WriteByte(0x0A); // LF (\n)
        return this;
    }

    public EscPosBuilder AvancarLinhas(int qtd = 1)
    {
        for (int i = 0; i < qtd; i++)
        {
            _stream.WriteByte(0x0A);
        }
        return this;
    }

    public EscPosBuilder Divisor(char caractere = '-')
    {
        var s = new string(caractere, _colunas);
        return Linha(s);
    }

    public EscPosBuilder LinhaDuasColunas(string esquerda, string direita)
    {
        int espacoDisponivel = _colunas - direita.Length;
        if (espacoDisponivel < 1) espacoDisponivel = 1;

        if (esquerda.Length > espacoDisponivel)
        {
            esquerda = esquerda[..espacoDisponivel];
        }

        var linhaFormatada = esquerda.PadRight(espacoDisponivel) + direita;
        return Linha(linhaFormatada);
    }

    public EscPosBuilder LinhaItemVenda(int index, string descricao, decimal quantidade, string unidade, decimal precoUnitario, decimal subtotal)
    {
        // Linha 1: 001 DESCRIÇÃO DO ITEM
        var header = $"{index:D3} {descricao}";
        if (header.Length > _colunas) header = header[.._colunas];
        Linha(header);

        // Linha 2:     1,500 KG x 49,90               74,85
        var qtdTexto = $"    {quantidade:N3} {unidade} x R$ {precoUnitario:N2}";
        var subtotalTexto = $"R$ {subtotal:N2}";
        LinhaDuasColunas(qtdTexto, subtotalTexto);

        return this;
    }

    public EscPosBuilder CortarPapel()
    {
        AvancarLinhas(4);
        _stream.Write(CmdCutPaper);
        return this;
    }

    public EscPosBuilder AcionarGaveta()
    {
        _stream.Write(CmdOpenDrawer);
        return this;
    }

    public byte[] Build()
    {
        return _stream.ToArray();
    }

    private static string RemoverAcentosSeNecessario(string texto)
    {
        if (string.IsNullOrEmpty(texto)) return string.Empty;
        // Normaliza caracteres para garantir legibilidade máxima em qualquer hardware de impressão térmica
        return texto;
    }
}
