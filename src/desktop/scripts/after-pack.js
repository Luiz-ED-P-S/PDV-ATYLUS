'use strict';
// Sem assinatura de código (demonstração): o electron-builder não edita o .exe, então embutimos
// ícone e informações de versão com o rcedit que ele já baixou para o cache (não requer privilégios).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function acharRcedit() {
  const cache = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'winCodeSign');
  if (!fs.existsSync(cache)) return null;
  for (const d of fs.readdirSync(cache)) {
    const p = path.join(cache, d, 'rcedit-x64.exe');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

exports.default = async function (ctx) {
  const exe = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.exe`);
  const rcedit = acharRcedit();
  if (!rcedit) { console.warn('[after-pack] rcedit não encontrado: o ícone do .exe não foi embutido.'); return; }
  const v = ctx.packager.appInfo.version;
  execFileSync(rcedit, [exe, '--set-icon', path.join(__dirname, '..', 'assets', 'icon.ico'),
    '--set-file-version', v, '--set-product-version', v,
    '--set-version-string', 'ProductName', 'ATYLUS PDV',
    '--set-version-string', 'FileDescription', 'ATYLUS PDV',
    '--set-version-string', 'CompanyName', 'ATYLUS']);
  console.log('[after-pack] ícone e versão embutidos em', exe);
};
