# Verificacoes objetivas do instalador. EXECUTAR SOMENTE DENTRO DE UMA VM/SANDBOX WINDOWS LIMPA.
# Fases (rode uma por vez, na ordem do roteiro em TESTE-INSTALADOR-VM.md):
#   -Fase apos-instalar     : atalhos, entrada no registro, ausencia de processos, ausencia de Node/.NET
#   -Fase apos-abrir        : backend/janela, login, produto, venda, API protegida, escuta em loopback
#   -Fase apos-fechar       : nenhum processo restante, banco e chave no disco (grava hash da chave)
#   -Fase apos-reabrir      : dados persistidos e chave inalterada
#   -Fase apos-desinstalar  : atalhos removidos, dados preservados
param(
  [Parameter(Mandatory)][ValidateSet('apos-instalar', 'apos-abrir', 'apos-fechar', 'apos-reabrir', 'apos-desinstalar')][string]$Fase,
  [switch]$ConfirmoAmbienteIsolado
)
$ErrorActionPreference = 'Stop'
if (-not $ConfirmoAmbienteIsolado) { throw 'Recusado: use -ConfirmoAmbienteIsolado somente dentro de uma VM/Sandbox limpa.' }
if ((Test-Path "$env:APPDATA\PDV-ATYLUS") -or (Test-Path "$env:LOCALAPPDATA\Programs\pdv-app") -or (Test-Path "$env:LOCALAPPDATA\ATYLUS-PDV")) {
  throw 'Recusado: encontrei dados/instalacoes de outras versoes no perfil. Este NAO parece um ambiente limpo.'
}
$dados = Join-Path $env:APPDATA 'ATYLUS PDV Desktop'
$estado = Join-Path $env:TEMP 'atylus-vm-estado.txt'
$nome = 'ATYLUS PDV Desktop'
$linkMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$nome.lnk"
$linkDesk = Join-Path ([Environment]::GetFolderPath('Desktop')) "$nome.lnk"
$falhas = 0
function R([string]$t, [bool]$ok, [string]$d = '') { if (-not $ok) { $script:falhas++ }; '{0,-60} {1} {2}' -f $t, $(if ($ok) { 'OK ' } else { 'FALHOU' }), $d }
function Procs { @(Get-Process -ErrorAction SilentlyContinue | ? { $_.Name -in 'ATYLUS PDV', 'PDV.API' }).Count }
function UltimaUrl { $m = [regex]::Matches((Get-Content (Join-Path $dados 'logs\desktop.log') -Raw -Encoding UTF8), 'Backend pronto em (http://127\.0\.0\.1:\d+)'); $m[$m.Count - 1].Groups[1].Value }
function Login($url, $m, $p) { $r = Invoke-RestMethod "$url/api/v1/auth/login" -Method Post -ContentType 'application/json' -Body (@{ matricula = $m; pin = $p } | ConvertTo-Json); @{ Authorization = "Bearer $($r.token)" } }

switch ($Fase) {
  'apos-instalar' {
    R 'Atalho no Menu Iniciar' (Test-Path $linkMenu) $linkMenu
    R 'Atalho na Area de Trabalho' (Test-Path $linkDesk) $linkDesk
    $reg = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' | ? { $_.DisplayName -like 'ATYLUS PDV*' }
    R 'Entrada em Aplicativos e recursos' ($null -ne $reg) ($reg.InstallLocation)
    R 'Instalador NAO abriu o app sozinho' ((Procs) -eq 0) "processos=$(Procs)"
    R 'Pasta de dados ainda nao criada (app nao rodou)' (-not (Test-Path $dados)) ''
    R 'Node.js ausente' ($null -eq (Get-Command node -ErrorAction SilentlyContinue)) ''
    R '.NET SDK ausente' ($null -eq (Get-Command dotnet -ErrorAction SilentlyContinue)) ''
  }
  'apos-abrir' {
    R 'Servidor e janela em execucao' ((Procs) -ge 2) "processos=$(Procs)"
    $url = UltimaUrl; R 'Backend pronto (log)' ($url -ne '') $url
    $h = Login $url 'OP01' '0000'; R 'Login Operador' ($true)
    $hs = Login $url 'GER01' '1234'; R 'Login Supervisor' ($true)
    $semToken = try { (Invoke-WebRequest "$url/api/v1/produtos" -UseBasicParsing).StatusCode } catch { $_.Exception.Response.StatusCode.value__ }
    R 'API recusa requisicao sem token' ($semToken -eq 401) ''
    $escuta = Get-NetTCPConnection -State Listen -LocalPort ([uri]$url).Port -ErrorAction SilentlyContinue
    R 'Escuta somente em 127.0.0.1' (($escuta | ? { $_.LocalAddress -ne '127.0.0.1' }).Count -eq 0) ''
    $cod = '789' + (Get-Random -Minimum 1000000000 -Maximum 1999999999)
    $novo = Invoke-RestMethod "$url/api/v1/produtos" -Method Post -Headers $hs -ContentType 'application/json' -Body (@{ codigoBarras = $cod; nome = 'Produto Teste VM'; precoVenda = 7.5; precoCusto = 4; estoqueAtual = 20; estoqueMinimo = 2 } | ConvertTo-Json)
    $achou = @(Invoke-RestMethod "$url/api/v1/produtos" -Headers $h) | ? { $_.codigoBarras -eq $cod }
    R 'Cadastro e consulta de produto' ($null -ne $achou) $cod
    Invoke-RestMethod "$url/api/v1/caixa/abrir" -Method Post -Headers $h -ContentType 'application/json' -Body '{"operadorId":"OP01","saldoInicial":50}' | Out-Null
    $venda = @{ operadorId = 'OP01'; desconto = 0; itens = @(@{ produtoId = $achou.id; quantidade = 1; precoUnitario = [decimal]7.5 }); pagamentos = @(@{ formaPagamento = 'Dinheiro'; valor = [decimal]7.5 }) } | ConvertTo-Json -Depth 5
    $v = Invoke-RestMethod "$url/api/v1/vendas" -Method Post -Headers $h -ContentType 'application/json' -Body $venda
    R 'Venda de teste concluida' ($v.status -eq 'Concluida') $v.codigoIdentificador
    "$cod;$($v.id);$((Get-FileHash (Join-Path $dados 'jwt-signing.key')).Hash)" | Set-Content $estado
  }
  'apos-fechar' {
    R 'Nenhum ATYLUS PDV/PDV.API restante' ((Procs) -eq 0) "processos=$(Procs)"
    R 'Banco SQLite no disco' (Test-Path (Join-Path $dados 'pdv.db')) ''
    R 'Chave JWT no disco' (Test-Path (Join-Path $dados 'jwt-signing.key')) ''
  }
  'apos-reabrir' {
    $cod, $vid, $hash = (Get-Content $estado).Split(';')
    $url = UltimaUrl; $h = Login $url 'OP01' '0000'
    R 'Produto persistido' (@(Invoke-RestMethod "$url/api/v1/produtos" -Headers $h) | ? { $_.codigoBarras -eq $cod }) $cod
    R 'Venda persistida' (@(Invoke-RestMethod "$url/api/v1/vendas" -Headers $h) | ? { $_.id -eq $vid }) ''
    R 'Chave JWT inalterada' ((Get-FileHash (Join-Path $dados 'jwt-signing.key')).Hash -eq $hash) ''
  }
  'apos-desinstalar' {
    R 'Atalho do Menu Iniciar removido' (-not (Test-Path $linkMenu)) ''
    R 'Atalho da Area de Trabalho removido' (-not (Test-Path $linkDesk)) ''
    R 'Entrada em Aplicativos e recursos removida' ($null -eq (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' | ? { $_.DisplayName -like 'ATYLUS PDV*' })) ''
    R 'Banco preservado' (Test-Path (Join-Path $dados 'pdv.db')) ''
    R 'Chave JWT preservada' (Test-Path (Join-Path $dados 'jwt-signing.key')) ''
  }
}
"Falhas: $falhas"
exit $falhas
