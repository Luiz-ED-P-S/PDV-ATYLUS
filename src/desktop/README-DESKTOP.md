# ATYLUS PDV — versão desktop (Electron + React + ASP.NET Core + SQLite)

## Estrutura

```
src/desktop/
  electron/main.js      Janela, instância única, porta livre, inicia/encerra o backend, tela de erro
  electron/preload.js   Ponte mínima (somente a tela de erro)
  electron/erro.html    Tela de erro clara (banco inválido, porta em uso, chave, tempo esgotado)
  electron/logger.js    Log em arquivo, sem PINs/tokens
  scripts/              publicar-backend.ps1, gerar-icone-provisorio.ps1, after-pack.js, verificar-desktop.ps1
  assets/icon.ico|png   Ícone PROVISÓRIO (substituir pelo oficial mantendo os nomes)
  electron-builder.yml  Instalador NSIS x64 (atalhos Desktop + Menu Iniciar)
  resources/backend/    (gerado, fora do Git) backend self-contained + frontend (wwwroot)
  dist/                 (gerado, fora do Git) instalador .exe
```

O backend roda como processo filho em `http://127.0.0.1:<porta livre>` (somente loopback), em ambiente
`Production` (sem Swagger; Pix **sem** simulação, com confirmação manual por Supervisor). A API continua exigindo JWT.

## Dados (fora da pasta de instalação)

`%APPDATA%\ATYLUS PDV Desktop\` — `pdv.db` (SQLite), `jwt-signing.key`, `logs\` (`desktop.log`, `backend.log`).
Desinstalar **não** apaga essa pasta. O app **não** lê nem altera `%APPDATA%\PDV-ATYLUS`.
Bancos existentes continuam exigindo `--atualizar-banco` (autorização explícita); o app só exibe o aviso.

## Gerar o instalador

```bash
cd src/desktop
npm install
npm run dist            # build do React + publica backend win-x64 self-contained + gera o .exe
# resultado: src/desktop/dist/ATYLUS-PDV-Setup-1.0.0.exe
```

Etapas isoladas: `npm run build:frontend`, `npm run publish:backend`, `npm run dist:somente-empacotar`.

## Testar sem instalar

```bash
powershell -File scripts/verificar-desktop.ps1            # banco inválido, porta ocupada, instância única, persistência, encerramento
npm start                                                  # abre o app descompactado (usa a pasta de dados padrão)
```

Variáveis de teste: `ATYLUS_DATA_DIR` (pasta de dados isolada), `ATYLUS_PORT`, `ATYLUS_REMOTE_DEBUG`.

## Trocar o ícone

Substitua `assets/icon.ico` (multi-tamanho até 256x256) e `assets/icon.png` (512x512) e gere o instalador de novo.

## Limitações conhecidas

- Instalador **sem assinatura de código**: o SmartScreen do Windows avisa na instalação.
- Os atalhos se chamam "ATYLUS PDV" e substituem atalhos de mesmo nome. A instalação abre o app ao terminar
  (inclusive na instalação silenciosa `/S`).
- A primeira abertura pode levar de 10 a 50 s (antivírus + criação do banco); depois, cerca de 10 s.
- Sem atualização automática do aplicativo.
- Instalador ~115 MB, instalado ~380 MB (inclui o runtime .NET e o Chromium).
