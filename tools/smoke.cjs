/**
 * Test de fumée multijoueur : créer un salon, le rejoindre à 2, construire, finir une vague.
 *   pnpm smoke   (serveur sur http://localhost:3000, ou SMOKE_URL=...)
 */
const { chromium } = require('playwright');
const URL = process.env.SMOKE_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const fail = async (msg) => { console.error('ÉCHEC :', msg); await browser.close(); process.exit(1); };
  const join = async (name) => {
    const page = await (await browser.newContext({ viewport: { width: 1000, height: 640 } })).newPage();
    page.on('pageerror', (e) => errors.push(name + ': ' + e.message));
    await page.goto(URL);
    await page.waitForTimeout(1200);
    await page.fill('input[type=text]', name);
    await page.click('text=Multijoueur');
    await page.waitForFunction(() => window.__dfend.ui.netStatus === 'open', null, { timeout: 10000 });
    return page;
  };
  const a = await join('Alice');
  const b = await join('Bob');
  await a.click('text=Créer un salon');
  await a.waitForFunction(() => !!window.__dfend.ui.room, null, { timeout: 5000 });
  const code = await a.evaluate(() => window.__dfend.ui.room.code);
  await b.fill('input.code', code);
  await b.click('text=Rejoindre');
  await b.waitForFunction(() => window.__dfend.ui.room?.players.length === 2, null, { timeout: 5000 }).catch(() => fail('Bob ne rejoint pas'));
  await b.click('text=Je suis prêt');
  await a.waitForFunction(() => window.__dfend.ui.room.players.every((p) => p.ready || p.host), null, { timeout: 5000 });
  await a.click('text=Lancer la partie');
  for (const p of [a, b]) await p.waitForFunction(() => !!window.__dfend.app.game?.interp.latest, null, { timeout: 10000 }).catch(() => fail('la partie ne démarre pas'));
  for (const p of [a, b]) await p.keyboard.press('Escape');
  for (const p of [a, b]) {
    await p.evaluate(() => {
      const { app, ui } = window.__dfend;
      const g = app.game;
      const free = g.map.slots.map((s, i) => ({ s, i })).filter((o) => !o.s.locked);
      const o = free[ui.game.you * 2];
      g.send({ k: 'build', slot: o.i, fam: 0 });
      g.send({ k: 'build', slot: free[ui.game.you * 2 + 1].i, fam: 1 });
    });
  }
  await a.waitForTimeout(800);
  await a.keyboard.press('Space');
  // fin de la vague 1 : la vague 2 est programmée ou lancée
  await a.waitForFunction(() => { const s = window.__dfend.app.game.interp.latest; return s.wave >= 2 || (s.wave === 1 && s.nextWaveT > 0 && s.eCount === 0); }, null, { timeout: 90000 }).catch(() => fail('la vague 1 ne se termine pas'));
  const st = await Promise.all([a, b].map((p) => p.evaluate(() => { const s = window.__dfend.app.game.interp.latest; return { towers: s.tCount, wave: s.wave, lives: s.lives }; })));
  if (st[0].towers !== 4 || st[1].towers !== 4) await fail('tours manquantes ' + JSON.stringify(st));
  if (errors.length) await fail(errors.join('\n'));
  console.log('OK :', JSON.stringify(st));
  await browser.close();
})();
