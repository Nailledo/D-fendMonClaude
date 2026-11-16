import { describe, expect, it } from 'vitest';
import { GameState, MAPS, Sim, Snapshot, buildRuntimeMap, encodeSnapshot, replay, type GameConfig, type LoggedCmd } from '../src';

const cfg = (over: Partial<GameConfig> = {}): GameConfig => ({
  mode: 'story', mapId: 'pont', difficulty: 1, seed: 42,
  players: [{ id: 0, name: 'Samuel', hero: 'samuel' }], ...over,
});

describe('cartes', () => {
  it('génère des emplacements valides pour chaque carte', () => {
    for (const id of Object.keys(MAPS)) {
      const m = buildRuntimeMap(id, 4);
      expect(m.slots.length, id).toBeGreaterThanOrEqual(MAPS[id].slotCount - 2);
      const s1 = buildRuntimeMap(id, 1);
      expect(s1.slots.filter((s) => !s.locked).length).toBeLessThan(m.slots.length);
    }
  });
});

describe('simulation', () => {
  it('construit, tire et tue des ennemis', () => {
    const sim = new Sim(cfg());
    const free = sim.map.slots.findIndex((s) => !s.locked);
    sim.apply(0, { k: 'build', slot: free, fam: 0 });
    expect(sim.towers.length).toBe(1);
    sim.apply(0, { k: 'wave' });
    expect(sim.state).toBe(GameState.Running);
    for (let i = 0; i < 20 * 60; i++) sim.step();
    expect(sim.players[0].kills).toBeGreaterThan(0);
  });

  it('refuse les commandes invalides', () => {
    const sim = new Sim(cfg());
    const gold = sim.players[0].gold;
    sim.apply(0, { k: 'build', slot: 9999, fam: 0 });
    sim.apply(0, { k: 'build', slot: 0, fam: 7 as never });
    sim.apply(3, { k: 'build', slot: 0, fam: 0 });
    expect(sim.towers.length).toBe(0);
    expect(sim.players[0].gold).toBe(gold);
  });

  it('perd la partie sans défense', () => {
    const sim = new Sim(cfg());
    sim.apply(0, { k: 'wave' });
    for (let i = 0; i < 20 * 60 * 15 && sim.state !== GameState.Lost; i++) {
      sim.step();
      if (sim.nextWaveT > 0) sim.apply(0, { k: 'wave' });
    }
    expect(sim.state).toBe(GameState.Lost);
  });

  it('est déterministe et rejouable', () => {
    const c = cfg({ mode: 'survival', mapId: 'carrefour', seed: 7 });
    const sim = new Sim(c);
    const log: LoggedCmd[] = [];
    const slots = sim.map.slots.map((s, i) => i).filter((i) => !sim.map.slots[i].locked);
    const push = (cmd: LoggedCmd['c']) => { log.push({ tick: sim.tick, pid: 0, c: cmd }); sim.apply(0, cmd); };
    push({ k: 'build', slot: slots[0], fam: 0 });
    push({ k: 'build', slot: slots[1], fam: 1 });
    push({ k: 'wave' });
    while (sim.state !== GameState.Lost && sim.tick < 20 * 60 * 20) {
      if (sim.tick % 400 === 0) {
        const i = (sim.tick / 400) % slots.length;
        push({ k: 'build', slot: slots[i], fam: (sim.tick / 400) % 4 });
      }
      sim.step();
      sim.events.length = 0;
    }
    const r = replay(c, log, sim.tick + 1);
    expect(r.wave).toBe(sim.wavesSurvived);
  });

  it('encode et décode un snapshot', () => {
    const sim = new Sim(cfg({ players: [{ id: 0, name: 'A', hero: 'samuel' }, { id: 1, name: 'B', hero: 'nox' }] }));
    sim.apply(0, { k: 'build', slot: 0, fam: 1 });
    sim.apply(0, { k: 'wave' });
    for (let i = 0; i < 200; i++) sim.step();
    const buf = encodeSnapshot(sim, sim.drainEvents());
    const s = new Snapshot().decode(buf);
    expect(s.tick).toBe(sim.tick);
    expect(s.eCount).toBe(sim.enemies.length);
    expect(s.tCount).toBe(1);
    expect(s.hCount).toBe(2);
    expect(s.pCount).toBe(2);
  });

  it('adapte la difficulté au nombre de joueurs', () => {
    const one = new Sim(cfg());
    const four = new Sim(cfg({ players: [0, 1, 2, 3].map((id) => ({ id, name: 'J' + id, hero: 'samuel' as const })) }));
    one.apply(0, { k: 'wave' });
    four.apply(0, { k: 'wave' });
    for (let i = 0; i < 400; i++) { one.step(); four.step(); }
    expect(four.enemies.length).toBeGreaterThan(one.enemies.length);
    expect(four.enemies[0].maxHp).toBeGreaterThan(one.enemies[0].maxHp);
  });
});
