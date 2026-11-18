import { describe, expect, it } from 'vitest';
import { Ev, GameState, LEVELS, Sim, earlyCallBonus, previewWave, type GameConfig } from '../src/index';

/** Joue la partie (avec appels anticipés) et compare chaque vague lancée avec son aperçu. */
function check(cfg: GameConfig, waves: number) {
  const sim = new Sim(cfg);
  const seen = new Set<object>();
  let checked = 0;
  sim.apply(0, { k: 'wave' });
  for (let guard = 0; guard < 20 * 60 * 30 && checked < waves; guard++) {
    if (sim.nextWaveT > 0) sim.apply(0, { k: 'wave' });
    const started = sim.events.some((e) => e[0] === Ev.WaveStart) || (checked === 0 && sim.waveIdx === 1);
    if (started) {
      const fresh = sim.spawnQ.filter((s) => !seen.has(s));
      const counts: Record<number, number> = {};
      for (const s of fresh) counts[s.type] = (counts[s.type] ?? 0) + 1;
      const p = previewWave(cfg, sim.waveIdx, cfg.players.length)!;
      const expected: Record<number, number> = {};
      for (const e of p.entries) expected[e.type] = (expected[e.type] ?? 0) + e.count;
      expect(counts).toEqual(expected);
      checked++;
    }
    for (const s of sim.spawnQ) seen.add(s);
    sim.events.length = 0;
    if (sim.state === GameState.Lost || sim.state === GameState.Won) break;
    sim.step();
    // les héros restent en vie : on teste les vagues, pas la défense
    sim.lives = 99;
  }
  expect(checked).toBe(waves);
}

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i, name: 'J' + i, hero: 'samuel' as const }));

describe('aperçu des vagues', () => {
  it('correspond à la simulation en histoire, solo et à 3', () => {
    check({ mode: 'story', mapId: LEVELS[2].mapId, difficulty: 1, seed: 3, players: players(1) }, 6);
    check({ mode: 'story', mapId: LEVELS[5].mapId, difficulty: 1, seed: 3, players: players(3) }, 6);
  });
  it('correspond à la simulation en survie (chemins qui s’ouvrent, mutations)', () => {
    check({ mode: 'survival', mapId: 'fournaise', difficulty: 2, seed: 77, players: players(1) }, 10);
  });
  it('bonus d’appel anticipé : inchangé en solo, réparti en coop', () => {
    expect(earlyCallBonus(10, 1)).toBe(15);
    expect(earlyCallBonus(10, 2)).toBe(9);
    expect(earlyCallBonus(10, 4)).toBe(6);
  });
});
