'use strict';
// Verifica, via DevTools Protocol, que a interface carregada pelo Electron usa SOMENTE recursos locais
// (fontes, CSS, JS, imagens) e que as fontes Inter/JetBrains Mono carregaram dos arquivos do pacote.
// Uso: node scripts/verificar-interface.js <porta-cdp>   (script de desenvolvimento; não faz parte do app instalado)
const porta = process.argv[2];
if (!porta) { console.error('Informe a porta de depuracao.'); process.exit(2); }

async function main() {
  const abas = await (await fetch(`http://127.0.0.1:${porta}/json`)).json();
  const pagina = abas.find((a) => a.type === 'page');
  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const avaliar = (expressao) => new Promise((res) => {
    const n = ++id; pend.set(n, res);
    ws.send(JSON.stringify({ id: n, method: 'Runtime.evaluate', params: { expression: expressao, awaitPromise: true, returnByValue: true } }));
  }).then((r) => r.result.result.value);

  const origem = await avaliar('location.origin');
  const fontes = await avaliar(`(async () => {
    const pedidos = [['400','Inter'],['500','Inter'],['600','Inter'],['700','Inter'],['800','Inter'],['500','JetBrains Mono'],['700','JetBrains Mono']];
    await Promise.all(pedidos.map(([p, f]) => document.fonts.load(p + ' 14px "' + f + '"')));
    return [...document.fonts].map(f => ({ familia: f.family.replace(/"/g, ''), peso: f.weight, status: f.status }));
  })()`);
  const recursos = await avaliar('performance.getEntriesByType("resource").map(e => e.name)');
  const externos = recursos.filter((u) => !u.startsWith(origem));
  const imagens = await avaliar('[...document.images].map(i => i.currentSrc || i.src)');
  const linksExternos = await avaliar('[...document.querySelectorAll("link[href],script[src]")].map(e => e.href || e.src).filter(u => !u.startsWith(location.origin))');
  const fontesUsadas = await avaliar('getComputedStyle(document.body).fontFamily');
  const carregadas = fontes.filter((f) => f.status === 'loaded');
  const recursosDeFonte = recursos.filter((u) => /\.woff2(\?|$)/.test(u));

  const ok = {
    ['nenhum recurso de rede fora de ' + origem]: externos.length === 0,
    'nenhum link/script externo no HTML': linksExternos.length === 0,
    '7 fontes (Inter 400-800, JetBrains Mono 500/700) carregadas': carregadas.length === 7,
    'fontes servidas pelo proprio pacote (.woff2 locais)': recursosDeFonte.length >= 7 && recursosDeFonte.every((u) => u.startsWith(origem)),
    'imagens apenas locais/embutidas': imagens.every((u) => u.startsWith(origem) || u.startsWith('data:')),
  };
  let falhas = 0;
  for (const [nome, v] of Object.entries(ok)) { console.log(`${v ? 'OK     ' : 'FALHOU '} ${nome}`); if (!v) falhas++; }
  console.log(`(recursos=${recursos.length}, fontes carregadas=${carregadas.length}, font-family do body=${fontesUsadas.slice(0, 40)})`);
  if (externos.length) console.log('Externos:', externos);
  ws.close();
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error('Erro:', e.message); process.exit(2); });
