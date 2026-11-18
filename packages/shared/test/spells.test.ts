import { describe, expect, it } from 'vitest';
import { DEFAULT_SPELLS, GameState, LEVELS, SPELLS, Sim, mergeProgress, emptyProgress, sanitizeProgress, sanitizeSpells, spellsUnlocked, usableSpells, type GameConfig } from '../src';

const cfg = (spells?: [number, number]): GameConfig => ({
  mode: 'story', mapId: 'pont', difficulty: 1, seed: 7,
  players: [{ id: 0, name: 'Samuel', hero: 'samuel', spells }],
});
const idx = (id: string) => SPELLS.findIndex((s) => s.id === id);

/** partie lancée, avec un ennemi au sol vivant au contact du point retourné */
function withEnemy(spells: [number, number]) {
  const sim = new Sim(cfg(spells));
  sim.apply(0, { k: 'wave' });
  for (let i = 0; i < 20 * 8 && sim.enemies.length === 0; i++) sim.step();
  for (let i = 0; i < 20 * 3; i++) sim.step();
  const e = sim.enemies.find((q) => !q.dead)!;
  return { sim, e };
}

describe('catalogue des sorts', () => {
  it('garde météores et renforts en tête, avec des identifiants uniques', () => {
    expect(SPELLS[0].id).toBe('meteor');
    expect(SPELLS[1].id).toBe('renfort');
    expect(new Set(SPELLS.map((s) => s.id)).size).toBe(SPELLS.length);
    expect(SPELLS.length).toBe(11);
  });
  it('chaque sort à débloquer renvoie à un niveau de l’histoire existant', () => {
    for (const s of SPELLS) expect(s.unlock === -1 || (s.unlock >= 0 && s.unlock < LEVELS.length), s.id).toBe(true);
  });
});

describe('choix et déblocage', () => {
  it('sanitizeSpells : deux sorts distincts du catalogue, sinon le choix par défaut', () => {
    expect(sanitizeSpells([3, 5])).toEqual([3, 5]);
    expect(sanitizeSpells([3, 3])).toEqual([...DEFAULT_SPELLS]);
    expect(sanitizeSpells([0, 99])).toEqual([...DEFAULT_SPELLS]);
    expect(sanitizeSpells([-1, 2])).toEqual([...DEFAULT_SPELLS]);
    expect(sanitizeSpells('x')).toEqual([...DEFAULT_SPELLS]);
    expect(sanitizeSpells([1.5, 2])).toEqual([...DEFAULT_SPELLS]);
    expect(sanitizeSpells(undefined)).toEqual([...DEFAULT_SPELLS]);
  });
  it('seuls les sorts de départ sont libres au début ; terminer un niveau ouvre le sien, définitivement', () => {
    const open0 = spellsUnlocked([]);
    expect(open0.filter(Boolean).length).toBe(2);
    expect(open0[0] && open0[1]).toBe(true);
    const lvl0 = SPELLS.findIndex((s) => s.unlock === 0);
    const open1 = spellsUnlocked([[0, 0, 1]]);
    expect(open1[lvl0]).toBe(true);
    // un niveau sans étoile (jamais gagné) n'ouvre rien
    expect(spellsUnlocked([[0, 0, 0]])[lvl0]).toBe(false);
  });
  it('usableSpells remplace un sort non obtenu par un sort libre', () => {
    const locked = idx('seisme');
    expect(usableSpells([locked, 1], [])).toEqual([1, 0]);
    expect(usableSpells([locked, idx('foudre')], [])).toEqual([0, 1]);
    expect(usableSpells([0, 1], [])).toEqual([0, 1]);
  });
  it('la progression garde le choix de sorts et le fusionne sans sort verrouillé', () => {
    const p = sanitizeProgress({ ...emptyProgress(), spells: [2, 3] });
    expect(p.spells).toEqual([2, 3]);
    expect(sanitizeProgress({}).spells).toEqual([...DEFAULT_SPELLS]);
    const a = { ...emptyProgress(), unlocked: 1, stars: [[1, 0, 0]], spells: [idx('sables'), 0] as [number, number] };
    const b = { ...emptyProgress(), unlocked: 0, stars: [] as number[][], spells: [0, 1] as [number, number] };
    const merged = mergeProgress(a, b, 10, 5);
    expect(merged.spells).toEqual([idx('sables'), 0]);
    // l'autre appareil n'a rien gagné : le choix doit retomber sur des sorts libres
    const lost = mergeProgress({ ...a, stars: [] }, { ...b, unlocked: 1, stars: [[0, 0, 0]] }, 10, 5);
    expect(lost.spells).toEqual([0, 1]);
  });
});

describe('sorts en partie', () => {
  it('un sort qui n’est pas dans le choix du joueur ne se lance pas', () => {
    const { sim, e } = withEnemy([idx('poison'), 1]);
    const n = sim.zones.length;
    // l'emplacement 0 est le poison : jamais de zone de sables, même par un client truqué
    sim.apply(0, { k: 'spell', s: 5 as 0, x: e.x, z: e.z });
    sim.apply(0, { k: 'spell', s: -1 as 0, x: e.x, z: e.z });
    expect(sim.zones.length).toBe(n);
    sim.apply(0, { k: 'spell', s: 0, x: e.x, z: e.z });
    expect(sim.zones.length).toBe(n + 1);
    expect(sim.players[0].spellCd[0]).toBeGreaterThan(0);
    // en recharge : un second lancer immédiat est refusé
    sim.apply(0, { k: 'spell', s: 0, x: e.x, z: e.z });
    expect(sim.zones.length).toBe(n + 1);
  });
  it('un choix invalide dans la config revient à météores et renforts', () => {
    const sim = new Sim(cfg([4, 4]));
    expect(sim.players[0].spells).toEqual([0, 1]);
  });
  it('sables mouvants, poison, blizzard et flammes posent une zone qui blesse ou ralentit', () => {
    for (const id of ['sables', 'poison', 'blizzard', 'flammes']) {
      const { sim, e } = withEnemy([idx(id), 1]);
      const hp = e.hp;
      sim.apply(0, { k: 'spell', s: 0, x: e.x, z: e.z });
      expect(sim.zones.length, id).toBe(1);
      for (let i = 0; i < 20 * 2; i++) sim.step();
      expect(e.dead || e.hp < hp, id).toBe(true);
    }
  });
  it('les sables ralentissent les ennemis au sol', () => {
    const { sim, e } = withEnemy([idx('sables'), 1]);
    sim.apply(0, { k: 'spell', s: 0, x: e.x, z: e.z });
    sim.step();
    expect(e.slowMul).toBeLessThanOrEqual(0.25 + 1e-6);
  });
  it('malédiction : l’ennemi marqué subit plus de dégâts et est ralenti', () => {
    const { sim, e } = withEnemy([idx('malediction'), 1]);
    sim.apply(0, { k: 'spell', s: 0, x: e.x, z: e.z });
    expect(e.curse).toBeGreaterThan(0.3);
    expect(e.slowMul).toBeLessThan(1);
  });
  it('foudre : frappe l’ennemi visé', () => {
    const { sim, e } = withEnemy([idx('foudre'), 1]);
    const hp = e.hp;
    sim.apply(0, { k: 'spell', s: 0, x: e.x, z: e.z });
    expect(e.dead || e.hp < hp).toBe(true);
  });
  it('séisme : étourdit les ennemis au sol de la zone', () => {
    const { sim, e } = withEnemy([idx('seisme'), 1]);
    sim.apply(0, { k: 'spell', s: 0, x: e.x, z: e.z });
    expect(e.dead || e.stunT > 0).toBe(true);
  });
  it('soin : rend des vies sans dépasser le maximum, sans viser de zone', () => {
    const sim = new Sim(cfg([idx('soin'), 1]));
    sim.apply(0, { k: 'wave' });
    sim.lives = sim.maxLives - 1;
    sim.apply(0, { k: 'spell', s: 0, x: Number.NaN, z: Number.NaN });
    expect(sim.lives).toBe(sim.maxLives);
    sim.lives = sim.maxLives - 5;
    for (let i = 0; i < 20 * 120; i++) sim.step();
    sim.lives = sim.maxLives - 5;
    sim.apply(0, { k: 'spell', s: 0, x: 0, z: 0 });
    expect(sim.lives).toBe(sim.maxLives - 3);
  });
  it('bénédiction : les tours de la zone gagnent en cadence puis le bonus s’éteint', () => {
    const sim = new Sim(cfg([idx('benediction'), 1]));
    sim.apply(0, { k: 'build', slot: 0, fam: 0 });
    for (let i = 0; i < 20 * 15; i++) sim.step();
    const t = sim.towers[0];
    expect(t).toBeTruthy();
    sim.apply(0, { k: 'spell', s: 0, x: t.x, z: t.z });
    sim.step();
    expect(t.auraRate).toBeGreaterThanOrEqual(0.4);
    for (let i = 0; i < 20 * 13; i++) sim.step();
    expect(t.auraRate).toBe(0);
    expect(sim.blessings.length).toBe(0);
  });
  it('météores et renforts restent inchangés (sorts par défaut)', () => {
    const sim = new Sim(cfg());
    expect(sim.state).toBe(GameState.Waiting);
    sim.apply(0, { k: 'spell', s: 1, x: 3, z: 3 });
    expect(sim.units.filter((u) => u.owner === 0).length).toBeGreaterThanOrEqual(3);
    sim.apply(0, { k: 'spell', s: 0, x: 3, z: 3 });
    expect(sim.projs.length).toBe(3);
  });
});
