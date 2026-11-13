// Cada coleção sobe a API com um SQLite temporário indicado pela variável de ambiente PDV_DATA_DIR,
// que é global ao processo. Executar as coleções em sequência evita que uma sobrescreva a da outra.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
