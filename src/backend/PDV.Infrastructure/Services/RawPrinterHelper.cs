using System.Net.Sockets;
using System.Runtime.InteropServices;

namespace PDV.Infrastructure.Services;

/// <summary>
/// Helper de comunicação direta de baixo nível com impressoras térmicas via Spooler do Windows (P/Invoke winspool.drv)
/// e via Socket TCP/IP (porta RAW 9100).
/// </summary>
public static class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDocName = "Cupom PDV Atylus";
        [MarshalAs(UnmanagedType.LPStr)]
        public string? pOutputFile = null;
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDataType = "RAW";
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    /// <summary>
    /// Envia bytes brutos (RAW ESC/POS) para a impressora instalada no Windows via Win32 Spooler API.
    /// </summary>
    public static bool EnviarBytesParaImpressoraWindows(string nomeImpressora, byte[] bytes, out string erro)
    {
        erro = string.Empty;
        var pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);

        bool sucesso = false;
        if (OpenPrinter(nomeImpressora.Normalize(), out var hPrinter, IntPtr.Zero))
        {
            var di = new DOCINFOA();
            if (StartDocPrinter(hPrinter, 1, di))
            {
                if (StartPagePrinter(hPrinter))
                {
                    sucesso = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out var bytesEscritos);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }

        Marshal.FreeCoTaskMem(pUnmanagedBytes);

        if (!sucesso)
        {
            int errorCode = Marshal.GetLastWin32Error();
            erro = $"Erro Win32 ao enviar dados para a impressora '{nomeImpressora}': Código {errorCode}";
        }

        return sucesso;
    }

    /// <summary>
    /// Envia bytes brutos para impressora térmica conectada à rede local (IP:Porta, ex: 192.168.1.200:9100).
    /// </summary>
    public static async Task<(bool Sucesso, string Erro)> EnviarBytesParaImpressoraRedeAsync(string enderecoIpOuHost, int porta, byte[] bytes, CancellationToken cancellationToken = default)
    {
        try
        {
            using var tcpClient = new TcpClient();
            using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(4));
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);

            await tcpClient.ConnectAsync(enderecoIpOuHost, porta, linkedCts.Token);
            await using var stream = tcpClient.GetStream();
            await stream.WriteAsync(bytes, linkedCts.Token);
            await stream.FlushAsync(linkedCts.Token);

            return (true, string.Empty);
        }
        catch (Exception ex)
        {
            return (false, $"Falha de conexão com a impressora de rede em {enderecoIpOuHost}:{porta} - {ex.Message}");
        }
    }
}
