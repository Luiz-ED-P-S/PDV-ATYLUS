# Desenho técnico — `CobrancasPix` e confirmação de Pix (pendente de implementação)

> Status: **somente desenho**. Será implementado como uma nova migration após a aprovação da correção 3.
> Nenhuma tabela foi criada ainda.

## Problema

- O frontend lança pagamentos Pix por conta própria (`PaymentModal.tsx`, botão "Simular Confirmação Pix").
- `CriarVenda` aceita qualquer `TxId` sem verificar se a cobrança foi confirmada.
- As cobranças existem só em memória (`PixSimulatorService`), sem auditoria nem proteção contra reutilização.

## Tabela `CobrancasPix` (aditiva — nenhuma tabela existente é alterada)

| Coluna | Tipo | Regra |
|---|---|---|
| `Id` | TEXT (Guid) | PK, gerado pela aplicação |
| `TxId` | TEXT | **único**, gerado pelo servidor |
| `Valor` | TEXT (decimal 18,2) | > 0 |
| `Provedor` | TEXT | `Simulador`, `Manual` ou futuro PSP |
| `Status` | INTEGER | Pendente → Confirmada → Utilizada (ou Expirada) |
| `CriadoEm`, `ExpiraEm` | TEXT | |
| `OperadorMatricula` | TEXT | do token de quem gerou |
| `CaixaId`, `TerminalId` | TEXT | contexto da cobrança |
| `MetodoConfirmacao` | INTEGER NULL | Simulação / Manual (Supervisor) / Provedor |
| `ConfirmadoEm` | TEXT NULL | |
| `SupervisorId`, `SupervisorMatricula` | TEXT NULL | quem autorizou (confirmação manual) |
| `ObservacaoConfirmacao` | TEXT NULL | |
| `VendaId`, `UtilizadoEm` | TEXT NULL | venda que consumiu a cobrança |

Índices: `UNIQUE(TxId)`, `(Status)`, `(VendaId)`. Transições de status com condição sobre o status atual
(`UPDATE … WHERE Status = Pendente`), impedindo confirmação dupla e reutilização mesmo em concorrência.

## Fluxo

1. `POST /payments/pix/generate` grava cobrança **Pendente** (operador e valor definidos no servidor).
2. Confirmação:
   - **Simulação**: só com `Pix:PermitirSimulacao=true` **e** ambiente diferente de Production; senão 404.
   - **Manual**: `POST /payments/pix/{txid}/confirmar-manual` com matrícula + PIN de Supervisor validados no backend
     (com limitação de tentativas), registrando supervisor, data/hora e método "manual". Duplicada → 409.
     A interface exibe "Confirmado manualmente pelo Supervisor X", nunca "pago pelo banco".
   - **Provedor real (futuro)**: implementação de `IPixProvider` atualizando a mesma cobrança.
3. `CriarVenda`: cada pagamento Pix exige `TxId` existente, **Confirmada**, não utilizada e com valor igual;
   na mesma transação da venda passa a **Utilizada** com o `VendaId`. Caso contrário, HTTP 400.
4. Frontend: remove o lançamento local; botão de simulação só quando o backend informar que está disponível;
   formulário de confirmação manual por Supervisor.

## Migração

Uma nova migration `CobrancasPix` (aplicada pelo `MigradorBancoDados`, com backup validado). Histórico financeiro
existente não é alterado: a nova validação vale apenas para vendas novas.

## Limitações da confirmação manual

- Atesta a declaração do Supervisor de que conferiu o recebimento; não prova o crédito bancário (conciliar com o extrato).
- Sem PSP real, produção não exibe QR Code dinâmico (cliente paga pela chave Pix da loja).
- Estorno de Pix em venda cancelada fica para o escopo do FIN-01.
