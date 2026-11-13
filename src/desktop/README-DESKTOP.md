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
Desinstalar **não** apaga essa pasta: o desinstalador só remove a pasta de instalação e, apenas com
`--delete-app-data`, as pastas `%APPDATA%\ATYLUS PDV`/`atylus-pdv-desktop` — nunca `ATYLUS PDV Desktop`.
Reinstalar/atualizar sobre uma instalação existente substitui só os arquivos do programa; banco e chave permanecem. O app **não** lê nem altera `%APPDATA%\PDV-ATYLUS`.
Bancos existentes continuam exigindo `--atualizar-banco` (autorização explícita); o app só exibe o aviso.

## Primeiro acesso e PINs

A instalação nova cria dois operadores de demonstração: **OP01/0000** (Operador) e **GER01/1234** (Supervisor).
Esses PINs são *temporários*: o login funciona, mas a API só aceita a troca do PIN (`POST auth/alterar-pin`) e `GET auth/me`
até o PIN ser trocado (tudo mais responde 403 `PIN_TEMPORARIO`); o app mostra a tela "Defina um novo PIN".
O novo PIN tem 4 a 8 dígitos, exige confirmação, não pode ser o PIN de fábrica nem sequencial/repetido (1111, 4321, 1212).
Um Supervisor com PIN de fábrica também não consegue autorizar cancelamentos nem confirmar Pix. A marca vem de uma claim
assinada no token, não do navegador; a troca fica gravada (hash BCrypt) no SQLite e vale após fechar e reabrir.

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
- Os atalhos se chamam "ATYLUS PDV Desktop" (nome distinto, não substituem atalhos "ATYLUS PDV" de outras
  instalações). O instalador NÃO abre o app ao terminar (nem em instalação silenciosa `/S`).
- A primeira abertura pode levar de 10 a 50 s (antivírus + criação do banco); depois, cerca de 10 s.
- Sem atualização automática do aplicativo.
- Instalador ~115 MB, instalado ~380 MB (inclui o runtime .NET e o Chromium).
