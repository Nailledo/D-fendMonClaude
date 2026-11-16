/**
 * Simulateur d'équilibrage headless : des bots jouent chaque niveau
 * pour 1 à 4 joueurs et affichent le taux de victoire et les vies restantes.
 *   pnpm balance              -> tous les niveaux, Vétéran
 *   pnpm balance -- 3 0       -> niveau 4 seulement, difficulté Normal
 */
import { LEVELS, type Difficulty } from '../packages/shared/src/index';
import { play, type Strategy } from './bots';

const onlyLevel = process.argv[2] !== undefined ? Number(process.argv[2]) : -1;
const diff = (process.argv[3] !== undefined ? Number(process.argv[3]) : 1) as Difficulty;
const SEEDS = [11, 22, 33];
const levels = onlyLevel >= 0 ? [onlyLevel] : LEVELS.map((_, i) => i);
console.log(`Difficulté : ${['Normal', 'Vétéran', 'Cauchemar'][diff]} — ${SEEDS.length} parties par case (victoires · vies moyennes · vague moyenne)`);
for (const lv of levels) {
  const row: string[] = [];
  for (const strat of ['glouton', 'diversifie'] as Strategy[]) {
    for (let n = 1; n <= 4; n++) {
      let wins = 0, lives = 0, wave = 0;
      for (const s of SEEDS) {
        const r = play(lv, n, diff, strat, s);
        if (r.won) wins++;
        lives += r.lives;
        wave += r.wave;
      }
      row.push(`${strat[0]}${n}: ${wins}/${SEEDS.length} ${(lives / SEEDS.length).toFixed(0).padStart(2)}♥ v${(wave / SEEDS.length).toFixed(0)}`);
    }
  }
  console.log(`${String(lv + 1).padStart(2)}. ${LEVELS[lv].name.padEnd(30)} ${row.join(' | ')}`);
}
