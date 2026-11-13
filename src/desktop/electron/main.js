'use strict';
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const { spawn, execFile } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');
const fs = require('fs');
const { criarLogger } = require('./logger');

const NOME_PASTA_DADOS = 'ATYLUS PDV Desktop';
// ATYLUS_DATA_DIR existe para testes em pasta isolada. Nunca aponta para %APPDATA%\PDV-ATYLUS.
const pastaDados = process.env.ATYLUS_DATA_DIR || path.join(app.getPath('appData'), NOME_PASTA_DADOS);
const pastaLogs = path.join(pastaDados, 'logs');
app.setPath('userData', path.join(pastaDados, 'electron'));
if (process.env.ATYLUS_REMOTE_DEBUG) app.commandLine.appendSwitch('remote-debugging-port', process.env.ATYLUS_REMOTE_DEBUG);

fs.mkdirSync(pastaLogs, { recursive: true });
const log = criarLogger(pastaLogs, 'desktop.log');
const logApi = criarLogger(pastaLogs, 'backend.log');

const TEMPO_MAX_INICIO_MS = 120000;
let janela = null;
let backend = null;
let origem = null;
let encerrando = false;
let ultimasLinhas = [];

function caminhoBackend() {
  const base = app.isPackaged ? path.join(process.resourcesPath, 'backend') : path.join(__dirname, '..', 'resources', 'backend');
  return { pasta: base, exe: path.join(base, 'PDV.API.exe') };
}

function portaLivre() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  });
}

function consultar(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 1500 }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on('error', () => resolve(0));
    req.on('timeout', () => { req.destroy(); resolve(0); });
  });
}

class FalhaInicio extends Error {
  constructor(titulo, mensagem, acao, detalhe) { super(mensagem); this.titulo = titulo; this.acao = acao; this.detalhe = detalhe; }
}

function resumirDetalhe(linhas) {
  const chaves = linhas.filter((l) => /exception|erro|error|falha|fail|crit/i.test(l) && !/^\s+at /.test(l));
  return (chaves.length ? chaves : linhas).slice(-6).join('\n');
}

function interpretarSaida(linhas) {
  const texto = linhas.join('\n');
  const detalhe = resumirDetalhe(linhas);
  if (/ATUALIZAÇÃO DO BANCO NECESSÁRIA/i.test(texto)) {
    return new FalhaInicio('Banco de dados precisa de atualização autorizada',
      'O banco de dados encontrado foi criado por uma versão anterior e não é alterado automaticamente.',
      'Peça ao administrador para executar a atualização com o comando --atualizar-banco (com backup). Nenhum dado foi modificado.', detalhe);
  }
  if (/MigracaoBancoException|file is not a database|Falha na preparação do banco/i.test(texto)) {
    return new FalhaInicio('Banco de dados inválido ou corrompido',
      'O arquivo do banco de dados não pôde ser aberto ou está em formato desconhecido. Nada foi alterado.',
      `Restaure um backup ou contate o suporte. Pasta de dados: ${pastaDados}`, detalhe);
  }
  if (/Falha ao carregar a chave de autentica|ChaveJwtException/i.test(texto)) {
    return new FalhaInicio('Falha na chave de autenticação',
      'Não foi possível carregar ou gravar a chave de segurança local.',
      `Verifique as permissões da pasta de dados: ${pastaDados}`, detalhe);
  }
  if (/address already in use|Failed to bind|já está em uso/i.test(texto)) {
    return new FalhaInicio('Porta em uso', 'A porta local do ATYLUS PDV está ocupada por outro programa.',
      'Feche o outro programa ou reinicie o computador e tente novamente.', detalhe);
  }
  return new FalhaInicio('O serviço do ATYLUS PDV não iniciou',
    'O processo do servidor local encerrou antes de ficar pronto.', 'Clique em "Abrir pasta de logs" e envie o arquivo backend.log ao suporte.', detalhe);
}

function iniciarBackend(porta) {
  const { pasta, exe } = caminhoBackend();
  if (!fs.existsSync(exe)) {
    throw new FalhaInicio('Instalação incompleta', `Arquivo do servidor não encontrado: ${exe}`, 'Reinstale o ATYLUS PDV.', '');
  }
  const env = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: 'Production',          // sem Swagger e sem Pix simulado
    ASPNETCORE_URLS: `http://127.0.0.1:${porta}`,  // somente loopback
    PDV_DESKTOP_MODE: '1',
    PDV_DATA_DIR: pastaDados,                      // banco SQLite
    PDV_JWT_KEY_DIR: pastaDados,                   // chave JWT (fora da pasta de instalação)
    PDV_WWWROOT: path.join(pasta, 'wwwroot'),
    DOTNET_NOLOGO: '1',
    DOTNET_CLI_TELEMETRY_OPTOUT: '1',
  };
  delete env.PDV_JWT_KEY;                          // nunca herdar chave do ambiente do usuário
  delete env.ASPNETCORE_ENVIRONMENT_OVERRIDE;
  log.info(`Iniciando backend: ${exe} porta=${porta} dados=${pastaDados}`);
  backend = spawn(exe, [], { cwd: pasta, env, windowsHide: true });
  const aoLinha = (buf) => {
    for (const l of buf.toString('utf8').split(/\r?\n/).filter(Boolean)) {
      logApi.bruto(l);
      ultimasLinhas.push(l);
      if (ultimasLinhas.length > 40) ultimasLinhas.shift();
    }
  };
  backend.stdout.on('data', aoLinha);
  backend.stderr.on('data', aoLinha);
  backend.on('error', (e) => { ultimasLinhas.push(`Erro ao executar: ${e.message}`); });
}

async function aguardarProntidao(porta) {
  const inicio = Date.now();
  const url = `http://127.0.0.1:${porta}/health`;
  let saiu = false;
  backend.once('exit', () => { saiu = true; });
  while (Date.now() - inicio < TEMPO_MAX_INICIO_MS) {
    if (saiu) throw interpretarSaida(ultimasLinhas);
    if (await consultar(url) === 200) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new FalhaInicio('Tempo esgotado', 'O servidor local não respondeu em 2 minutos.',
    'Tente novamente. Se persistir, abra a pasta de logs.', ultimasLinhas.join('\n'));
}

function matarBackend() {
  return new Promise((resolve) => {
    if (!backend || backend.exitCode !== null) return resolve();
    const pid = backend.pid;
    setTimeout(resolve, 5000);                       // nunca trava o encerramento do aplicativo
    backend.once('exit', () => resolve());
    // Encerra somente o processo iniciado por este aplicativo (e seus filhos)
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => setTimeout(resolve, 1500));
  });
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1024, minHeight: 680,
    title: 'ATYLUS PDV', show: false, backgroundColor: '#0f172a',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !app.isPackaged,
    },
  });
  janela.once('ready-to-show', () => janela.show());
  janela.on('close', () => log.info('Janela: evento close'));
  janela.webContents.on('render-process-gone', (_e, d) => log.erro(`Renderer encerrou: ${d.reason} (${d.exitCode})`));
  janela.webContents.on('did-fail-load', (_e, code, desc, url) => log.erro(`Falha ao carregar ${url}: ${desc} (${code})`));
  janela.webContents.on('console-message', (_e, nivel, msg) => { if (nivel >= 2) log.erro(`Console: ${msg}`); });
  janela.on('closed', () => { log.info('Janela fechada'); janela = null; });
  // Só navega dentro do próprio servidor local; links externos não abrem dentro do app
  janela.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  janela.webContents.on('will-navigate', (e, url) => {
    if (!(origem && url.startsWith(origem)) && !url.startsWith('file:')) e.preventDefault();
  });
  janela.webContents.on('page-title-updated', (e) => e.preventDefault());
}

function mostrarErro(f) {
  log.erro(`${f.titulo}: ${f.message} | ${f.detalhe || ''}`);
  if (!janela) criarJanela();
  const q = new URLSearchParams({ titulo: f.titulo, mensagem: f.message, acao: f.acao || '', detalhe: (f.detalhe || '').slice(-1500) });
  janela.loadFile(path.join(__dirname, 'erro.html'), { search: q.toString() });
  if (!janela.isVisible()) janela.show();
}

async function iniciar() {
  ultimasLinhas = [];
  try {
    const porta = process.env.ATYLUS_PORT ? Number(process.env.ATYLUS_PORT) : await portaLivre();
    iniciarBackend(porta);
    await aguardarProntidao(porta);
    origem = `http://127.0.0.1:${porta}`;
    log.info(`Backend pronto em ${origem}`);
    fs.writeFileSync(path.join(pastaLogs, 'ultima-porta.txt'), String(porta));
    if (!janela) criarJanela();
    await janela.loadURL(origem);
  } catch (e) {
    await matarBackend();
    mostrarErro(e instanceof FalhaInicio ? e : new FalhaInicio('Erro inesperado', String((e && e.message) || e), '', String((e && e.stack) || '')));
  }
}

ipcMain.handle('atylus:abrir-logs', () => shell.openPath(pastaLogs));
ipcMain.handle('atylus:tentar-novamente', async () => { await matarBackend(); backend = null; await iniciar(); });
ipcMain.handle('atylus:sair', () => app.quit());

// Instância única: evita dois backends e duas conexões ao mesmo SQLite
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (janela) { if (janela.isMinimized()) janela.restore(); janela.focus(); } });
  app.whenReady().then(() => { Menu.setApplicationMenu(null); criarJanela(); return iniciar(); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', (e) => {
    if (encerrando) return;
    encerrando = true;
    e.preventDefault();
    log.info('Encerrando aplicativo');
    matarBackend().finally(() => app.exit(0));
  });
}
