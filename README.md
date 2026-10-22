# PDV Atylus - Sistema de Ponto de Venda Moderno & Offline-First

Sistema profissional de **Frente de Caixa (PDV)** desenvolvido com arquitetura robusta, projetado para operar **100% Offline-First**, combinando princípios de **Domain-Driven Design (DDD)**, **CQRS** com MediatR, e recursos inovadores como **Importação Inteligente de Planilhas via IA**, **Pix Automático com Simulador Local** e **Backup Automatizado em Nuvem**.

---

## 🚀 Arquitetura & Tecnologias

### Backend (.NET 8 Web API)
* **Arquitetura:** Clean Architecture com Domain-Driven Design (DDD).
* **Padrão CQRS:** Implementado via `MediatR` (Commands, Queries, Notifications e Handlers desacoplados).
* **Persistência de Dados:** SQLite com Entity Framework Core 8 (opera 100% offline, leve e embarcado).
* **Validação de Entrada:** `FluentValidation` integrado ao pipeline de Commands do MediatR.
* **Tarefas em Segundo Plano:** `IHostedService` / `BackgroundService` para backup periódico e reconciliação.
* **Autenticação:** Controle de Operadores com PIN/Matrícula e elevação para Supervisor (cancelamentos e descontos).

### Frontend (React 18 + TypeScript)
* **Build Tool:** Vite + React + TypeScript.
* **Estilização:** Tailwind CSS + Lucide React (Ícones).
* **Gerenciamento de Estado:** Zustand (`useCartStore`, `useCashierStore`, `useAuthStore`) + TanStack Query.
* **Ergonomia do Operador:** Interface de balcão de alta produtividade:
  * 100% operável via atalhos de teclado (`F1` a `F3`, `Del`, `+`, `-`, `Esc`).
  * Captura global de leitor de código de barras (HID) com auto-foco persistente.
  * Suporte a quantidade por multiplicador (ex: `3*7891234567890`).
  * Impressão de Cupom Não-Fiscal em formato 80mm/58mm via CSS `@media print`.

---

## 🌟 Recursos Diferenciais

1. **Importador Inteligente de Planilhas via IA:**
   * Leitura de arquivos `.xlsx` / `.csv`.
   * Análise semântica das colunas usando Google Gemini (ou OpenAI como alternativa) para identificar automaticamente Código de Barras, Nome, Preço de Custo, Preço de Venda e Estoque.
   * Interface interativa para pré-visualização e confirmação pelo usuário.

2. **Recebimento por Pix Automático:**
   * Geração de QR Code e Copia-e-Cola (BR Code EMV).
   * Polling e Background Worker para confirmação em tempo real.
   * **Simulador Local Embutido:** Permite testar o fluxo de ponta a ponta sem internet e sem necessidade de credenciais bancárias durante o desenvolvimento.

3. **Backup Automatizado no Google Drive:**
   * `GoogleDriveBackupWorker` empacota o banco SQLite (`pdv.db`) em `.zip` com timestamp.
   * Autenticação não-interativa via Service Account (`credentials.json`).
   * **Fila de Contingência Offline:** Caso o terminal esteja sem conexão com a internet, os backups são armazenados localmente na pasta `/backups` e sincronizados automaticamente assim que a conexão for restabelecida.

---

## 📁 Estrutura do Repositório

```text
PDV-ATYLUS/
├── src/
│   ├── backend/
│   │   ├── PDV.Domain/             # Entidades, Enums, Interfaces de Repositório e Serviços
│   │   ├── PDV.Application/        # CQRS (Commands, Queries, DTOs, Handlers, Validators)
│   │   ├── PDV.Infrastructure/     # EF Core SQLite DbContext, Repositórios, Gateways (Pix, Drive, IA)
│   │   └── PDV.API/                # Controllers REST, Middlewares, DI Setup, Background Workers
│   └── frontend/
│       ├── public/
│       └── src/
│           ├── components/         # Modais, Teclado Virtual, Botões de Atalho, Cupom
│           ├── features/
│           │   ├── pos/            # Tela principal de Caixa e Venda
│           │   ├── cashier/        # Abertura, Fechamento Cego, Sangria e Suprimento
│           │   └── importer/       # Módulo de importação de planilhas via IA
│           ├── store/              # Stores Zustand (Carrinho, Caixa, Autenticação)
│           └── services/           # Clientes HTTP Axios e Hooks TanStack Query
├── .gitignore
└── README.md
```

---

## 🛠️ Como Executar o Projeto

### Pré-requisitos
* [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
* [Node.js 18+](https://nodejs.org/)

### Executando o Backend (.NET)
```bash
cd src/backend/PDV.API
dotnet run
```
Acesse o Swagger em: `https://localhost:5001/swagger` (ou `http://localhost:5000/swagger`).

### Executando o Frontend (Vite + React)
```bash
cd src/frontend
npm install
npm run dev
```
Acesse a aplicação em: `http://localhost:5173`.

---

## 📜 Licença
Projeto desenvolvido com fins de automação comercial e gestão de vendas.
