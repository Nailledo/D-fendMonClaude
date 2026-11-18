/** Bots d'équilibrage partagés par balance.ts et tune.ts. */
import {
  CORE, CORE_COST, CORE_RANKS, ENEMIES, FAMILIES, GameState, LEVELS, NODE_COUNT, ROUTE_LEN, SKILL_UNLOCK, Sim, TOWERS, classNodes, CLASSES, nodeOpen, routeNode,
  type Difficulty, type GameConfig, type HeroBuild, type HeroId,
} from '../packages/shared/src/index';

/** glouton : archers partout sans améliorer ; diversifie : rotation des familles ; mono0..3 : une seule famille, améliorée comme diversifie */
export type Strategy = 'glouton' | 'diversifie' | 'mono0' | 'mono1' | 'mono2' | 'mono3';
const HEROES: HeroId[] = ['samuel', 'lyra', 'brom', 'nox'];
/** classes et routes des bots : épéiste duelliste, archer pisteur, artificier ingénieur, nécromancien maître des os */
export const BOT_CLASSES: [number, number][] = [[0, 0], [2, 1], [5, 1], [4, 1]];

/**
 * Arbre d'un bot qui a dépensé `points` comme un joueur appliqué : la classe, une route entière (ultime compris), puis les fondamentaux.
 * On suppose 2 points par niveau terminé avant celui qu'on joue (victoire + Vétéran), plus la victoire en Normal du niveau joué.
 */
export function botBuild(cls: number, route: number, points: number): HeroBuild {
  const b: HeroBuild = { cls, r: Array(NODE_COUNT).fill(0), core: CORE.map(() => 0) };
  const nodes = classNodes(CLASSES[cls]);
  const order = [0, ...Array.from({ length: ROUTE_LEN }, (_, k) => routeNode(route, k))];
  for (const i of order) {
    while (nodeOpen(b, cls, i) && points >= nodes[i].cost) { b.r[i]++; points -= nodes[i].cost; }
  }
  for (let k = 0; points >= CORE_COST; k = (k + 1) % CORE.length) {
    if (b.core.every((r) => r >= CORE_RANKS)) break;
    if (b.core[k] < CORE_RANKS) { b.core[k]++; points -= CORE_COST; }
  }
  return b;
}
const monoFam = (s: Strategy) => (s.startsWith('mono') ? Number(s[4]) : -1);

export function runBot(sim: Sim, strat: Strategy, n: number) {
  const slots = sim.map.slots.map((s, i) => ({ s, i })).filter((o) => !o.s.locked);
  for (const p of sim.players) {
    if (!p.active) continue;
    const mine = slots.filter((_, k) => k % n === p.id);
    // construire
    for (let k = 0; k < mine.length; k++) {
      const o = mine[k];
      if (sim.towerBySlot[o.i]) continue;
      // un joueur réel s'adapte : contre les ennemis blindés de la Cendre, plus de mages
      // ... et contre le plomb (annoncé par l'aperçu des vagues), des mages et de l'artillerie
      const lt = sim.level?.traits;
      const lead = !!lt?.lead && sim.waveIdx + 1 >= lt.lead;
      const rot = lead ? [2, 3, 1, 2, 0, 3] : sim.map.def.biome === 'cendre' ? [2, 1, 0, 2, 3] : [0, 1, 2, 3];
      const mono = monoFam(strat);
      const fam = strat === 'glouton' ? 0 : mono >= 0 ? mono : rot[k % rot.length];
      if (p.gold >= TOWERS[FAMILIES[fam]][0].cost) sim.apply(p.id, { k: 'build', slot: o.i, fam });
      break;
    }
    if (strat !== 'glouton') {
      // une seule dépense par décision, en équilibrant : on améliore toujours la tour la plus faible
      const own = sim.towers.filter((t) => t.owner === p.id).sort((a, b) => a.level + a.sk[0] + a.sk[1] - (b.level + b.sk[0] + b.sk[1]));
      const free = mine.some((o) => !sim.towerBySlot[o.i]);
      if (!free) {
        for (const t of own) {
          if (t.level < 2) { if (p.gold >= TOWERS[t.fam][t.level + 1].cost) sim.apply(p.id, { k: 'up', tower: t.id }); break; }
          if (t.level === 2) { const s = ((t.slot % 2) + 1) as 1 | 2; if (p.gold >= TOWERS[t.fam][2 + s].cost) sim.apply(p.id, { k: 'spec', tower: t.id, s }); break; }
          const i = t.sk[0] <= t.sk[1] ? 0 : 1;
          const r = t.sk[i];
          if (r >= 3) continue;
          if (p.gold >= TOWERS[t.fam][t.level].skills![i].costs[r]) sim.apply(p.id, { k: 'skill', tower: t.id, i });
          break;
        }
      }
      // sort : météores sur l'ennemi le plus avancé
      if (p.spellCd[0] === 0 && sim.enemies.length > 4) {
        let best = sim.enemies[0];
        for (const e of sim.enemies) if (e.dist > best.dist && !e.flying) best = e;
        sim.apply(p.id, { k: 'spell', s: 0, x: best.x, z: best.z });
      }
      if (p.spellCd[1] === 0 && sim.enemies.length > 2) {
        const e = sim.enemies.reduce((a, b) => (b.dist > a.dist ? b : a));
        sim.apply(p.id, { k: 'spell', s: 1, x: e.x, z: e.z });
      }
      // compétences du héros
      const h = sim.heroes.find((h) => h.owner === p.id);
      if (h && !h.u.dead && sim.enemies.length) {
        const e = sim.enemies.reduce((a, b) => (b.dist > a.dist ? b : a));
        for (const i of [0, 1, 2] as const) if (h.cds[i] === 0 && h.skills[i] && h.level >= SKILL_UNLOCK[i]) sim.apply(p.id, { k: 'hskill', i, x: e.x, z: e.z });
      }
    }
  }
}

export function play(level: number, n: number, diff: Difficulty, strat: Strategy, seed: number, classes: [number, number][] = BOT_CLASSES) {
  const cfg: GameConfig = {
    mode: 'story', mapId: LEVELS[level].mapId, difficulty: diff, seed,
    players: Array.from({ length: n }, (_, i) => ({ id: i, name: 'Bot' + i, hero: HEROES[i], build: botBuild(classes[i % classes.length][0], classes[i % classes.length][1], 2 * level + 1) })),
  };
  const sim = new Sim(cfg);
  sim.apply(0, { k: 'wave' });
  let guard = 0;
  while (sim.state !== GameState.Won && sim.state !== GameState.Lost && guard++ < 20 * 60 * 40) {
    if (sim.tick % 10 === 0) runBot(sim, strat, n);
    sim.step();
    sim.events.length = 0;
  }
  return { won: sim.state === GameState.Won, lives: sim.lives, wave: sim.waveIdx };
}

