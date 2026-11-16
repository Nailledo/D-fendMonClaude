import type { Difficulty, EndInfo, HeroId, LobbyPlayer, Mode, RoomSettings } from '@dfend/shared';
import type { Line } from './story/dialogs';
import { load, loadRaw, save } from './storage';

export type Screen = 'title' | 'story' | 'survival' | 'multi' | 'lobby' | 'game';
export type Overlay = null | 'settings' | 'encyclo' | 'leaderboard' | 'heroes' | 'help';

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

export interface Progress {
  unlocked: number;
  stars: number[][]; // [niveau][difficulté]
  seenPrologue: boolean;
  seen: string[]; // ennemis rencontrés
  finished: boolean;
}

export const progress: Progress = $state(load<Progress>('progress', { unlocked: 0, stars: [], seenPrologue: false, seen: [], finished: false }));
export function saveProgress() {
  save('progress', $state.snapshot(progress));
}

export const ui = $state({
  screen: 'title' as Screen,
  overlay: null as Overlay,
  name: loadRaw<string>('name', ''),
  hero: loadRaw<HeroId>('hero', 'samuel'),
  netStatus: 'closed' as 'connecting' | 'open' | 'closed',
  error: '',
  room: null as null | { code: string; you: number; players: LobbyPlayer[]; settings: RoomSettings; inGame: boolean },
  game: null as null | { mode: Mode; mapId: string; difficulty: Difficulty; you: number; multi: boolean; level: number },
  paused: false,
  loading: false,
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
    hero: { type: 0, level: 1, xp: 0, hp: 1, cds: [0, 0, 0], respawn: 0, dead: false },
    spells: [0, 0],
    targeting: '' as string,
  },
  sel: null as Selection | null,
  dialog: null as null | { lines: Line[]; i: number },
  end: null as null | EndInfo,
  chat: [] as { from: string; text: string; color: number; t: number }[],
  chatOpen: false,
  toasts: [] as { id: number; text: string; kind: string }[],
  banner: null as null | { title: string; sub: string; id: number },
  debug: { on: false, fps: 0, calls: 0, tris: 0, ents: 0, ping: 0, kb: 0 },
  portraits: {} as Record<string, string>,
  submitted: false,
});

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
export function setHero(h: HeroId) {
  ui.hero = h;
  save('hero', h);
}
