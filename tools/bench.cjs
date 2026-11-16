/**
 * Benchmark de rendu : lance la scène de stress (?bench) dans Chromium et vérifie le budget.
 *   pnpm bench                 (serveur sur http://localhost:3000)
 *   pnpm bench -- --gpu        (utilise le GPU de la machine au lieu du rendu logiciel)
 *   BENCH_URL=https://defend.sayk.fr pnpm bench
 */
const { chromium } = require('playwright');

const URL = (process.env.BENCH_URL || 'http://localhost:3000') + '/?bench';
const gpu = process.argv.includes('--gpu');
const MAX_CALLS = 200;

(async () => {
  const args = gpu ? ['--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const browser = await chromium.launch({ headless: !gpu, args });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForTimeout(35000);
  // mesure des temps de frame sur 10 s
  const res = await page.evaluate(async () => {
    const times = [];
    let last = performance.now();
    await new Promise((done) => {
      const end = last + 10000;
      const f = (t) => { times.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else done(); };
      requestAnimationFrame(f);
    });
    times.sort((a, b) => a - b);
    const d = window.__dfend.ui.debug;
    return { frames: times.length, avg: times.reduce((a, b) => a + b, 0) / times.length, p99: times[Math.floor(times.length * 0.99)], calls: d.calls, tris: d.tris, ents: d.ents };
  });
  await page.screenshot({ path: 'tools/out-bench.png' });
  await browser.close();
  console.log(`Entités : ${res.ents} · draw calls : ${res.calls} · triangles : ${Math.round(res.tris / 1000)}k`);
  console.log(`Frame moyenne : ${res.avg.toFixed(1)} ms (${(1000 / res.avg).toFixed(0)} FPS) · p99 : ${res.p99.toFixed(1)} ms`);
  if (!gpu) console.log('(rendu logiciel : les FPS ne sont pas représentatifs, seul le nombre de draw calls compte)');
  let ok = res.calls < MAX_CALLS && errors.length === 0;
  if (gpu && res.p99 > 20) ok = false;
  if (errors.length) console.log('Erreurs :', errors.join('\n'));
  console.log(ok ? 'BUDGET RESPECTÉ' : 'BUDGET DÉPASSÉ');
  process.exit(ok ? 0 : 1);
})();
