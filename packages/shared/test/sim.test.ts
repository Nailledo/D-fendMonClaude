import { describe, expect, it } from 'vitest';
import { ITEMS, Item, TREE, GameState, MAPS, Sim, sanitizeMeta, treeCost, Snapshot, buildRuntimeMap, encodeSnapshot, replay, type GameConfig, type LoggedCmd } from '../src';

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

describe('obstacles', () => {
  it('sont déterministes et hors du chemin, des mares et des emplacements', () => {
    for (const id of Object.keys(MAPS)) {
      const a = buildRuntimeMap(id, 1).obstacles, b = buildRuntimeMap(id, 4).obstacles;
      expect(a, id).toEqual(b);
      const m = buildRuntimeMap(id, 4);
      for (const o of m.obstacles) {
        for (const p of m.paths) expect(Math.sqrt(p.minDist2(o.x, o.z, 1)), id).toBeGreaterThan(o.r + 1.2);
        for (const s of m.slots) expect(Math.hypot(s.x - o.x, s.z - o.z), id).toBeGreaterThan(o.r + 1.5);
      }
    }
  });

  it('le héros ne marche ni dans l’eau ni à travers le décor', () => {
    for (const id of Object.keys(MAPS)) {
      const sim = new Sim(cfg({ mapId: id, mode: 'survival' }));
      const u = sim.heroes[0].u;
      const solids: [number, number, number][] = [...(sim.map.def.pools ?? []), ...sim.map.obstacles.map((o) => [o.x, o.z, o.r] as [number, number, number])];
      // vers le centre de chaque mare et de chaque obstacle
      for (const [x, z] of solids.slice(0, 6)) {
        sim.apply(0, { k: 'hmove', x, z });
        for (let i = 0; i < 20 * 12; i++) {
          sim.step();
          for (const [cx, cz, r] of solids) expect(Math.hypot(u.x - cx, u.z - cz), id).toBeGreaterThan(r - 0.02);
        }
      }
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

  it('rembourse intégralement pendant la préparation, partiellement ensuite', () => {
    const sim = new Sim(cfg());
    const gold = sim.players[0].gold;
    const free = sim.map.slots.map((s, i) => ({ s, i })).filter((o) => !o.s.locked);
    sim.apply(0, { k: 'build', slot: free[0].i, fam: 0 });
    for (let i = 0; i < 20 * 10; i++) sim.step(); // bien après le délai d'annulation
    expect(sim.state).toBe(GameState.Waiting);
    sim.apply(0, { k: 'sell', tower: sim.towers[0].id });
    expect(sim.players[0].gold).toBe(gold);
    sim.apply(0, { k: 'build', slot: free[0].i, fam: 0 });
    const cost = gold - sim.players[0].gold;
    sim.apply(0, { k: 'wave' });
    for (let i = 0; i < 20 * 10; i++) sim.step();
    const before = sim.players[0].gold;
    sim.apply(0, { k: 'sell', tower: sim.towers[0].id });
    expect(sim.players[0].gold - before).toBe(Math.floor(cost * 0.6));
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

describe('coopération et héros', () => {
  const duo = () => cfg({
    mapId: 'carrefour',
    players: [{ id: 0, name: 'A', hero: 'samuel' }, { id: 1, name: 'B', hero: 'brom' }],
  });

  it('un coéquipier améliore une tour avec son or, mais ne peut pas la vendre', () => {
    const sim = new Sim(duo());
    const free = sim.map.slots.findIndex((s) => !s.locked);
    sim.apply(0, { k: 'build', slot: free, fam: 0 });
    const t = sim.towers[0];
    const goldA = sim.players[0].gold, goldB = sim.players[1].gold;
    sim.apply(1, { k: 'up', tower: t.id });
    expect(t.level).toBe(1);
    expect(sim.players[0].gold).toBe(goldA);
    expect(sim.players[1].gold).toBeLessThan(goldB);
    sim.apply(1, { k: 'sell', tower: t.id });
    expect(sim.towers.length).toBe(1);
    // l'achat du coéquipier n'ouvre pas le remboursement intégral au propriétaire
    const before = sim.players[0].gold;
    sim.apply(0, { k: 'sell', tower: t.id });
    expect(sim.players[0].gold - before).toBeLessThan(t.invested);
  });

  it('la charge de Samuel s’arrête à sa portée', () => {
    const sim = new Sim(cfg());
    const u = sim.heroes[0].u;
    const x0 = u.x, z0 = u.z;
    sim.apply(0, { k: 'hskill', i: 0, x: x0 + 30, z: z0 });
    expect(Math.hypot(u.x - x0, u.z - z0)).toBeLessThanOrEqual(7.001);
  });

  it('un clic droit sur un ennemi : la mêlée va au contact, le tir reste à portée', () => {
    for (const hero of ['samuel', 'lyra'] as const) {
      const sim = new Sim(cfg({ players: [{ id: 0, name: 'A', hero }] }));
      const u = sim.heroes[0].u;
      sim.apply(0, { k: 'wave' });
      let e: (typeof sim.enemies)[number] | undefined;
      for (let i = 0; i < 20 * 30 && !e; i++) { sim.step(); e = sim.enemies.find((q) => !q.dead && !q.flying && q.dist > 3); }
      expect(e, hero).toBeTruthy();
      sim.apply(0, { k: 'hattack', e: e!.id });
      expect(u.focus, hero).toBe(e);
      let reached = false, minD = Infinity;
      for (let i = 0; i < 20 * 30 && !e!.dead; i++) {
        sim.step();
        const d = Math.hypot(e!.x - u.x, e!.z - u.z);
        minD = Math.min(minD, d);
        if (hero === 'samuel' && u.fighting && u.target === e) reached = true;
        if (hero === 'lyra' && d <= u.range && !u.moving) reached = true;
      }
      expect(reached, hero).toBe(true);
      // l'archer ne va pas au corps à corps
      if (hero === 'lyra') expect(minD).toBeGreaterThan(u.range * 0.5);
    }
  });

  it('un nouvel ordre de déplacement annule la cible imposée', () => {
    const sim = new Sim(cfg());
    const u = sim.heroes[0].u;
    sim.apply(0, { k: 'wave' });
    let e: (typeof sim.enemies)[number] | undefined;
    for (let i = 0; i < 20 * 30 && !e; i++) { sim.step(); e = sim.enemies.find((q) => !q.dead && q.dist > 1); }
    sim.apply(0, { k: 'hattack', e: e!.id });
    expect(u.focus).toBe(e);
    sim.apply(0, { k: 'hmove', x: u.x + 1, z: u.z });
    expect(u.focus).toBe(null);
    // identifiant inconnu : ignoré
    sim.apply(0, { k: 'hattack', e: 99999 });
    expect(u.focus).toBe(null);
  });

  it('un héros qui frappe un ennemi déjà bloqué prend les coups', () => {
    const sim = new Sim(cfg({ players: [{ id: 0, name: 'A', hero: 'brom' }] }));
    const hero = sim.heroes[0].u;
    // le héros se poste au milieu du chemin, sans tour ni soldat
    const p = { x: 0, z: 0 };
    sim.map.paths[0].at(sim.map.paths[0].length * 0.35, 0, p);
    sim.apply(0, { k: 'hmove', x: p.x, z: p.z });
    sim.apply(0, { k: 'wave' });
    let hurt = false;
    for (let i = 0; i < 20 * 90 && !hurt; i++) {
      sim.step();
      if (hero.hp < hero.maxHp - 1 || hero.dead) hurt = true;
    }
    expect(hurt).toBe(true);
  });

  it('un héros qui rejoint un soldat au combat attire les coups de l’ennemi', () => {
    const sim = new Sim(cfg({ players: [{ id: 0, name: 'A', hero: 'brom' }] }));
    sim.players[0].gold = 5000;
    for (let s = 0; s < sim.map.slots.length; s++) if (!sim.map.slots[s].locked) sim.apply(0, { k: 'build', slot: s, fam: 1 });
    const hero = sim.heroes[0].u;
    sim.apply(0, { k: 'wave' });
    let sent = -1, hurt = false;
    let foe: (typeof sim.enemies)[number] | null = null;
    // on ne regarde que les coups reçus tant que l'ennemi visé est vivant
    for (let i = 0; i < 20 * 120 && !hurt && !(foe && foe.dead); i++) {
      sim.step();
      if (sim.nextWaveT > 0) sim.apply(0, { k: 'wave' });
      if (sent < 0) {
        // un ennemi déjà au contact d'un soldat : le héros se colle derrière lui et l'attaque
        const e = sim.enemies.find((e) => !e.dead && e.def.dmg[1] > 0 && e.fighting && !e.def.ab.cleave);
        if (e) {
          hero.x = hero.hx = e.x + 0.6;
          hero.z = hero.hz = e.z;
          hero.moving = false;
          hero.target = e;
          e.blockers.push(hero);
          foe = e;
          sent = i;
        }
      } else if (hero.hp < hero.maxHp - 0.5 || hero.dead) hurt = true;
    }
    expect(sent).toBeGreaterThanOrEqual(0);
    expect(hurt).toBe(true);
  });
});

describe('arbre de compétences et boutique', () => {
  const full = TREE.map(() => 5);

  it('les bonus de l’arbre s’appliquent au joueur qui les a achetés', () => {
    const base = new Sim(cfg());
    const boosted = new Sim(cfg({ players: [{ id: 0, name: 'A', hero: 'samuel', tree: full }] }));
    expect(boosted.players[0].gold).toBe(base.players[0].gold + 100);
    expect(boosted.maxLives).toBe(base.maxLives + 2);
    expect(boosted.heroes[0].u.maxHp).toBeGreaterThan(base.heroes[0].u.maxHp);
    // soldats de caserne : plus de points de vie
    const slot = base.map.slots.findIndex((s) => !s.locked);
    base.apply(0, { k: 'build', slot, fam: 1 });
    boosted.apply(0, { k: 'build', slot, fam: 1 });
    expect(boosted.units.find((u) => u.tower)!.maxHp).toBeGreaterThan(base.units.find((u) => u.tower)!.maxHp);
    // un arbre plein coûte 9 étoiles par branche
    expect(treeCost(full)).toBe(9 * TREE.length);
  });

  it('les objets se consomment et agissent', () => {
    const items = ITEMS.map(() => 1);
    const sim = new Sim(cfg({ players: [{ id: 0, name: 'A', hero: 'samuel', items }] }));
    const g0 = sim.players[0].gold;
    sim.apply(0, { k: 'item', i: Item.Bourse, x: 0, z: 0 });
    expect(sim.players[0].gold).toBe(g0 + 150);
    expect(sim.players[0].items[Item.Bourse]).toBe(0);
    // délai entre deux objets, puis stock épuisé
    sim.apply(0, { k: 'item', i: Item.Potion, x: 0, z: 0 });
    expect(sim.players[0].items[Item.Potion]).toBe(1);
    for (let i = 0; i < 25; i++) sim.step();
    sim.apply(0, { k: 'item', i: Item.Bourse, x: 0, z: 0 });
    expect(sim.players[0].gold).toBe(g0 + 150);
    // givre : les ennemis de la zone sont figés
    sim.apply(0, { k: 'wave' });
    let e: (typeof sim.enemies)[number] | undefined;
    for (let i = 0; i < 20 * 30 && !e; i++) { sim.step(); e = sim.enemies.find((q) => !q.dead && q.dist > 2 && !q.def.boss); }
    sim.apply(0, { k: 'item', i: Item.Givre, x: e!.x, z: e!.z });
    expect(e!.stunT).toBeGreaterThan(20);
    const d = e!.dist;
    for (let i = 0; i < 40; i++) sim.step();
    expect(e!.dist).toBe(d);
  });

  it('un client ne peut pas gonfler son arbre ni son stock', () => {
    const m = sanitizeMeta([99, -3, 'x', 2.7, 5, 5, 5, 5], [1e9, -1, null]);
    expect(m.tree).toEqual([5, 0, 0, 2, 5, 5]);
    expect(m.items).toEqual([9, 0, 0, 0]);
    expect(sanitizeMeta('bad', {}).tree.every((v) => v === 0)).toBe(true);
  });
});
