# Guia de Configuração: OpenAI Codex CLI com Backend OmniRoute

Este documento detalha a configuração do **OpenAI Codex CLI** para operar utilizando o **OmniRoute** como backend de inferência compatível com a API da OpenAI.

---

## 📌 Visão Geral

O **OmniRoute** funciona como um roteador e proxy unificado de IA, permitindo que ferramentas como o Codex CLI acessem múltiplos provedores (OpenAI, Anthropic, Gemini, DeepSeek, etc.) com balanceamento de carga, fallback resiliente, cache de raciocínio e economia de tokens através do RTK.

---

## ⚙️ Arquivo de Configuração (`~/.codex/config.toml`)

No Windows, o arquivo reside em `%USERPROFILE%\.codex\config.toml` (`C:\Users\<SeuUsuario>\.codex\config.toml`).

```toml
model = "auto"
model_provider = "omniroute"

[model_providers.omniroute]
base_url = "http://localhost:2024/v1"
api_key = "sk-omniroute-local"
wire_api = "responses"

# ----------------------------------------------------
# 7 Perfis Nomeados para Seleção Rápida
# ----------------------------------------------------

# 1. Auto (Roteamento inteligente com fallback automático)
[profiles.auto]
model = "auto"
model_provider = "omniroute"

# 2. Rápido (Baixa latência para comandos rápidos)
[profiles.fast]
model = "gemini-1.5-flash"
model_provider = "omniroute"

# 3. Inteligente / Flagship (Claude 3.7 / Opus para arquitetura)
[profiles.smart]
model = "claude-opus-4-7"
model_provider = "omniroute"

# 4. Raciocínio (DeepSeek R1 / o1 para depuração profunda)
[profiles.reasoning]
model = "deepseek-r1"
model_provider = "omniroute"

# 5. Custo Otimizado (Menor custo de tokens)
[profiles.cost-optimized]
model = "cost-optimized"
model_provider = "omniroute"

# 6. Código (GPT-4o para testes e refatorações)
[profiles.code]
model = "gpt-4o"
model_provider = "omniroute"

# 7. Assinatura (Usa contas com assinatura fixa ativas)
[profiles.subscription]
model = "subscription"
model_provider = "omniroute"
```

---

## 🚀 Como Executar com Cada Perfil

```bash
# Execução padrão (usa o perfil 'auto'):
codex "Explique a arquitetura do projeto"

# Usando o modelo flagship (Claude 3.7 / Opus):
codex --profile smart "Refatore a entidade Venda com padrão DDD"

# Usando modelo rápido (Gemini Flash):
codex --profile fast "Crie um teste unitário simples"

# Usando raciocínio estendido (DeepSeek R1):
codex --profile reasoning "Encontre a causa raiz desta condição de corrida"
```

---

## 🛡️ Suporte a Tarefas de Longa Duração (Long-Running Tasks)

Sessões longas do Codex (execuções noturnas ou com raciocínio estendido de vários minutos) podem ser interrompidas por timeouts se as opções padrão forem mantidas. Para evitar isso:

1. **Desativar Timeouts de Streaming no Ambiente:**
   ```powershell
   [Environment]::SetEnvironmentVariable("STREAM_IDLE_TIMEOUT_MS", "0", "User")
   [Environment]::SetEnvironmentVariable("FETCH_BODY_TIMEOUT_MS", "0", "User")
   ```

2. **Afinidade de Sessão no OmniRoute (Dashboard):**
   * No painel do OmniRoute: **Settings → Routing → Session Affinity**.
   * Defina o **Affinity TTL** para `43200` segundos (12 horas).
   * Isso garante que todas as voltas de uma mesma sessão do Codex permaneçam na mesma conta upstream, preservando o cache de prompts.

3. **Wire API:**
   * O parâmetro `wire_api = "responses"` já vem pré-configurado no `config.toml`, garantindo compatibilidade com streams de raciocínio.

---

## 🔧 Script de Automação Rápida

Para reconfigurar ou restaurar o ambiente no Windows a qualquer momento:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-codex-omniroute.ps1
```
