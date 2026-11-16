/**
 * Aligne la difficulté multijoueur sur le solo : pour 2, 3 et 4 joueurs, cherche le
 * multiplicateur de PV (BALANCE.hpByPlayers) qui laisse autant de vies qu'en solo.
 */
import { BALANCE, LEVELS } from '../packages/shared/src/index';
import { play } from './bots';

const SEEDS = [11, 22, 33];
function avg(n: number) {
  let lives = 0, runs = 0;
  for (let lv = 0; lv < LEVELS.length; lv++) for (const s of SEEDS) { lives += play(lv, n, 1, 'diversifie', s).lives; runs++; }
  return lives / runs;
}
const solo = avg(1);
console.log(`Solo : ${solo.toFixed(1)} vies en moyenne`);
for (let n = 2; n <= 4; n++) {
  let lo = 1, hi = 1 + n * 1.2;
  let m = 0;
  for (let it = 0; it < 8; it++) {
    BALANCE.hpByPlayers[n - 1] = (lo + hi) / 2;
    m = avg(n);
    if (m > solo) lo = BALANCE.hpByPlayers[n - 1]; else hi = BALANCE.hpByPlayers[n - 1];
  }
  console.log(`${n} joueurs : PV ×${BALANCE.hpByPlayers[n - 1].toFixed(2)} -> ${m.toFixed(1)} vies`);
}
console.log('hpByPlayers:', JSON.stringify(BALANCE.hpByPlayers.map((v) => Math.round(v * 100) / 100)));
