using PDV.Infrastructure.Persistence;

namespace PDV.API.Administracao;

/// <summary>
/// Comando administrativo que autoriza explicitamente a atualização de um banco existente:
///
///   PDV.API --atualizar-banco                                   (mostra o diagnóstico e o comando de confirmação)
///   PDV.API --atualizar-banco --banco "&lt;arquivo&gt;" --destino &lt;migration&gt; --confirmar
///
/// O arquivo e a versão de destino precisam coincidir exatamente com o banco configurado e com a versão desta
/// build; caso contrário nada é alterado. Usa o mesmo fluxo seguro do migrador (trava, backup validado,
/// baseline, migrations transacionais e validação final). Não inicia o servidor do PDV.
/// </summary>
public static class ComandoAtualizarBanco
{
    public const string Argumento = "--atualizar-banco";

    /// <summary>Códigos de saída: 0 = concluído/nada a fazer, 1 = falha ou banco incompatível, 2 = confirmação necessária.</summary>
    public static int Executar(string[] args, MigradorBancoDados migrador, TextWriter saida)
    {
        var diagnostico = migrador.Diagnosticar();
        var destino = migrador.UltimaMigracao;
        saida.WriteLine(diagnostico.Relatorio());
        saida.WriteLine($"Versão de destino desta build: {destino}");

        switch (diagnostico.Situacao)
        {
            case SituacaoBanco.Incompativel:
                saida.WriteLine("Banco incompatível: a atualização automática não é possível e nada foi alterado.");
                return 1;
            case SituacaoBanco.Novo:
                saida.WriteLine("Banco novo: será criado normalmente na inicialização do PDV. Nada a autorizar.");
                return 0;
            case SituacaoBanco.Gerenciado when diagnostico.MigracoesPendentes.Count == 0:
                saida.WriteLine("O banco já está atualizado. Nada a fazer.");
                return 0;
        }

        var banco = Valor(args, "--banco");
        var destinoInformado = Valor(args, "--destino");
        if (!args.Contains("--confirmar") || banco == null || destinoInformado == null)
        {
            saida.WriteLine();
            saida.WriteLine("Nenhuma alteração foi feita. Para autorizar a atualização deste banco, confira o arquivo e a versão acima e execute:");
            saida.WriteLine($"  PDV.API {Argumento} --banco \"{diagnostico.Banco}\" --destino {destino} --confirmar");
            return 2;
        }

        try
        {
            var resultado = migrador.Executar(new AutorizacaoMigracao(banco, destinoInformado));
            saida.WriteLine("Banco atualizado com sucesso.");
            if (resultado.Backup != null) saida.WriteLine($"Backup validado do estado anterior: {resultado.Backup}");
            saida.WriteLine($"Migrations aplicadas: {(resultado.Aplicadas.Count == 0 ? "nenhuma (somente baseline)" : string.Join(", ", resultado.Aplicadas))}");
            return 0;
        }
        catch (MigracaoBancoException ex)
        {
            saida.WriteLine($"FALHA ({ex.Etapa}): {ex.Message}");
            return 1;
        }
    }

    private static string? Valor(string[] args, string nome)
    {
        var i = Array.IndexOf(args, nome);
        return i >= 0 && i + 1 < args.Length && !args[i + 1].StartsWith("--", StringComparison.Ordinal) ? args[i + 1] : null;
    }
}
