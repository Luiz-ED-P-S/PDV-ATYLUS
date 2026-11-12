-- Esquema G2 do ATYLUS PDV: DDL gerado por EnsureCreated() no código a partir do commit 6b1fa3b (04/11/2026), antes das migrations.
-- Extraído com GenerateCreateScript() do PdvDbContext do commit ddc366e. Reproduz o esquema real dos bancos criados nesse período.
-- Fixture somente de estrutura (sem dados reais).

CREATE TABLE "Caixas" (
    "Id" TEXT NOT NULL CONSTRAINT "PK_Caixas" PRIMARY KEY,
    "OperadorId" TEXT NOT NULL,
    "DataAbertura" TEXT NOT NULL,
    "DataFechamento" TEXT NULL,
    "SaldoInicial" TEXT NOT NULL,
    "SaldoFinalInformado" TEXT NULL,
    "Status" INTEGER NOT NULL,
    "ObservacoesFechamento" TEXT NULL,
    "CriadoEm" TEXT NOT NULL,
    "AtualizadoEm" TEXT NULL
);


CREATE TABLE "FilaSincronizacao" (
    "Id" TEXT NOT NULL CONSTRAINT "PK_FilaSincronizacao" PRIMARY KEY,
    "TerminalId" TEXT NOT NULL,
    "TipoEntidade" TEXT NOT NULL,
    "EntidadeId" TEXT NOT NULL,
    "Operacao" TEXT NOT NULL,
    "PayloadJson" TEXT NOT NULL,
    "Status" INTEGER NOT NULL,
    "Tentativas" INTEGER NOT NULL,
    "UltimaTentativaEm" TEXT NULL,
    "MensagemErro" TEXT NULL,
    "SincronizadoEm" TEXT NULL,
    "CriadoEm" TEXT NOT NULL,
    "AtualizadoEm" TEXT NULL
);


CREATE TABLE "Operadores" (
    "Id" TEXT NOT NULL CONSTRAINT "PK_Operadores" PRIMARY KEY,
    "Nome" TEXT NOT NULL,
    "Matricula" TEXT NOT NULL,
    "Pin" TEXT NOT NULL,
    "Perfil" INTEGER NOT NULL,
    "Ativo" INTEGER NOT NULL,
    "CriadoEm" TEXT NOT NULL,
    "AtualizadoEm" TEXT NULL
);


CREATE TABLE "Produtos" (
    "Id" TEXT NOT NULL CONSTRAINT "PK_Produtos" PRIMARY KEY,
    "CodigoBarras" TEXT NOT NULL,
    "Nome" TEXT NOT NULL,
    "PrecoVenda" TEXT NOT NULL,
    "PrecoCusto" TEXT NOT NULL,
    "EstoqueAtual" TEXT NOT NULL,
    "EstoqueMinimo" TEXT NOT NULL,
    "Ativo" INTEGER NOT NULL,
    "CriadoEm" TEXT NOT NULL,
    "AtualizadoEm" TEXT NULL
);


CREATE TABLE "Vendas" (
    "Id" TEXT NOT NULL CONSTRAINT "PK_Vendas" PRIMARY KEY,
    "CaixaId" TEXT NOT NULL,
    "OperadorId" TEXT NOT NULL,
    "TerminalId" TEXT NOT NULL DEFAULT 'CX01',
    "NumeroSequencial" INTEGER NOT NULL DEFAULT 1,
    "DataVenda" TEXT NOT NULL,
    "ValorTotal" TEXT NOT NULL,
    "Desconto" TEXT NOT NULL,
    "Status" INTEGER NOT NULL,
    "MotivoCancelamento" TEXT NULL,
    "ClienteNome" TEXT NULL,
    "ClienteDocumento" TEXT NULL,
    "CriadoEm" TEXT NOT NULL,
    "AtualizadoEm" TEXT NULL
);


CREATE TABLE "MovimentacoesCaixa" (
    "Id" TEXT NOT NULL CONSTRAINT "PK_MovimentacoesCaixa" PRIMARY KEY,
    "CaixaId" TEXT NOT NULL,
    "Tipo" INTEGER NOT NULL,
    "Valor" TEXT NOT NULL,
    "Motivo" TEXT NOT NULL,
    "OperadorId" TEXT NOT NULL,
    "DataHora" TEXT NOT NULL,
    "CriadoEm" TEXT NOT NULL,
    "AtualizadoEm" TEXT NULL,
    CONSTRAINT "FK_MovimentacoesCaixa_Caixas_CaixaId" FOREIGN KEY ("CaixaId") REFERENCES "Caixas" ("Id") ON DELETE CASCADE
);


CREATE TABLE "ItensVenda" (
    "Id" TEXT NOT NULL CONSTRAINT "PK_ItensVenda" PRIMARY KEY,
    "VendaId" TEXT NOT NULL,
    "ProdutoId" TEXT NOT NULL,
    "ProdutoNome" TEXT NOT NULL,
    "CodigoBarras" TEXT NOT NULL,
    "Quantidade" TEXT NOT NULL,
    "PrecoUnitario" TEXT NOT NULL,
    "CriadoEm" TEXT NOT NULL,
    "AtualizadoEm" TEXT NULL,
    CONSTRAINT "FK_ItensVenda_Vendas_VendaId" FOREIGN KEY ("VendaId") REFERENCES "Vendas" ("Id") ON DELETE CASCADE
);


CREATE TABLE "PagamentosVenda" (
    "Id" TEXT NOT NULL CONSTRAINT "PK_PagamentosVenda" PRIMARY KEY,
    "VendaId" TEXT NOT NULL,
    "FormaPagamento" INTEGER NOT NULL,
    "Valor" TEXT NOT NULL,
    "Troco" TEXT NOT NULL,
    "TxId" TEXT NULL,
    "CriadoEm" TEXT NOT NULL,
    "AtualizadoEm" TEXT NULL,
    CONSTRAINT "FK_PagamentosVenda_Vendas_VendaId" FOREIGN KEY ("VendaId") REFERENCES "Vendas" ("Id") ON DELETE CASCADE
);


CREATE INDEX "IX_FilaSincronizacao_CriadoEm" ON "FilaSincronizacao" ("CriadoEm");


CREATE INDEX "IX_FilaSincronizacao_Status" ON "FilaSincronizacao" ("Status");


CREATE INDEX "IX_ItensVenda_VendaId" ON "ItensVenda" ("VendaId");


CREATE INDEX "IX_MovimentacoesCaixa_CaixaId" ON "MovimentacoesCaixa" ("CaixaId");


CREATE UNIQUE INDEX "IX_Operadores_Matricula" ON "Operadores" ("Matricula");


CREATE INDEX "IX_PagamentosVenda_VendaId" ON "PagamentosVenda" ("VendaId");


CREATE UNIQUE INDEX "IX_Produtos_CodigoBarras" ON "Produtos" ("CodigoBarras");


CREATE INDEX "IX_Vendas_TerminalId_NumeroSequencial" ON "Vendas" ("TerminalId", "NumeroSequencial");


