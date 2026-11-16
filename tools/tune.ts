/**
 * Calibre chaque niveau pour que le bot « diversifié » (Vétéran, 1 à 4 joueurs)
 * finisse avec environ 10 vies EN SOLO (le multi est ensuite aligné par tune-players.ts) : on cherche la progression de PV par vague (hpRamp),
 * puis on réduit le budget si le niveau reste trop dur même sans progression.
 */
import { LEVELS } from '../packages/shared/src/index';
import { play } from './bots';

const SEEDS = [11, 22, 33];
function score(lv: number) {
  let lives = 0, wins = 0, runs = 0;
  for (let n = 1; n <= 1; n++) for (const s of [11, 22, 33, 44, 55, 66]) { const r = play(lv, n, 1, 'diversifie', s); lives += r.lives; if (r.won) wins++; runs++; }
  return { lives: lives / runs, wins };
}
const only = process.argv[2] !== undefined ? Number(process.argv[2]) : -1;
for (let lv = 0; lv < LEVELS.length; lv++) {
  if (only >= 0 && lv !== only) continue;
  const L = LEVELS[lv];
  const target = lv < 2 ? 14 : 10;
  let lo = 0, hi = 0.6, r = score(lv);
  L.hpRamp = 0;
  const easy = score(lv);
  if (easy.lives < target) {
    // trop dur même sans progression : on baisse le budget
    let blo = 0.2, bhi = 1;
    const b0 = L.budget0;
    for (let it = 0; it < 8; it++) {
      const f = (blo + bhi) / 2;
      L.budget0 = b0 * f;
      r = score(lv);
      if (r.lives > target) blo = f; else bhi = f;
    }
    console.log(`${lv + 1}. ${L.name.padEnd(30)} hpRamp 0 budget0 ${L.budget0.toFixed(1)} -> vies ${r.lives.toFixed(1)} victoires ${r.wins}/6`);
    continue;
  }
  for (let it = 0; it < 9; it++) {
    const f = (lo + hi) / 2;
    L.hpRamp = f;
    r = score(lv);
    if (r.lives > target) lo = f; else hi = f;
  }
  console.log(`${lv + 1}. ${L.name.padEnd(30)} hpRamp ${L.hpRamp.toFixed(3)} budget0 ${L.budget0} -> vies ${r.lives.toFixed(1)} victoires ${r.wins}/6`);
}
