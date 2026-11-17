/**
 * Compare les familles de tours : un bot qui ne construit qu'une famille (améliorée comme le bot « diversifié »)
 * joue chaque niveau en solo. Une famille nettement au-dessus ou en dessous des autres est à rééquilibrer.
 *   pnpm families            -> tous les niveaux, Vétéran
 *   pnpm families -- 3 0     -> niveau 4 seulement, Normal
 */
import { FAMILIES, LEVELS, type Difficulty } from '../packages/shared/src/index';
import { play, type Strategy } from './bots';

const onlyLevel = process.argv[2] !== undefined ? Number(process.argv[2]) : -1;
const diff = (process.argv[3] !== undefined ? Number(process.argv[3]) : 1) as Difficulty;
const SEEDS = [11, 22, 33, 44];
const NAMES = ['archers', 'caserne', 'mages', 'artillerie'];
const levels = onlyLevel >= 0 ? [onlyLevel] : LEVELS.map((_, i) => i);
console.log(`Difficulté : ${['Normal', 'Vétéran', 'Cauchemar'][diff]} — solo, ${SEEDS.length} parties par case (victoires · vies · vague atteinte)`);
console.log('    ' + ''.padEnd(30) + FAMILIES.map((_, f) => NAMES[f].padEnd(18)).join(''));
const total = FAMILIES.map(() => ({ wins: 0, wave: 0, runs: 0 }));
for (const lv of levels) {
  const row: string[] = [];
  FAMILIES.forEach((_, f) => {
    let wins = 0, lives = 0, wave = 0;
    for (const s of SEEDS) {
      const r = play(lv, 1, diff, `mono${f}` as Strategy, s);
      if (r.won) wins++;
      lives += r.lives;
      wave += r.wave / LEVELS[lv].waves;
    }
    total[f].wins += wins; total[f].wave += wave; total[f].runs += SEEDS.length;
    row.push(`${wins}/${SEEDS.length} ${(lives / SEEDS.length).toFixed(0).padStart(2)}♥ ${Math.round((wave / SEEDS.length) * 100)}%`.padEnd(18));
  });
  console.log(`${String(lv + 1).padStart(2)}. ${LEVELS[lv].name.padEnd(30)}${row.join('')}`);
}
console.log('    ' + 'Total'.padEnd(30) + total.map((t) => `${t.wins}/${t.runs} ${Math.round((t.wave / t.runs) * 100)}%`.padEnd(18)).join(''));
