import { describe, expect, it } from 'vitest';
import { CLASSES, DmgType, ENEMY_INDEX, LEAD_PHYS, buildCost, buildKit, heroStatBonus, nodeOpen, heroPassives, heroPoints, heroSkills, sanitizeBuild, LEVELS, Prio, TOWERS, Trait, campAura, genStoryWaves, sanitizeProgress, TREE_VERSION, genSurvivalWave, ITEMS, Item, TREE, GameState, MAPS, Sim, sanitizeMeta, treeCost, Snapshot, buildRuntimeMap, encodeSnapshot, replay, type GameConfig, type LoggedCmd } from '../src';

/** arbre : vocation, la voie gauche (0) ou droite (1) jusqu'au rang `upto`, l'ultime si demandé */
/** rangs : la racine et les `n` premiers nœuds de la route `j` (au maximum) */
const ROUTE_RANKS = [1, 3, 1, 3, 1, 1];
const R = (j: number, n = 6) => { const r = Array(19).fill(0); r[0] = 1; for (let k = 0; k < n; k++) r[1 + 6 * j + k] = ROUTE_RANKS[k]; return r; };
const B = (cls: number, r: number[] = R(0, 0), core = [0, 0, 0, 0, 0, 0]) => ({ cls, r: [...r], core });

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

  it('la charge de l’épéiste s’arrête à sa portée', () => {
    const sim = new Sim(cfg({ players: [{ id: 0, name: 'A', hero: 'samuel', build: B(0) }] }));
    const u = sim.heroes[0].u;
    const x0 = u.x, z0 = u.z;
    sim.apply(0, { k: 'hskill', i: 0, x: x0 + 30, z: z0 });
    expect(Math.hypot(u.x - x0, u.z - z0)).toBeLessThanOrEqual(7.001);
  });

  it('un clic droit sur un ennemi : la mêlée va au contact, le tir reste à portée', () => {
    for (const hero of ['samuel', 'lyra'] as const) {
      const sim = new Sim(cfg({ players: [{ id: 0, name: 'A', hero, build: B(hero === 'lyra' ? 2 : 0) }] }));
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
    // l'atelier ne touche plus au héros (il progresse dans son propre arbre)
    expect(boosted.heroes[0].u.maxHp).toBe(base.heroes[0].u.maxHp);
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

describe('priorité de ciblage, propriétés d’ennemis, mine et campement', () => {
  const spawn = (sim: Sim, type: string, dist: number, traits = 0) => {
    const e = (sim as any).spawnEnemy(ENEMY_INDEX[type], 0, 1, 0, dist, traits) as Sim['enemies'][number];
    return e;
  };
  const near = (sim: Sim, x: number, z: number, exclude: number[] = []) => {
    let best = -1, bd = Infinity;
    sim.map.slots.forEach((s, i) => {
      if (s.locked || exclude.includes(i) || sim.towerBySlot[i]) return;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };

  it('une tour vise selon sa priorité', () => {
    const sim = new Sim(cfg());
    const a = spawn(sim, 'gobelin', 10), b = spawn(sim, 'brute', 11), c = spawn(sim, 'gobelin', 12);
    const find = (p: number) => (sim as any).findTarget(b.x, b.z, 30, true, null, p);
    expect(find(Prio.First)).toBe(c);
    expect(find(Prio.Last)).toBe(a);
    expect(find(Prio.Strong)).toBe(b);
    expect(find(Prio.Close)).toBe(b);
    const slot = sim.map.slots.findIndex((s) => !s.locked);
    sim.apply(0, { k: 'build', slot, fam: 0 });
    const t = sim.towers[0];
    sim.apply(0, { k: 'prio', tower: t.id, p: Prio.Strong });
    expect(t.prio).toBe(Prio.Strong);
    sim.apply(0, { k: 'prio', tower: t.id, p: 9 });
    expect(t.prio).toBe(Prio.Strong);
  });

  it('un camouflé n’est visé que s’il est repéré', () => {
    const sim = new Sim(cfg());
    const e = spawn(sim, 'brute', 14, Trait.Camo);
    // héros loin de l'ennemi
    sim.heroes[0].u.x = e.x + 30; sim.heroes[0].u.hx = sim.heroes[0].u.x;
    const archer = near(sim, e.x, e.z);
    sim.apply(0, { k: 'build', slot: archer, fam: 0 });
    for (let i = 0; i < 10; i++) { (sim as any).stepSupport(); expect((sim as any).findTarget(e.x, e.z, 3, true)).toBe(null); }
    const mage = near(sim, e.x, e.z);
    sim.players[0].gold = 1000;
    sim.apply(0, { k: 'build', slot: mage, fam: 2 });
    (sim as any).stepSupport();
    expect(e.revealed).toBe(true);
    expect((sim as any).findTarget(e.x, e.z, 3, true)).toBe(e);
  });

  it('le plomb ne craint que la magie et les explosions', () => {
    const sim = new Sim(cfg());
    const e = spawn(sim, 'brute', 10, Trait.Lead);
    const hp = e.hp;
    const phys = sim.damage(e, 50, DmgType.Phys, 0, null);
    expect(phys).toBeGreaterThan(0);
    expect(e.hp).toBeCloseTo(hp - phys);
    const boom = sim.damage(e, 50, DmgType.Phys, 0, null, 0, false, true);
    expect(phys).toBeLessThan(boom * LEAD_PHYS * 1.01);
    expect(sim.damage(e, 50, DmgType.Magic, 0, null)).toBeGreaterThan(0);
  });

  it('un régénérant récupère ses PV quand on cesse de le blesser', () => {
    const sim = new Sim(cfg());
    const e = spawn(sim, 'brute', 3, Trait.Regrow);
    sim.damage(e, 100, DmgType.True, 0, null);
    const hp = e.hp;
    for (let i = 0; i < 20; i++) sim.step();
    expect(e.hp).toBe(hp);
    for (let i = 0; i < 40; i++) sim.step();
    expect(e.hp).toBeGreaterThan(hp);
  });

  it('les vagues de l’histoire et de la survie portent des propriétés', () => {
    const lvl = LEVELS[6];
    const waves = genStoryWaves(lvl, 2);
    expect(waves.some((w) => w.groups.some((g) => (g.traits ?? 0) & Trait.Lead))).toBe(true);
    // le premier niveau n'en a pas
    expect(genStoryWaves(LEVELS[0], 1).every((w) => w.groups.every((g) => !g.traits))).toBe(true);
    const s = genSurvivalWave('vallee', 7, 20, [0]);
    expect(s.groups.some((g) => g.traits)).toBe(true);
  });

  it('une mine rapporte de l’or à chaque vague', () => {
    const sim = new Sim(cfg());
    const slot = sim.map.slots.findIndex((s) => !s.locked);
    sim.apply(0, { k: 'build', slot, fam: 4 });
    expect(sim.towers[0].fam).toBe('mine');
    const g = sim.players[0].gold;
    sim.apply(0, { k: 'wave' });
    expect(sim.players[0].gold).toBe(g + TOWERS.mine[0].income!);
    // une mine ne tire pas et n'a pas de priorité
    sim.apply(0, { k: 'prio', tower: sim.towers[0].id, p: 2 });
    expect(sim.towers[0].prio).toBe(0);
  });

  it('un campement accélère les tours voisines', () => {
    const sim = new Sim(cfg());
    sim.players[0].gold = 2000;
    const s0 = sim.map.slots.findIndex((s) => !s.locked);
    sim.apply(0, { k: 'build', slot: s0, fam: 0 });
    const t = sim.towers[0];
    const s1 = near(sim, t.x, t.z, [s0]);
    const d = Math.hypot(sim.map.slots[s1].x - t.x, sim.map.slots[s1].z - t.z);
    sim.apply(0, { k: 'build', slot: s1, fam: 5 });
    sim.step();
    if (d <= TOWERS.camp[0].range) {
      expect(t.auraRate).toBeCloseTo(TOWERS.camp[0].aura!.rate);
      expect(t.auraRange).toBeCloseTo(TOWERS.camp[0].aura!.range);
    } else expect(t.auraRate).toBe(0);
    expect(campAura(4, [0, 3]).dmg).toBeGreaterThan(0);
    expect(campAura(3, [2, 0]).mark).toBeGreaterThan(0);
  });

  it('l’Intendance de l’atelier enrichit les mines et renforce les campements', () => {
    const W = TREE.findIndex((b) => b.id === 'works');
    expect(W).toBe(4);
    const tree = TREE.map((_, i) => (i === W ? 5 : 0));
    const sim = new Sim(cfg({ players: [{ id: 0, name: 'A', hero: 'samuel', tree }] }));
    const slot = sim.map.slots.findIndex((s) => !s.locked);
    sim.apply(0, { k: 'build', slot, fam: 4 });
    const g = sim.players[0].gold;
    sim.apply(0, { k: 'wave' });
    // +15 % +20 % +15 % = +50 %
    expect(sim.players[0].gold).toBe(g + Math.round(TOWERS.mine[0].income! * 1.5));
    const a = campAura(0, [0, 0], 0.35, 0.27);
    expect(a.rate).toBeCloseTo(TOWERS.camp[0].aura!.rate * 1.35);
    expect(a.r).toBeCloseTo(TOWERS.camp[0].range * 1.27);
  });

  it('une ancienne sauvegarde rend les étoiles de l’ancienne branche Héros', () => {
    const p = sanitizeProgress({ tree: [1, 0, 0, 0, 5, 2] });
    expect(p.tree).toEqual([1, 0, 0, 0, 0, 2]);
    expect(p.treeV).toBe(TREE_VERSION);
    expect(sanitizeProgress({ tree: [0, 0, 0, 0, 3, 0], treeV: TREE_VERSION }).tree[4]).toBe(3);
  });
});

describe('classes du héros', () => {
  const spawn = (sim: Sim, type: string, dist: number, traits = 0) =>
    (sim as any).spawnEnemy(ENEMY_INDEX[type], 0, 1, 0, dist, traits) as Sim['enemies'][number];
  it('sans vocation : Aventurier, compétences de base', () => {
    const sim = new Sim(cfg());
    const h = sim.heroes[0];
    expect(h.cls).toBe(null);
    expect(h.skills.map((s) => s?.id ?? null)).toEqual(['coup', 'souffle', 'elan']);
    expect(h.u.range).toBe(0);
  });

  it('l’arbre : prérequis, une seule route, ultime, coût', () => {
    const mage = CLASSES.findIndex((c) => c.id === 'mage');
    expect(heroSkills(B(mage)).map((s) => s?.id ?? null)).toEqual(['boule', 'souffle', 'elan']);
    const full = B(mage, R(0));
    expect(heroSkills(full).map((s) => s?.id ?? null)).toEqual(['boule', 'flammes', 'meteore']);
    expect(heroSkills(B(mage, R(1))).map((s) => s?.id ?? null)).toEqual(['boule', 'nova', 'blizzard']);
    expect(heroSkills(B(mage, R(2))).map((s) => s?.id ?? null)).toEqual(['boule', 'eclair', 'prison']);
    // la compétence de route seule : l'ultime reste celui de l'Aventurier
    expect(heroSkills(B(mage, R(2, 1))).map((s) => s?.id ?? null)).toEqual(['boule', 'eclair', 'elan']);
    expect(heroPassives(full)).toEqual(['brulure', 'combustion']);
    expect(buildKit(full)).toBe(1 | 2 | 8);
    expect(buildKit(B(mage, R(2)))).toBe(1 | 6 | 8);
    // racine 1 + route 2+3+2+3+2+3 + fondamentaux 2
    expect(buildCost({ ...full, core: [2, 0, 0, 0, 0, 0] })).toBe(1 + 15 + 2);
    // l'ultime et le dernier passif s'ouvrent depuis la 2e statistique
    expect(nodeOpen(B(mage, R(0, 3)), mage, 6)).toBe(false);
    expect(nodeOpen(B(mage, R(0, 4)), mage, 6)).toBe(true);
    expect(nodeOpen(B(mage, R(0, 4)), mage, 5)).toBe(true);
    // les autres routes sont fermées
    expect(nodeOpen(full, mage, 7)).toBe(false);
    expect(nodeOpen(full, mage, 13)).toBe(false);
    expect(nodeOpen(B(mage), mage, 7)).toBe(true);
    // une autre classe est verrouillée
    expect(nodeOpen(full, 0, 0)).toBe(false);
    // deux routes demandées : la seconde est coupée
    const both = sanitizeBuild({ cls: mage, r: R(0).map((v, i) => v || R(1)[i]), core: [9, -1, 'x'] });
    expect(both.r).toEqual(R(0));
    expect(both.core).toEqual([3, 0, 0, 0, 0, 0]);
    // ancien format ou sans racine : rien
    expect(sanitizeBuild({ cls: mage, r: [1, 1, 3, 1, 3, 1, 0, 0, 0, 0, 0, 1] }).cls).toBe(-1);
    expect(sanitizeBuild({ cls: mage, r: R(0).map((v, i) => (i ? v : 0)) }).cls).toBe(-1);
    expect(sanitizeBuild({ cls: 99, r: R(0) }).cls).toBe(-1);
    // Fil de la lame (route 0, nœud 2 : +6 %/rang) ×2 et Force ×3
    expect(heroStatBonus(B(0, [1, 1, 2, ...Array(16).fill(0)], [0, 3])).dmg).toBeCloseTo(0.27);
    expect(heroPoints([[3, 0, 0], [1, 2, 0], undefined as unknown as number[], [0, 0, 0]])).toBe(4);
  });

  it('un mage arcaniste repère les camouflés de plus loin avec Clairvoyance', () => {
    const mage = CLASSES.findIndex((c) => c.id === 'mage');
    const mk = (r: number[]) => {
      const sim = new Sim(cfg({ players: [{ id: 0, name: 'A', hero: 'nox', build: B(mage, r) }] }));
      const u = sim.heroes[0].u;
      const e = spawn(sim, 'gobelin', 3, Trait.Camo);
      u.x = u.hx = e.x + 4; u.z = u.hz = e.z;
      sim.step();
      return e.revealed;
    };
    expect(mk(R(2, 2))).toBe(false);
    expect(mk(R(2, 3))).toBe(true);
  });

  it('les nœuds de statistiques renforcent le héros', () => {
    const a = new Sim(cfg({ players: [{ id: 0, name: 'A', hero: 'samuel', build: B(0) }] })).heroes[0];
    // Chevalier : Cotte de mailles ×3 (+24 % PV) et Vigueur, Force ×3
    const b = new Sim(cfg({ players: [{ id: 0, name: 'A', hero: 'samuel', build: B(0, R(1, 2), [3, 3]) }] })).heroes[0];
    expect(b.u.maxHp).toBeGreaterThan(a.u.maxHp * 1.4);
    expect(b.u.dmgMax).toBeGreaterThan(a.u.dmgMax * 1.1);
  });

  it('une tourelle posée sur un bâtiment apparaît à côté', () => {
    const art = CLASSES.findIndex((c) => c.id === 'artificier');
    const sim = new Sim(cfg({ players: [{ id: 0, name: 'A', hero: 'brom', build: B(art, R(1)) }] }));
    const h = sim.heroes[0];
    h.level = 6;
    const slot = sim.map.slots.findIndex((s) => !s.locked);
    sim.apply(0, { k: 'build', slot, fam: 0 });
    const t = sim.towers[0];
    h.u.x = h.u.hx = t.x + 2; h.u.z = h.u.hz = t.z;
    const before = new Set(sim.units);
    sim.apply(0, { k: 'hskill', i: 1, x: t.x, z: t.z });
    const tur = sim.units.filter((u) => !before.has(u));
    expect(tur.length).toBe(1);
    for (const s of sim.map.slots) expect(Math.hypot(tur[0].x - s.x, tur[0].z - s.z)).toBeGreaterThan(1.05);
  });

  it('Malédiction : les ennemis maudits subissent plus de dégâts', () => {
    const necro = CLASSES.findIndex((c) => c.id === 'necro');
    const sim = new Sim(cfg({ players: [{ id: 0, name: 'A', hero: 'nox', build: B(necro, R(2)) }] }));
    const h = sim.heroes[0];
    h.level = 6;
    const e = spawn(sim, 'brute', 6);
    const e2 = spawn(sim, 'brute', 30);
    sim.step();
    h.u.x = h.u.hx = e.x + 3; h.u.z = h.u.hz = e.z;
    sim.apply(0, { k: 'hskill', i: 2, x: e.x, z: e.z });
    sim.step();
    expect(e.curseT).toBeGreaterThan(0);
    expect(e2.curseT).toBe(0);
    const h0 = e.hp, h1 = e2.hp;
    sim.damage(e, 30, DmgType.True, 0, null);
    sim.damage(e2, 30, DmgType.True, 0, null);
    expect(h0 - e.hp).toBeCloseTo(1.4 * (h1 - e2.hp), 3);
  });

  it('les compétences de chaque classe et de chaque route se lancent sans erreur', () => {
    for (let c = 0; c < CLASSES.length; c++) {
      for (let j = 0; j < 3; j++) {
        const sim = new Sim(cfg({ players: [{ id: 0, name: 'A', hero: 'samuel', build: B(c, R(j), [3, 3, 3, 3, 3, 3]) }] }));
        const h = sim.heroes[0];
        expect(h.skills.map((s) => s.id), `${CLASSES[c].id}/${j}`).toEqual([CLASSES[c].a.id, (CLASSES[c].routes[j].nodes[0] as { skill: { id: string } }).skill.id, (CLASSES[c].routes[j].nodes[5] as { skill: { id: string } }).skill.id]);
        h.level = 10;
        sim.apply(0, { k: 'wave' });
        for (let i = 0; i < 20 * 15; i++) sim.step();
        const hp0 = sim.enemies.reduce((t, e) => t + e.hp, 0);
        for (const i of [0, 1, 2] as const) sim.apply(0, { k: 'hskill', i, x: h.u.x + 2, z: h.u.z });
        for (let i = 0; i < 20 * 3; i++) sim.step();
        expect(h.cds.filter((v) => v > 0).length, `${CLASSES[c].id}/${j}`).toBeGreaterThanOrEqual(2);
        expect(Number.isFinite(hp0)).toBe(true);
      }
    }
  });

  it('les identifiants des compétences et des passifs sont uniques', () => {
    const ids = new Set<string>();
    let n = 0;
    for (const c of CLASSES) for (const r of c.routes) for (const nd of r.nodes) {
      const id = nd.kind === 'skill' || nd.kind === 'ult' ? nd.skill.id : nd.kind === 'passive' ? nd.id : null;
      if (id) { ids.add(id); n++; }
    }
    expect(ids.size).toBe(n);
  });
});

describe('chapardeur', () => {
  const thief = (sim: Sim) => {
    const len = sim.map.paths[0].length;
    const e = (sim as any).spawnEnemy(ENEMY_INDEX.chapardeur, 0, 1, 0, len * 0.6) as Sim['enemies'][number];
    return e;
  };
  it('vole de l’or, repart en arrière et s’échappe sans coûter de vie', () => {
    const sim = new Sim(cfg());
    sim.players[0].gold = 500;
    const lives = sim.lives;
    const e = thief(sim);
    for (let i = 0; i < 40 && !e.fleeing; i++) (sim as any).stepEnemies();
    expect(e.fleeing).toBe(true);
    expect(e.loot).toBe(75);
    expect(sim.players[0].gold).toBe(425);
    const d0 = e.dist;
    (sim as any).stepEnemies();
    expect(e.dist).toBeLessThan(d0);
    for (let i = 0; i < 20 * 120 && !e.dead; i++) (sim as any).stepEnemies();
    expect(e.dead).toBe(true);
    expect(sim.players[0].gold).toBe(425);
    expect(sim.lives).toBe(lives);
  });
  it('tué en fuite, il rend l’or avec un bonus', () => {
    const sim = new Sim(cfg());
    sim.players[0].gold = 1000;
    const e = thief(sim);
    for (let i = 0; i < 40 && !e.fleeing; i++) (sim as any).stepEnemies();
    expect(sim.players[0].gold).toBe(850);
    const before = sim.players[0].gold;
    sim.damage(e, 9999, DmgType.True, 0, null);
    expect(e.dead).toBe(true);
    // 150 volés, rendus avec 50 % en plus, et la prime
    expect(sim.players[0].gold - before).toBeGreaterThanOrEqual(225);
  });
  it('apparaît dans certaines vagues de l’histoire', () => {
    const n = LEVELS.slice(1).reduce((a, l) => a + genStoryWaves(l, 2).reduce((b, w) => b + w.groups.filter((g) => g.type === ENEMY_INDEX.chapardeur).length, 0), 0);
    expect(n).toBeGreaterThan(5);
    expect(genStoryWaves(LEVELS[0], 1).some((w) => w.groups.some((g) => g.type === ENEMY_INDEX.chapardeur))).toBe(false);
  });
});

describe('boss', () => {
  it('Kessin change d’arène et appelle sa garde en se transformant', () => {
    const sim = new Sim(cfg({ mapId: 'trone' }));
    const e = (sim as any).spawnEnemy(ENEMY_INDEX.kessin1, 0, 1, 0, 20) as Sim['enemies'][number];
    const n0 = sim.enemies.length;
    sim.damage(e, e.hp + 1, DmgType.True, 0, null);
    expect(e.dead).toBe(false);
    expect(e.type).toBe(ENEMY_INDEX.kessin2);
    expect(e.path).toBe(1);
    expect(sim.enemies.length - n0).toBe(6);
  });
});

describe('Kessin s’adapte', () => {
  it('les ennemis résistent au type de dégâts dominant de la vague précédente', () => {
    const sim = new Sim(cfg({ mapId: 'plaines' }));
    expect(sim.adaptive).toBe(true);
    const e = (sim as any).spawnEnemy(ENEMY_INDEX.diablotin, 0, 1, 0, 10) as Sim['enemies'][number];
    e.armor = 0; e.mres = 0; e.hp = e.maxHp = 1e6;
    expect(sim.damage(e, 100, DmgType.Phys, 0, null)).toBeCloseTo(100);
    (sim as any).adaptWave();
    expect(sim.adapt[0]).toBeCloseTo(0.05);
    expect(sim.damage(e, 100, DmgType.Phys, 0, null)).toBeCloseTo(95);
    expect(sim.damage(e, 100, DmgType.Magic, 0, null)).toBeCloseTo(102.5);
    // vague équilibrée : rien de nouveau, la résistance s'estompe
    sim.damage(e, 100, DmgType.Magic, 0, null);
    (sim as any).adaptWave();
    expect(sim.adapt[0]).toBeCloseTo(0);
    expect(new Sim(cfg()).adaptive).toBe(false);
  });
});
