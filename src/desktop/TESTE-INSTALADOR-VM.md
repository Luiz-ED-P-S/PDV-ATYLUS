# Validação do instalador em ambiente Windows isolado

O instalador **não deve** ser testado no Windows principal: ele cria atalhos, entrada em "Aplicativos e recursos"
e pasta de dados no perfil do usuário. Use uma máquina virtual (ou Windows Sandbox) **limpa**, sem Node.js,
sem .NET e sem outras cópias do ATYLUS PDV.

## Opções de ambiente

| Opção | Requisitos | Observação |
|---|---|---|
| **Windows Sandbox** | Windows 10/11 Pro/Enterprise, virtualização ligada na BIOS, recurso opcional "Windows Sandbox" (precisa de administrador e reinicialização) | Descartável: tudo some ao fechar. Para testar fechar/reabrir/reinstalar, mantenha a Sandbox aberta. |
| **Hyper-V** | Windows Pro, SLAT/virtualização ligada | Crie uma VM Windows 10/11 e tire um *checkpoint* "limpo". |
| **VirtualBox / VMware Player** | Virtualização ligada na BIOS | Instale um Windows 10/11 (ISO oficial/avaliação), sem Node/.NET; tire um *snapshot* "limpo". |
| **Outro PC** | Qualquer Windows 10/11 x64 limpo | Também vale. |

Pasta compartilhada: copie para a VM apenas `ATYLUS-PDV-Setup-1.0.0.exe` e `scripts\testar-instalador-na-vm.ps1`.
Confira o SHA-256 do instalador dentro da VM (`Get-FileHash`).

## Roteiro (dentro da VM)

1. **Instalar** o `.exe` (instalação assistida; não deve abrir o app sozinho ao terminar).
2. **Atalhos**: "ATYLUS PDV Desktop" na Área de Trabalho e no Menu Iniciar.
3. **Abrir pelo Menu Iniciar**: janela própria "ATYLUS PDV"; se o servidor falhar, aparece a tela de erro.
4. **Backend automático**: `PDV.API.exe` aparece no Gerenciador de Tarefas; `%APPDATA%\ATYLUS PDV Desktop\logs\backend.log` existe.
5. **Primeiro acesso**: entre com OP01/0000 (Operador): aparece a tela "Defina um novo PIN" e nada mais funciona até trocar
   (4 a 8 dígitos, sem sequências/repetições, diferente de 0000/1234). Troque para, por exemplo, `7391`.
   Repita com GER01/1234 (Supervisor) → `5802`. Depois confira o login com os PINs novos e que 0000/1234 não entram mais.
6. **Produtos**: cadastrar e consultar um produto.
7. **Venda de teste**: abrir caixa e registrar uma venda em dinheiro (Pix exige Supervisor com PIN já trocado, sem QR Code).
8. **Persistência**: fechar o app, reabrir; produto, venda e login continuam.
9. **Sem internet**: desconectar a rede da VM e repetir 3–8.
10. **Encerramento**: fechar a janela; nenhum `ATYLUS PDV.exe`/`PDV.API.exe` restante.
11. **Desinstalar** pelo desinstalador: atalhos e pasta de instalação somem; `%APPDATA%\ATYLUS PDV Desktop` permanece.
12. **Reinstalar**: banco, vendas e chave JWT preservados (mesmo `jwt-signing.key`).
13. **Sem Node/.NET**: `node -v` e `dotnet --version` devem falhar na VM — e o app funciona mesmo assim.

O script `scripts\testar-instalador-na-vm.ps1` automatiza as verificações objetivas (atalhos, processos, API, persistência,
hash da chave). Ele se recusa a rodar fora de um ambiente limpo (exige `-ConfirmoAmbienteIsolado` e recusa se encontrar
`PDV-ATYLUS` ou `PDV Open` no perfil).

## Por que não foi executado na máquina de desenvolvimento

Ver o relatório da etapa: sem VirtualBox/VMware/Sandbox instalados, virtualização desligada no firmware e sem
permissão de administrador para habilitar recursos.
