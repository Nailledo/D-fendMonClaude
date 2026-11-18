import { TREE_VERSION, emptyProgress, migrateTree, type Difficulty, type EndInfo, type HeroId, type LobbyPlayer, type Mode, type Progress, type RoomSettings } from '@dfend/shared';
import type { Line } from './story/dialogs';
import { load, loadRaw, save } from './storage';

export type Screen = 'title' | 'story' | 'survival' | 'multi' | 'lobby' | 'game';
export type Overlay = null | 'settings' | 'encyclo' | 'leaderboard' | 'heroes' | 'help' | 'atelier' | 'herotree' | 'skin';

export interface Selection {
  kind: 'build' | 'tower' | 'enemy' | 'hero' | 'ally';
  slot?: number;
  tower?: number;
  fam?: number;
  level?: number;
  sk?: [number, number];
  owner?: number;
  mine?: boolean;
  enemyType?: number;
  hp?: number;
  /** propriétés de l'ennemi sélectionné (voir Trait) */
  traits?: number;
  /** priorité de ciblage de la tour sélectionnée */
  prio?: number;
}

export interface HudPlayer {
  id: number;
  name: string;
  gold: number;
  connected: boolean;
  active: boolean;
  hero: HeroId;
  speed2: boolean;
  ping: number;
}

export type { Progress } from '@dfend/shared';

// treeV absent d'une sauvegarde = version 1 (avant la branche Intendance)
export const progress: Progress = $state(load<Progress>('progress', { ...emptyProgress(), treeV: 1 }));
export function saveProgress() {
  save('progress', $state.snapshot(progress));
}
// ancienne sauvegarde : branches de l'atelier remplacées depuis (la branche Héros), étoiles rendues
if ((progress.treeV ?? 1) < TREE_VERSION) {
  migrateTree(progress.tree, progress.treeV ?? 1);
  progress.treeV = TREE_VERSION;
  saveProgress();
}

export const ui = $state({
  screen: 'title' as Screen,
  overlay: null as Overlay,
  name: loadRaw<string>('name', ''),
  hero: loadRaw<HeroId>('hero', 'samuel'),
  /** dernière difficulté choisie ; Normal tant que le joueur n'a terminé aucun niveau */
  difficulty: loadRaw<Difficulty>('difficulty', progress.unlocked === 0 ? 0 : 1),
  netStatus: 'closed' as 'connecting' | 'open' | 'closed',
  error: '',
  room: null as null | { code: string; you: number; players: LobbyPlayer[]; settings: RoomSettings; inGame: boolean },
  game: null as null | { mode: Mode; mapId: string; difficulty: Difficulty; you: number; multi: boolean; level: number },
  paused: false,
  /** écran de chargement : actif, avancement (0..1), étape en cours */
  loading: { active: true, progress: 0, label: 'Démarrage…', title: '' },
  hud: {
    gold: 0,
    lives: 20,
    maxLives: 20,
    wave: 0,
    totalWaves: 0,
    nextWave: -1,
    state: 0,
    speed: 1,
    mutations: [] as number[],
    players: [] as HudPlayer[],
    hero: { type: 0, cls: -1, kit: 0, level: 1, xp: 0, hp: 1, cds: [0, 0, 0], respawn: 0, dead: false },
    spells: [0, 0],
    /** objets de boutique restants dans la partie */
    items: [] as number[],
    targeting: '' as string,
    /** chapardeurs en fuite avec votre or */
    thief: { n: 0, gold: 0 },
    /** boss en jeu : barre de vie en haut de l'écran */
    boss: { on: false, type: 0, hp: 1, phase: 0, phases: 1 },
    /** incrémenté à chaque entrée en scène / transformation d'un boss (éclair d'écran) */
    bossFx: 0,
    /** Kessin s'adapte : résistances acquises (%) et part des dégâts physiques de la vague en cours */
    adapt: { on: false, phys: 0, magic: 0, share: 0.5 },
    adaptFx: 0,
  },
  sel: null as Selection | null,
  dialog: null as null | { lines: Line[]; i: number },
  end: null as null | EndInfo,
  /** étoiles gagnées pour l'atelier à la fin de la partie */
  starsGained: 0,
  /** points de héros gagnés à la fin de la partie */
  heroPointsGained: 0,
  chat: [] as { from: string; text: string; color: number; t: number }[],
  chatOpen: false,
  toasts: [] as { id: number; text: string; kind: string }[],
  banner: null as null | { title: string; sub: string; id: number },
  debug: { on: false, fps: 0, calls: 0, tris: 0, ents: 0, ping: 0, kb: 0, res: 100 },
  portraits: {} as Record<string, string>,
  /** icônes 3D générées au démarrage (clé → image) */
  icons: {} as Record<string, string>,
  submitted: false,
  /** écran tactile : interface agrandie, confirmations en deux appuis */
  touch: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches,
  /** infobulle de l'option armée du menu radial (affichée dans le tiroir au tactile) */
  radialTip: null as null | { title: string; text: string; cost?: number },
  /** rejouer le prologue au prochain lancement du niveau 1 */
  replayPrologue: false,
  /** incrémenté quand une partie est créée : `app.game` n'est pas réactif, l'interface s'y abonne via ce compteur */
  gameId: 0,
  /** panneau de tour déplié (tactile : replié par défaut) */
  panelOpen: false,
  /** côté du tiroir d'informations au tactile : à l'opposé du menu radial */
  sheet: 'bottom' as 'bottom' | 'top' | 'left' | 'right',
  /** écran bas (téléphone en paysage) : menu radial resserré */
  short: typeof innerHeight !== 'undefined' && innerHeight < 520,
});

// un appareil hybride bascule selon le dernier pointeur utilisé
if (typeof window !== 'undefined') {
  addEventListener('pointerdown', (e: PointerEvent) => {
    const t = e.pointerType === 'touch' || e.pointerType === 'pen';
    if (e.pointerType && t !== ui.touch) ui.touch = t;
  }, { capture: true, passive: true });
  addEventListener('resize', () => { ui.short = innerHeight < 520; });
}

let toastId = 0;
export function toast(text: string, kind = 'info', ms = 3200) {
  const id = ++toastId;
  ui.toasts.push({ id, text, kind });
  setTimeout(() => {
    const i = ui.toasts.findIndex((t) => t.id === id);
    if (i >= 0) ui.toasts.splice(i, 1);
  }, ms);
}

let bannerId = 0;
export function banner(title: string, sub = '', ms = 2600) {
  const id = ++bannerId;
  ui.banner = { title, sub, id };
  setTimeout(() => {
    if (ui.banner?.id === id) ui.banner = null;
  }, ms);
}

export function setName(n: string) {
  ui.name = n.slice(0, 16);
  save('name', ui.name);
}
export function setDifficulty(d: Difficulty) {
  ui.difficulty = d;
  save('difficulty', d);
}
/** Les héros n'ont pas de nom : le vôtre porte votre pseudo. */
export function heroName(name = ui.name): string {
  return name.trim() || 'Héros sans nom';
}

export function setHero(h: HeroId) {
  ui.hero = h;
  save('hero', h);
}
