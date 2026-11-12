'use strict';
const fs = require('fs');
const path = require('path');

/** Log em arquivo (sem PINs, tokens ou chaves). Rotação simples: 1 MB. */
function criarLogger(pastaLogs, nome) {
  fs.mkdirSync(pastaLogs, { recursive: true });
  const arquivo = path.join(pastaLogs, nome);
  try {
    if (fs.existsSync(arquivo) && fs.statSync(arquivo).size > 1024 * 1024) {
      fs.renameSync(arquivo, arquivo + '.antigo');
    }
  } catch { /* melhor esforço */ }
  const escrever = (nivel, msg) => {
    try { fs.appendFileSync(arquivo, `${new Date().toISOString()} [${nivel}] ${msg}\n`); } catch { /* ignora */ }
  };
  return { arquivo, info: (m) => escrever('INFO', m), erro: (m) => escrever('ERRO', m), bruto: (m) => escrever('API', m) };
}

module.exports = { criarLogger };
