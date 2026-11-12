# Banco de dados do ATYLUS PDV — migrations, backup e recuperação

Desde a correção **DB-01**, o SQLite do PDV é criado e atualizado exclusivamente por **migrations do Entity Framework Core**.
O antigo `EnsureCreated()` foi removido: ele não alterava bancos existentes, o que deixava instalações antigas sem as
tabelas/colunas exigidas pelo código novo.

## Gerações de esquema anteriores às migrations

| Geração | Código | Período | Migration equivalente |
|---|---|---|---|
| G1 | commits `1b7c27a` … `d88c7f3` | 22/10 a 03/11/2026 | `20261112171908_EsquemaInicial` |
| G2 | commit `6b1fa3b` em diante | a partir de 04/11/2026 | `20261112172002_SincronizacaoMultiTerminal` |

O primeiro commit (`8120d81`) não compilava e nunca gerou bancos. O DDL exato de G1 e G2 está em
`src/backend/PDV.Tests/BancoDados/Esquemas/` e os testes garantem que as migrations reproduzem cada geração.

## Política: bancos existentes só mudam com autorização explícita

| Situação do banco | Inicialização normal do PDV |
|---|---|
| Novo (arquivo inexistente ou vazio) | Criado pelas migrations normalmente. |
| Gerenciado e atualizado | Inicia normalmente, sem nenhuma escrita. |
| Existente que precisa de atualização (legado G1/G2 sem histórico, ou migration pendente) | **Não é alterado.** O PDV não inicia e mostra a mensagem *"O banco de dados … precisa ser ATUALIZADO"* com o comando de autorização. |
| Incompatível | **Não é alterado.** O PDV não inicia e lista as diferenças. |

A atualização de um banco existente (inclusive o simples registro de baseline de um banco G2) acontece **somente** pelo
comando administrativo abaixo, que exige confirmar o arquivo e a versão de destino.

A opção `Banco:AtualizacaoAutomatica` (padrão `false`) está reservada para versões comerciais futuras que queiram
atualizar na inicialização; ela **não está habilitada** em nenhuma configuração atual.

## Comando administrativo de atualização

1. Encerre o PDV e confira o diagnóstico (nada é alterado):

```bash
PDV.API.exe --atualizar-banco
```

   Mostra o banco selecionado, a situação, as alterações pendentes, a versão de destino desta build e o comando exato de confirmação.

2. Autorize, confirmando o arquivo e a versão de destino exibidos:

```bash
PDV.API.exe --atualizar-banco --banco "C:\caminho\do\pdv.db" --destino 20261112172002_SincronizacaoMultiTerminal --confirmar
```

   Se o arquivo ou a versão não corresponderem exatamente ao banco configurado e à build, nada é alterado.
   Códigos de saída: `0` concluído/nada a fazer, `1` falha ou banco incompatível, `2` confirmação necessária.

3. Inicie o PDV normalmente.

## Etapas da atualização

O serviço `MigradorBancoDados` (`PDV.Infrastructure/Persistence`) roda antes de qualquer acesso ao banco
(na inicialização normal apenas até o diagnóstico, para bancos existentes):

1. **Trava exclusiva** `pdv.db.migracao.lock` (ao lado do banco). Outra instância espera até 60 s e, se a trava não
   for liberada, falha com mensagem clara **sem alterar o banco**.
2. **Diagnóstico** (somente leitura): `PRAGMA quick_check` e comparação do esquema real com o esperado.
   - *Novo* (arquivo inexistente ou vazio): criado inteiro pelas migrations.
   - *Gerenciado*: possui `__EFMigrationsHistory` coerente com o esquema; aplica apenas o que estiver pendente.
   - *Legado reconhecido*: criado por `EnsureCreated()` em G1 ou G2; recebe **baseline** (registro das migrations
     equivalentes no histórico, sem recriar tabelas) e depois as migrations pendentes.
   - *Incompatível*: esquema desconhecido/divergente, banco corrompido ou atualizado por versão mais nova.
     **Nada é alterado**; o PDV não inicia e informa as diferenças.
   - Tabelas que não pertencem ao PDV (ex.: `Users`, de uma branch experimental) são **preservadas** e registradas em log.
3. **Backup consistente** pela API de backup do SQLite (`BackupDatabase`, inclui o conteúdo do WAL) em
   `<pasta do banco>/backups/pdv-antes-migracao-<origem>-<data>.db`, com verificação prévia de espaço livre.
4. **Validação do backup**: `integrity_check`, esquema idêntico e contagem + hash do conteúdo de todas as tabelas
   idênticos ao original. Se falhar, **nenhuma alteração é feita**.
5. **Baseline** (somente bancos legados), em transação.
6. **Migrations** (`Migrate()`): cada migration roda em sua própria transação.
7. **Validação final**: esquema igual ao das migrations e o conteúdo original de todas as tabelas preservado
   (mesmas linhas e valores nas colunas que já existiam).

As etapas 3 a 7 só ocorrem com autorização explícita. Reiniciar o PDV sem migrations pendentes **não grava nada** e não cria backup.

## Verificar um banco sem alterá-lo

```bash
PDV.API.exe --verificar-banco
```

Mostra a situação, a geração reconhecida, as migrations pendentes, tabelas extras e problemas. Não cria chave,
não aplica migrations e não inicia o servidor (o SQLite pode criar os arquivos auxiliares vazios `-wal`/`-shm`).
Código de saída `1` indica banco incompatível. Use `PDV_DATA_DIR` para apontar outra pasta.

## Se a atualização falhar

A mensagem informa a etapa e o caminho do backup validado.

- **Falha na trava, no diagnóstico ou no backup**: o banco **não foi alterado**. Corrija a causa (encerre a outra
  instância, libere espaço, corrija permissões) e inicie novamente.
- **Falha durante uma migration**: a migration em andamento é desfeita pela transação; as anteriores continuam
  registradas no histórico. Corrija a causa e execute novamente o comando `--atualizar-banco` — a atualização é
  **retomada** do ponto em que parou.

### Restaurar o backup (somente se necessário)

1. Encerre todas as instâncias do PDV.
2. Renomeie o banco atual para `pdv.db.falhou-<data>` (e também `pdv.db-wal`/`pdv.db-shm`, se existirem). **Não apague.**
3. Copie o arquivo de `backups/pdv-antes-migracao-….db` para `pdv.db`.
4. Rode `--verificar-banco` para confirmar a situação antes de iniciar o PDV.

A restauração nunca é automática, para não sobrescrever dados sem decisão de uma pessoa.

## Criando novas migrations (desenvolvimento)

```bash
dotnet tool restore
```

```bash
dotnet ef migrations add NomeDaMudanca --project src/backend/PDV.Infrastructure --startup-project src/backend/PDV.API --output-dir Migrations
```

Regras:

- Prefira operações aditivas (`CreateTable`, `AddColumn` anulável ou com valor padrão, `CreateIndex`).
- Mudanças que exigem recriar tabela (renomear/remover coluna, mudar tipo) precisam de revisão específica e teste com cópia de banco real.
- **Nunca** adicione migrations à lista `MigradorBancoDados.MigracoesLegadas`: ela representa apenas bancos criados antes das migrations.
- A validação final exige que os dados existentes sejam preservados; uma migration que transforme dados precisa de tratamento explícito.
- Índices únicos sobre dados existentes exigem análise prévia (ex.: vendas antigas recebem `NumeroSequencial = 1` — relevante para o CON-01).

## Limitações conhecidas

- A trava é por arquivo e protege instâncias na mesma máquina; banco em pasta de rede compartilhada não é suportado.
- O backup lê o banco inteiro (adequado ao tamanho típico de um PDV local).
