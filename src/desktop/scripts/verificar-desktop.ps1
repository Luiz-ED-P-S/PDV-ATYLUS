# Testes de integracao do app desktop DESCOMPACTADO (electron . + backend publicado), uma instancia por vez,
# SEMPRE em pastas de dados temporarias. Nao instala nada, nao toca em %APPDATA%\PDV-ATYLUS nem em instalacoes existentes.
# Uso: powershell -File scripts/verificar-desktop.ps1 [-Cenario banco|porta|instancia|tudo]
param([string]$Cenario = 'tudo')
$ErrorActionPreference = 'Stop'
$desktop = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$electron = Join-Path $desktop 'node_modules\electron\dist\electron.exe'
$raizTeste = Join-Path $env:TEMP ("atylus-verificacao-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory $raizTeste | Out-Null
$resultados = New-Object System.Collections.Generic.List[string]
$falhas = 0

function Registrar([string]$nome, [bool]$ok, [string]$detalhe = '') {
  $script:resultados.Add(("{0,-62} {1} {2}" -f $nome, $(if ($ok) { 'OK ' } else { 'FALHOU' }), $detalhe))
  if (-not $ok) { $script:falhas++ }
}

function Arvore([int]$raiz) {
  $todos = Get-CimInstance Win32_Process
  $ids = New-Object System.Collections.Generic.HashSet[int]; [void]$ids.Add($raiz)
  do { $antes = $ids.Count; foreach ($p in $todos) { if ($ids.Contains([int]$p.ParentProcessId)) { [void]$ids.Add([int]$p.ProcessId) } } } while ($ids.Count -ne $antes)
  return $ids
}
function Encerrar-Arvore([int]$raiz) {
  foreach ($id in (Arvore $raiz)) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 800
}
function Iniciar([string]$dados, [hashtable]$extra = @{}) {
  $env:ATYLUS_DATA_DIR = $dados
  foreach ($k in 'ATYLUS_PORT', 'ATYLUS_REMOTE_DEBUG') { Remove-Item "Env:$k" -ErrorAction SilentlyContinue }
  foreach ($k in $extra.Keys) { Set-Item "Env:$k" $extra[$k] }
  return Start-Process $electron -ArgumentList '.' -WorkingDirectory $desktop -PassThru
}
function Esperar([scriptblock]$condicao, [int]$segundos) {
  for ($i = 0; $i -lt $segundos * 2; $i++) { if (& $condicao) { return $true }; Start-Sleep -Milliseconds 500 }
  return $false
}
function LogTem([string]$dados, [string]$padrao) {
  $f = Join-Path $dados 'logs\desktop.log'
  return (Test-Path $f) -and ((Get-Content $f -Raw -Encoding UTF8) -match $padrao)
}
function UltimaUrl([string]$dados) {
  $f = Join-Path $dados 'logs\desktop.log'
  $m = [regex]::Matches((Get-Content $f -Raw -Encoding UTF8), 'Backend pronto em (http://127\.0\.0\.1:\d+)')
  return $m[$m.Count - 1].Groups[1].Value
}
function Login([string]$url, [string]$mat, [string]$pin) {
  $r = Invoke-RestMethod "$url/api/v1/auth/login" -Method Post -ContentType 'application/json' -Body (@{ matricula = $mat; pin = $pin } | ConvertTo-Json)
  return @{ Authorization = "Bearer $($r.token)" }
}
function Titulo-Cdp([int]$porta) { try { return (Invoke-RestMethod "http://127.0.0.1:$porta/json")[0] } catch { return $null } }

try {
  # ---------------- 1. Banco invalido ----------------
  if ($Cenario -in 'tudo', 'banco') {
    $d = Join-Path $raizTeste 'banco-invalido'; New-Item -ItemType Directory $d | Out-Null
    [IO.File]::WriteAllText("$d\pdv.db", 'isto nao e um banco sqlite valido')
    $hashAntes = (Get-FileHash "$d\pdv.db").Hash
    $p = Iniciar $d @{ ATYLUS_REMOTE_DEBUG = '9351' }
    $ok = Esperar { LogTem $d '\[ERRO\]' } 90
    $janela = Titulo-Cdp 9351
    $url = if ($janela) { [uri]::UnescapeDataString(($janela.url -replace "[+]", " ")) } else { '' }
    Registrar '1. Banco invalido: tela de erro exibida' ($ok -and $url -match 'erro\.html') ($janela.title)
    Registrar '1. Banco invalido: mensagem correta (nao cita chave JWT)' ($url -match 'Banco de dados inv' -and $url -notmatch 'chave de autentica') ''
    Registrar '1. Banco invalido: arquivo NAO foi alterado' ((Test-Path "$d\pdv.db") -and ((Get-FileHash "$d\pdv.db").Hash -eq $hashAntes)) ''
    Encerrar-Arvore $p.Id
    Registrar '1. Banco invalido: nenhum processo restante' (-not (Get-Process -Id $p.Id -ErrorAction SilentlyContinue)) ''
  }

  # ---------------- 2. Porta ocupada ----------------
  if ($Cenario -in 'tudo', 'porta') {
    $d = Join-Path $raizTeste 'porta-ocupada'; New-Item -ItemType Directory $d | Out-Null
    $ocupante = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Parse('127.0.0.1'), 0); $ocupante.Start()
    $porta = $ocupante.LocalEndpoint.Port
    $p = Iniciar $d @{ ATYLUS_PORT = "$porta"; ATYLUS_REMOTE_DEBUG = '9352' }
    $ok = Esperar { LogTem $d '\[ERRO\]' } 90
    $janela = Titulo-Cdp 9352
    $url = if ($janela) { [uri]::UnescapeDataString(($janela.url -replace "[+]", " ")) } else { '' }
    Registrar '2. Porta ocupada: tela de erro exibida' ($ok -and $url -match 'erro\.html') ''
    Registrar '2. Porta ocupada: mensagem "Porta em uso"' ($url -match 'Porta em uso') ''
    $ocupante.Stop()
    Encerrar-Arvore $p.Id
    Registrar '2. Porta ocupada: nenhum servidor restante' (-not (Get-CimInstance Win32_Process | ? { $_.ExecutablePath -like "$desktop\resources\backend\PDV.API.exe" })) ''
  }

  # ---------------- 3/4/5. Instancia unica, persistencia, encerramento ----------------
  if ($Cenario -in 'tudo', 'instancia') {
    $d = Join-Path $raizTeste 'dados-normais'; New-Item -ItemType Directory $d | Out-Null
    $p = Iniciar $d @{ ATYLUS_REMOTE_DEBUG = '9353' }
    $ok = Esperar { LogTem $d 'Backend pronto' } 120
    Registrar '3. Inicializacao normal: backend pronto' $ok ''
    $url = UltimaUrl $d
    Registrar '3. Janela carrega a interface React' ((Titulo-Cdp 9353).url -like "$url*") ((Titulo-Cdp 9353).title)
    $h = Login $url 'OP01' '0000'
    $caixa = Invoke-RestMethod "$url/api/v1/caixa/abrir" -Method Post -Headers $h -ContentType 'application/json' -Body '{"operadorId":"OP01","saldoInicial":80}'
    $prod = (Invoke-RestMethod "$url/api/v1/produtos" -Headers $h)[0]
    $venda = @{ operadorId = 'OP01'; desconto = 0; itens = @(@{ produtoId = $prod.id; quantidade = 1; precoUnitario = [decimal]$prod.precoVenda }); pagamentos = @(@{ formaPagamento = 'Dinheiro'; valor = [decimal]$prod.precoVenda }) } | ConvertTo-Json -Depth 5
    $v = Invoke-RestMethod "$url/api/v1/vendas" -Method Post -Headers $h -ContentType 'application/json' -Body $venda
    Registrar '3. Login, caixa e venda de demonstracao' ($v.status -eq 'Concluida') "venda $($v.codigoIdentificador)"
    $semToken = try { (Invoke-WebRequest "$url/api/v1/produtos" -UseBasicParsing).StatusCode } catch { $_.Exception.Response.StatusCode.value__ }
    Registrar '3. API recusa requisicao sem token (401)' ($semToken -eq 401) ''
    $escuta = Get-NetTCPConnection -State Listen -LocalPort ([uri]$url).Port -ErrorAction SilentlyContinue
    Registrar '3. Servidor escuta somente em 127.0.0.1' (($escuta | ? { $_.LocalAddress -notin '127.0.0.1' }).Count -eq 0) ''
    $chaveAntes = (Get-FileHash "$d\jwt-signing.key").Hash
    $memoria = [math]::Round(((Arvore $p.Id) | % { (Get-Process -Id $_ -ErrorAction SilentlyContinue).WorkingSet64 } | Measure-Object -Sum).Sum / 1MB)

    # segunda instancia (mesmos dados): deve ser recusada
    $apis = { @(Get-CimInstance Win32_Process | ? { $_.ExecutablePath -like "$desktop\resources\backend\PDV.API.exe" }).Count }
    $p2 = Iniciar $d
    $saiu = Esperar { $p2.HasExited } 30
    Registrar '4. Segunda instancia e encerrada (instancia unica)' $saiu ''
    Registrar '4. Continua existindo exatamente 1 servidor' ((& $apis) -eq 1) "servidores=$(& $apis)"
    Registrar '4. Instancia original continua respondendo' ((Invoke-RestMethod "$url/health").status -eq 'healthy') ''

    # encerramento correto
    $api = Get-CimInstance Win32_Process | ? { $_.ExecutablePath -like "$desktop\resources\backend\PDV.API.exe" } | select -First 1
    $janelaProc = Get-Process electron | ? { $_.MainWindowHandle -ne 0 -and (Arvore $p.Id).Contains($_.Id) } | select -First 1
    [void]$janelaProc.CloseMainWindow()
    $fechou = Esperar { -not (Get-Process -Id $p.Id -ErrorAction SilentlyContinue) -and (& $apis) -eq 0 } 20
    Registrar '5. Fechar a janela encerra Electron e servidor' $fechou ''
    Registrar '5. Banco e chave continuam no disco' ((Test-Path "$d\pdv.db") -and (Test-Path "$d\jwt-signing.key")) ''

    # reabertura
    $p3 = Iniciar $d @{ ATYLUS_REMOTE_DEBUG = '9354' }
    $log = Join-Path $d 'logs\desktop.log'
    $ok = Esperar { ([regex]::Matches((Get-Content $log -Raw -Encoding UTF8), 'Backend pronto')).Count -ge 2 } 120
    Registrar '5. Reabertura: backend pronto' $ok ''
    $url2 = UltimaUrl $d
    $h2 = Login $url2 'OP01' '0000'
    $vendas = @(Invoke-RestMethod "$url2/api/v1/vendas" -Headers $h2)
    Registrar '5. Reabertura: venda anterior persistida' (($vendas | ? { $_.id -eq $v.id }).Count -eq 1) ''
    Registrar '5. Reabertura: chave JWT inalterada' ((Get-FileHash "$d\jwt-signing.key").Hash -eq $chaveAntes) ''
    $semAntigoToken = try { Invoke-WebRequest "$url2/api/v1/produtos" -Headers $h -UseBasicParsing | Out-Null; 200 } catch { $_.Exception.Response.StatusCode.value__ }
    Registrar '5. Reabertura: token da sessao anterior continua valido (mesma chave)' ($semAntigoToken -eq 200) ''
    $janelaProc = Get-Process electron | ? { $_.MainWindowHandle -ne 0 -and (Arvore $p3.Id).Contains($_.Id) } | select -First 1
    [void]$janelaProc.CloseMainWindow()
    $fechou = Esperar { -not (Get-Process -Id $p3.Id -ErrorAction SilentlyContinue) -and (& $apis) -eq 0 } 20
    Registrar '5. Segundo encerramento limpo' $fechou ''
    $resultados.Add("   (memoria total aproximada em uso: $memoria MB)")
  }
}
finally {
  # nunca deixar processos de teste para tras (somente os iniciados a partir desta pasta)
  Get-CimInstance Win32_Process | ? { $_.ExecutablePath -like "$desktop\node_modules\electron\dist\electron.exe" -or $_.ExecutablePath -like "$desktop\resources\backend\PDV.API.exe" } |
    % { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Remove-Item Env:ATYLUS_DATA_DIR, Env:ATYLUS_PORT, Env:ATYLUS_REMOTE_DEBUG -ErrorAction SilentlyContinue
}
$resultados | ForEach-Object { $_ }
"Falhas: $falhas  (dados de teste em $raizTeste)"
exit $falhas
