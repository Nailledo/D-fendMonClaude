/** Calibre, niveau par niveau, l'intensité du bonus de PV multijoueur (multiK) pour égaler le solo. */
import { LEVELS } from '../packages/shared/src/index';
import { play } from './bots';

const SEEDS = [11, 22, 33];
for (let lv = 0; lv < LEVELS.length; lv++) {
  const L = LEVELS[lv];
  let solo = 0;
  for (const s of SEEDS) solo += play(lv, 1, 1, 'diversifie', s).lives;
  solo /= SEEDS.length;
  let lo = 0.2, hi = 3, m = 0;
  for (let it = 0; it < 7; it++) {
    L.multiK = (lo + hi) / 2;
    m = 0;
    for (let n = 2; n <= 4; n++) for (const s of SEEDS) m += play(lv, n, 1, 'diversifie', s).lives;
    m /= 3 * SEEDS.length;
    if (m > solo) lo = L.multiK; else hi = L.multiK;
  }
  console.log(`${lv + 1}. ${L.name.padEnd(30)} solo ${solo.toFixed(1)} vies · multiK ${L.multiK.toFixed(2)} -> multi ${m.toFixed(1)} vies`);
}
