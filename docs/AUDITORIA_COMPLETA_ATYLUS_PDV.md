# RELATÓRIO DE AUDITORIA COMPLETA E RIGOROSA — ATYLUS PDV

**Versão da Auditoria:** 1.0.0  
**Data da Auditoria:** 11/11/2026  
**Ambiente Auditado:** Windows 11 / .NET 8 SDK / Node.js 24 / SQLite (WAL mode)  
**Status do Projeto:** Em desenvolvimento funcional / **INAPTO PARA LANÇAMENTO COMERCIAL IMEDIATO**

---

## 1. RESUMO EXECUTIVO

O **ATYLUS PDV** é um sistema de Ponto de Venda voltado para o comércio varejista (mercados, conveniências, padarias e pequenos negócios). O sistema combina:
- **Backend:** ASP.NET Core 8 com Clean Architecture, CQRS (MediatR), FluentValidation e Entity Framework Core com SQLite.
- **Frontend:** Single Page Application (SPA) em React 18, TypeScript, TailwindCSS, Lucide Icons e Zustand para gerenciamento de estado cliente.
- **Topologia Almejada:** Servidor principal executando localmente e atendendo múltiplos terminais na rede interna com suporte offline-first.

### Avaliação Geral dos Pilares de Engenharia:
1. **Arquitetura Geral (Nota: 8.5/10):** A espinha dorsal do backend foi estruturada seguindo rigorosamente princípios de Clean Architecture. Os casos de uso de venda e caixa utilizam Commands, Handlers e Domain Exceptions de forma limpa e manutenível.
2. **Confiabilidade das Vendas (Nota: 7.5/10):** O registro de vendas utiliza transação atômica gerenciada por `UnitOfWork` com rollback automático e bloqueio de margem de custo negativa.
3. **Segurança e Controle de Acesso (Nota: 2.0/10 - CRÍTICA):** O sistema não possui autenticação real. Qualquer requisição HTTP disparada contra a porta 5000 do servidor local tem acesso irrestrito de gravação, exclusão e consulta de dados financeiros. No frontend, o login é meramente cosmético e gravado em `localStorage`.
4. **Persistência de Dados (Nota: 4.0/10 - ALTO RISCO):** Enquanto Vendas, Produtos e Caixas são gravados no banco SQLite local, os módulos inteiros de **Clientes** e **Ordens de Serviço** existem **apenas na memória do navegador (`localStorage`)**, sendo perdidos com limpeza de cookies ou uso de janelas anônimas, e inacessíveis por outros computadores da rede.
5. **Concorrência e Banco SQLite (Nota: 6.0/10):** O banco está configurado em modo WAL (`journal_mode=WAL`), mas o sequencial de vendas depende de leitura prévia no repositório, o que provoca colisões e falhas de índice único em vendas concorrentes entre caixas.
6. **Cobertura de Testes (Nota: 0.0/10):** Não existe nenhum projeto de teste automatizado (nem de backend com xUnit/NUnit, nem de frontend com Vitest/Jest).

---

## 2. MAPA DA ARQUITETURA REAL

```
[ Terminais Secundários (Navegador / PDV Touch) ]
                     │
                     │  HTTP / REST (Porta 5000)
                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND: ASP.NET Core 8                         │
│                                                                        │
│  [ Camada de Apresentação - PDV.API ]                                  │
│  ├── Middlewares: ExceptionHandlingMiddleware (Tratamento centralizado)│
│  ├── Controllers: Vendas, Caixa, Produtos, Importer, Sync, Printer     │
│  ├── BackgroundWorkers: CloudSyncWorker, GoogleDriveBackupWorker       │
│  └── SPA Static Hosting: Servindo wwwroot React compilado              │
│                                                                        │
│  [ Camada de Aplicação - PDV.Application ]                             │
│  ├── CQRS: Commands & Handlers (CriarVenda, FecharCaixa, etc)          │
│  ├── Queries & Handlers (ObterProdutos, ObterCaixaAtual, etc)          │
│  └── Validações: FluentValidation integrado                            │
│                                                                        │
│  [ Camada de Domínio - PDV.Domain ]                                    │
│  ├── Entidades: Venda, ItemVenda, PagamentoVenda, Caixa, Movimentacao, │
│  │              Produto, Operador, RegistroSincronizacao               │
│  └── Regras: DomainException, BCrypt Pin Hashing                       │
│                                                                        │
│  [ Camada de Infraestrutura - PDV.Infrastructure ]                     │
│  ├── PdvDbContext (EF Core) com WAL, NORMAL sync, Foreign Keys ON      │
│  ├── Repositórios & UnitOfWork (Transaction Scope atômico)             │
│  └── Serviços: ThermalPrinter (ESC/POS), SpreadsheetAi, CloudSync      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │             BANCO DE DADOS LOCAL (SQLite)               │
       │  Arquivo: pdv.db (ou %APPDATA%/PDV-ATYLUS/pdv.db)       │
       │  Tabelas: Produtos, Caixas, Movimentacoes, Vendas,      │
       │           ItensVenda, PagamentosVenda, Operadores       │
       │  FALTAM NO BANCO: Clientes, OrdensServico (Estão em LS) │
       └─────────────────────────────────────────────────────────┘
```

---

## 3. QUADRO GERAL DE PROBLEMAS E VULNERABILIDADES

| ID | Gravidade | Módulo | Arquivo / Linha | Descrição Sintética |
| :---: | :---: | :---: | :--- | :--- |
| **SEC-01** | <span style="color:red">**CRÍTICO**</span> | Segurança | `src/frontend/src/store/useAuthStore.ts:50` | Autenticação no frontend é mockada; qualquer e-mail/senha é aceito e vira Supervisor. |
| **SEC-02** | <span style="color:red">**CRÍTICO**</span> | Segurança | `src/backend/PDV.API/Program.cs:131` | API não possui pipeline de autenticação JWT/Cookie; qualquer máquina na rede local tem acesso irrestrito. |
| **DAT-01** | <span style="color:red">**CRÍTICO**</span> | Persistência | `src/frontend/src/store/useClientsAndOrdersStore.ts:25` | Módulos inteiros de Clientes e Ordens de Serviço residem em `localStorage` e não no SQLite. |
| **FIN-01** | <span style="color:red">**CRÍTICO**</span> | Fiscal/Regra | `src/backend/PDV.Application/.../VendasCommands.cs:124` | Brecha no cálculo de troco permitindo subtrair troco de pagamentos eletrônicos (Cartão/Pix). |
| **CON-01** | <span style="color:orange">**ALTO**</span> | Concorrência | `src/backend/PDV.Infrastructure/.../Repositories.cs:80` | Sequencial de venda com leitura prévia sofre de condição de corrida em vendas simultâneas. |
| **SEC-03** | <span style="color:orange">**ALTO**</span> | Segurança | `src/backend/PDV.Application/.../VendasCommands.cs:186` | Validação de PIN de cancelamento itera com BCrypt sobre todos os supervisores (vulnerável a DoS por CPU). |
| **DB-01** | <span style="color:orange">**ALTO**</span> | Banco de Dados | `src/backend/PDV.API/Program.cs:50` | Uso de `EnsureCreated()` em vez de migrações (`Migrate()`); impede evolução de esquema em clientes reais. |
| **ARC-01** | <span style="color:blue">**MÉDIO**</span> | Arquitetura | `src/backend/PDV.API/Controllers/ImporterController.cs:13` | Quebra do padrão CQRS: Controller acessa diretamente o repositório sem passar pelo MediatR. |
| **PERF-01**| <span style="color:blue">**MÉDIO**</span> | Frontend/Perf | `src/frontend/src/features/pos/POSView.tsx:87` | Temporizador infinito de 1500ms disputando `focus()` com o usuário e consumindo ciclos de CPU. |
| **TEST-01**| <span style="color:blue">**MÉDIO**</span> | Qualidade | Projeto Global | Ausência total de suíte de testes automatizados unitários ou de integração. |
| **ENV-01** | <span style="color:green">**BAIXO**</span> | Ambiente | `src/backend/PDV.API/Program.cs:112` | Caminho absoluto hardcoded do desenvolvedor na busca de arquivos estáticos. |

---

## 4. ANÁLISE TÉCNICA APROFUNDADA DOS PROBLEMAS

### [SEC-01 & SEC-02] Autenticação Ilusória no Frontend e API Totalmente Exposta na Rede Local
- **Classificação:** <span style="color:red">**CRÍTICO**</span>
- **Evidência no Código:**
  Em [`useAuthStore.ts`](file:///c:/Users/Luiz%20Ed/OneDrive/Documentos/PDV-ATYLUS/src/frontend/src/store/useAuthStore.ts#L50-L64):
  ```typescript
  login: async (emailOuMatricula, _senhaOuPin) => {
    const novo: OperadorAuth = {
      id: emailOuMatricula,
      matricula: emailOuMatricula.includes('@') ? emailOuMatricula.split('@')[0].toUpperCase() : emailOuMatricula,
      nome: emailOuMatricula.includes('@') ? emailOuMatricula.split('@')[0] : `Operador ${emailOuMatricula}`,
      email: emailOuMatricula.includes('@') ? emailOuMatricula : `${emailOuMatricula}@atylus.com`,
      role: 'Supervisor', // SEMPRE concede perfil de Supervisor a qualquer login!
      avatarUrl: get().operador.avatarUrl || operadorPadrao.avatarUrl,
    };
    set({ operador: novo, autenticado: true });
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify({ operador: novo, autenticado: true }));
    return true;
  }
  ```
  No backend [`Program.cs`](file:///c:/Users/Luiz%20Ed/OneDrive/Documentos/PDV-ATYLUS/src/backend/PDV.API/Program.cs#L131):
  ```csharp
  app.UseAuthorization(); // Está presente, mas nenhum AuthenticationScheme (como JWT Bearer) foi registrado!
  ```
- **Impacto no Funcionamento do PDV:**
  1. Qualquer funcionário ou operador que digitar qualquer palavra e senha no login entra no sistema com privilégios de **Supervisor**.
  2. Qualquer dispositivo conectado à rede Wi-Fi do comércio (como celulares de clientes ou computadores secundários) pode disparar requisições diretas como:
     `POST http://192.168.1.100:5000/api/v1/caixa/fechar-cego`
     `POST http://192.168.1.100:5000/api/v1/produtos` (alterando preços de produtos)
     `POST http://192.168.1.100:5000/api/v1/vendas/{id}/cancelar`
     e a API aceitará sem exigir nenhum token ou credencial.
- **Solução Recomendada:**
  1. Criar endpoint `/api/v1/auth/login` no backend que consulta `Operador` pelo código/matrícula e valida o hash BCrypt do PIN/Senha.
  2. Emitir token JWT com expiração e claims de perfil (`Operador` ou `Supervisor`).
  3. Proteger os controladores com `[Authorize]` e `[Authorize(Roles = "Supervisor")]`.

---

### [DAT-01] Clientes e Ordens de Serviço Armazenados Apenas no `localStorage`
- **Classificação:** <span style="color:red">**CRÍTICO**</span>
- **Evidência no Código:**
  Em [`useClientsAndOrdersStore.ts`](file:///c:/Users/Luiz%20Ed/OneDrive/Documentos/PDV-ATYLUS/src/frontend/src/store/useClientsAndOrdersStore.ts#L25-L27):
  ```typescript
  const STORAGE_KEY_CLIENTES = 'pdv_atylus_clientes_v1';
  const STORAGE_KEY_ORDENS = 'pdv_atylus_ordens_v1';
  ```
  Inspecionando o arquivo [`PdvDbContext.cs`](file:///c:/Users/Luiz%20Ed/OneDrive/Documentos/PDV-ATYLUS/src/backend/PDV.Infrastructure/Context/PdvDbContext.cs), constata-se que **não existem `DbSet<Cliente>` nem `DbSet<OrdemServico>`**.
- **Impacto no Funcionamento do PDV:**
  1. Se um operador limpar o histórico de navegação, mudar de navegador ou formatar o terminal, **todos os clientes cadastrados e todas as Ordens de Serviço (com valores e peças) são destruídos**.
  2. Na arquitetura planejada de rede local, quando um funcionário cadastrar um cliente no Caixa 02, o Caixa 01 **não verá o cliente**, pois os dados estão presos na máquina local do navegador.
- **Solução Recomendada:**
  1. Adicionar entidades `Cliente` e `OrdemServico` na camada `PDV.Domain`.
  2. Configurar tabelas e relacionamentos no `PdvDbContext` e mapear chaves estrangeiras.
  3. Criar comandos e queries via MediatR (`CriarClienteCommand`, `ObterClientesQuery`, etc.) e expor endpoints REST.
  4. Atualizar o `useClientsAndOrdersStore.ts` para sincronizar via `pdvApi`.

---

### [FIN-01] Falha no Cálculo de Troco com Múltiplas Formas de Pagamento
- **Classificação:** <span style="color:red">**CRÍTICO**</span>
- **Evidência no Código:**
  Em [`VendasCommands.cs:124-128`](file:///c:/Users/Luiz%20Ed/OneDrive/Documentos/PDV-ATYLUS/src/backend/PDV.Application/Commands/Vendas/VendasCommands.cs#L124-L128):
  ```csharp
  var totalPagoSemTroco = request.Pagamentos.Sum(p => p.Valor - p.Troco);
  if (totalPagoSemTroco < venda.ValorLiquido)
  {
      throw new DomainException($"Total recebido (R$ {totalPagoSemTroco:F2}) é insuficiente...");
  }
  ```
- **Explicação da Falha:**
  O sistema realiza `Sum(p => p.Valor - p.Troco)` indiscriminadamente em todos os itens da lista de pagamentos.
  1. Se uma venda de R$ 50,00 for registrada com `Cartão de Débito: R$ 80,00` e `Troco: R$ 30,00`, o sistema aceita, permitindo dar troco em dinheiro com base em pagamento digital que não permite saque.
  2. Não há validação impedindo que `Troco` seja maior que `Valor` entregue em dinheiro, podendo gerar valores negativos ou discrepâncias contábeis no fechamento cego de caixa.
- **Solução Recomendada:**
  Inserir regra no `CriarVendaCommandValidator` e no Handler:
  ```csharp
  foreach (var pag in request.Pagamentos)
  {
      if (pag.Troco > 0 && pag.FormaPagamento != FormaPagamento.Dinheiro)
      {
          throw new DomainException("Troco só é permitido para pagamentos realizados em Dinheiro.");
      }
      if (pag.Troco >= pag.Valor)
      {
          throw new DomainException("O troco não pode ser igual ou superior ao valor em dinheiro entregue.");
      }
  }
  ```

---

### [CON-01] Condição de Corrida no Sequencial de Venda Multi-Terminal
- **Classificação:** <span style="color:orange">**ALTO**</span>
- **Evidência no Código:**
  Em [`Repositories.cs:80`](file:///c:/Users/Luiz%20Ed/OneDrive/Documentos/PDV-ATYLUS/src/backend/PDV.Infrastructure/Repositories/Repositories.cs#L80):
  ```csharp
  public async Task<int> ObterProximoSequencialVendaAsync(string terminalId, CancellationToken cancellationToken)
  {
      var ultimo = await _context.Vendas
          .Where(v => v.TerminalId == terminalId)
          .OrderByDescending(v => v.NumeroSequencial)
          .Select(v => v.NumeroSequencial)
          .FirstOrDefaultAsync(cancellationToken);
      return ultimo + 1;
  }
  ```
  E na configuração do banco [`PdvDbContext.cs:68`](file:///c:/Users/Luiz%20Ed/OneDrive/Documentos/PDV-ATYLUS/src/backend/PDV.Infrastructure/Context/PdvDbContext.cs#L68):
  ```csharp
  entity.HasIndex(v => new { v.TerminalId, v.NumeroSequencial }); // Índice composto
  ```
- **Impacto no Funcionamento do PDV:**
  Se dois operadores registrarem uma venda no mesmo instante utilizando o terminal padrão (`CX01`), a query `ObterProximoSequencialVendaAsync` retornará o mesmo número (por exemplo, `145`) para ambos. Quando a segunda venda tentar o commit, ocorrerá um erro ou duplicação de sequencial no cupom impresso, violando a sequência temporal exigida pelo fisco e controle interno.
- **Solução Recomendada:**
  Utilizar autoincremento nativo do SQLite ou tabela de controle de numeração bloqueada com transação exclusiva durante o fechamento da venda.

---

### [SEC-03] Potencial Negação de Serviço (DoS por CPU) na Validação de PIN de Supervisor
- **Classificação:** <span style="color:orange">**ALTO**</span>
- **Evidência no Código:**
  Em [`VendasCommands.cs:185-187`](file:///c:/Users/Luiz%20Ed/OneDrive/Documentos/PDV-ATYLUS/src/backend/PDV.Application/Commands/Vendas/VendasCommands.cs#L185-L187):
  ```csharp
  var supervisores = await _operadorRepository.ObterSupervisoresAtivosAsync(cancellationToken);
  var supervisorAutorizado = supervisores.FirstOrDefault(s => s.ValidarPin(request.SupervisorPin));
  ```
- **Explicação:** O algoritmo de BCrypt é intencionalmente custoso computacionalmente (WorkFactor padrão ~10). Executar `s.ValidarPin()` em loop para cada supervisor cadastrado até achar uma correspondência (ou percorrer todos se for incorreto) consumirá 100% da CPU do computador do caixa se houver múltiplos supervisores ou tentativas maliciosas repetidas.
- **Solução Recomendada:** Exigir a matrícula ou identificador do supervisor junto ao PIN (`SupervisorMatricula` + `SupervisorPin`), realizando o hash check em uma única entidade específica: `O(1)`.

---

### [DB-01] Uso de `EnsureCreated()` sem Suporte a Migrações em Produção
- **Classificação:** <span style="color:orange">**ALTO**</span>
- **Evidência no Código:**
  Em [`Program.cs:50`](file:///c:/Users/Luiz%20Ed/OneDrive/Documentos/PDV-ATYLUS/src/backend/PDV.API/Program.cs#L50):
  ```csharp
  context.Database.EnsureCreated();
  ```
- **Impacto no PDV:** O método `EnsureCreated()` só cria o banco se ele não existir. Caso uma nova versão do sistema adicione colunas (como dados fiscais, campos de desconto ou novos tipos de pagamento), o SQLite **não adicionará essas colunas** em bancos existentes no cliente. O software lançará exceções fatais em tempo de execução (`Microsoft.Data.Sqlite.SqliteException: no such column`).
- **Solução Recomendada:** Inicializar as migrações formais do EF Core:
  `dotnet ef migrations add InitialCreate -p src/backend/PDV.Infrastructure -s src/backend/PDV.API`
  E no `Program.cs`:
  `context.Database.Migrate();`

---

## 5. PLANO DE CORREÇÃO EM 5 FASES

### Fase 1 — Correções Críticas (Segurança e Integridade Fiscal)
1. **Autenticação Real:** Implementar autenticação baseada em JWT com controle de roles (`Operador` e `Supervisor`). Proteger todos os endpoints da API.
2. **Correção de Pagamentos:** Adicionar validação estrita proibindo troco para pagamentos que não sejam Dinheiro.
3. **Validação Direcionada de Supervisor:** Alterar a assinatura de cancelamento para receber `(matriculaSupervisor, pin)` e validar pontualmente.

### Fase 2 — Estabilidade e Persistência Completa
1. **Modelagem de Clientes e Ordens no Banco:** Criar as entidades `Cliente` e `OrdemServico` no domínio e configurar tabelas no EF Core.
2. **Endpoints de Clientes e OS:** Implementar Commands e Queries no MediatR para todas as operações de clientes e ordens.
3. **Conexão Frontend-Backend:** Substituir o uso de `localStorage` em `useClientsAndOrdersStore.ts` por chamadas à `pdvApi`.

### Fase 3 — Banco de Dados e Concorrência
1. **Migrações Gerenciadas:** Substituir `EnsureCreated()` por migrações EF Core automáticas na inicialização.
2. **Locking no Sequencial:** Garantir que o sequencial de venda seja gerado sob lock transacional imediato no SQLite.
3. **Tratamento de Concorrência de Leitura e Escrita:** Ajustar `PRAGMA busy_timeout=5000` na inicialização da conexão.

### Fase 4 — Otimização e Desempenho
1. **Otimização de Foco no PDV:** Remover o `setInterval` de 1500ms no `POSView.tsx` e substituí-lo por captura focada em eventos de leitor.
2. **Padronização CQRS:** Refatorar o `ImporterController` para utilizar MediatR Commands (`ConfirmarImportacaoPlanilhaCommand`).
3. **Limpeza de Caminhos Locais:** Remover caminhos absolutos do ambiente de desenvolvimento no `Program.cs`.

### Fase 5 — Cobertura de Testes e Empacotamento
1. **Criação do Projeto de Testes:** Criar `PDV.Tests` com xUnit, FluentAssertions e Moq para regras críticas de negócio (venda, troco, estoque, caixa).
2. **Testes de Regressão Automatizados:** Integrar execução de testes no pipeline de build.
3. **Configuração de Instalador Desktop:** Estruturar instalador automático para Windows com inicialização do serviço backend e ícone na bandeja.

---

## 6. PROPOSTA DE TESTES AUTOMATIZADOS (EXEMPLOS REAIS)

Para garantir que as regras críticas nunca quebrem em produção, propõe-se a implementação dos seguintes testes no novo projeto `PDV.Tests`:

```csharp
public class VendaBusinessRulesTests
{
    [Fact]
    public async Task CriarVenda_NaoDevePermitirTroco_QuandoPagamentoNaoForDinheiro()
    {
        // Cenário: Tentativa de registrar Cartão de Crédito com Troco
        var pagamentos = new List<CriarVendaPagamentoInput>
        {
            new(FormaPagamento.CartaoCredito, 100.00m, Troco: 20.00m)
        };
        var command = new CriarVendaCommand("OP01", 0, new List<CriarVendaItemInput> { new(Guid.NewGuid(), 1, 80.00m) }, pagamentos);

        var handler = CriarHandlerParaTeste();
        
        Func<Task> act = async () => await handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<DomainException>()
            .WithMessage("*Troco só é permitido para pagamentos realizados em Dinheiro*");
    }

    [Fact]
    public async Task CriarVenda_DeveBloquearOperacao_QuandoPrecoVendaAbaixoDoCusto()
    {
        // Cenário: Margem de custo negativa
        var prodId = Guid.NewGuid();
        var produtoComCustoAlto = new Produto("789123", "Arroz 5kg", 20.00m, PrecoCusto: 25.00m, 50, 5);
        _produtoRepoMock.Setup(r => r.ObterPorIdAsync(prodId, default)).ReturnsAsync(produtoComCustoAlto);

        var command = new CriarVendaCommand("OP01", 0, new List<CriarVendaItemInput> { new(prodId, 1, 20.00m) }, new List<CriarVendaPagamentoInput> { new(FormaPagamento.Dinheiro, 20.00m) });

        var handler = CriarHandlerParaTeste();

        Func<Task> act = async () => await handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<DomainException>()
            .WithMessage("*Bloqueio de preço de custo elevado*");
    }
}
```

---

## 7. AVALIAÇÃO FINAL POR MÓDULO

| Módulo | Status Atual | Requisitos para Homologação Comercial |
| :--- | :---: | :--- |
| **Login e Sessão** | <span style="color:red">**Crítico**</span> | Implementar JWT no backend e validação real de operadores via BCrypt. |
| **Nova Venda (Frente de Caixa)** | **Aprovado com ressalvas** | Corrigir validação de troco e concorrência no sequencial. |
| **Produtos e Estoque** | **Aprovado** | Operações, edição inline e bloqueio de margem de custo funcionais. |
| **Controle de Caixa** | **Aprovado** | Regras de abertura, fechamento cego e sangria bem implementadas. |
| **Histórico de Vendas** | **Aprovado com ressalvas** | Otimizar validação do PIN de supervisor para autorização de cancelamentos. |
| **Clientes** | <span style="color:red">**Não Homologado**</span> | Migrar de `localStorage` para tabelas no SQLite via API. |
| **Ordens de Serviço** | <span style="color:red">**Não Homologado**</span> | Migrar de `localStorage` para tabelas no SQLite via API. |
| **Suíte de Testes** | <span style="color:red">**Inexistente**</span> | Criar projeto de testes automatizados com cobertura das regras financeiras. |

---

> **Aviso de Conformidade:** Nenhuma linha de código foi alterada no repositório. O relatório reflete uma auditoria estática e dinâmica completa sobre o código-fonte atual do projeto.
