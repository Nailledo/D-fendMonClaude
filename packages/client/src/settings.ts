import { load, save } from './storage';

export type Quality = 'bas' | 'moyen' | 'haut' | 'ultra';

export interface Settings {
  quality: Quality;
  resScale: number;
  fpsCap: number; // 0 = illimité
  shadows: boolean;
  antialias: boolean;
  decorDensity: number;
  volMaster: number;
  volMusic: number;
  volSfx: number;
  edgeScroll: boolean;
  damageNumbers: boolean;
  textScale: number;
  colorblind: boolean;
  reduceShake: boolean;
  /** badges de raccourcis toujours visibles (sinon : au survol, ou en maintenant Alt) */
  showKeys: boolean;
  /** baisse temporairement la résolution quand les images par seconde chutent */
  dynRes: boolean;
  autoDetected: boolean;
}

/**
 * Réglages dérivés de la qualité (non modifiables un par un) :
 * densité de pixels maximale, préférence pour les modèles détaillés, quantité de particules, taille des ombres.
 */
export const QUALITY_TUNING: Record<Quality, { prCap: number; lodBias: number; fx: number; shadowMap: number }> = {
  bas: { prCap: 1.25, lodBias: 0.55, fx: 0.5, shadowMap: 1024 },
  moyen: { prCap: 1.75, lodBias: 1, fx: 0.8, shadowMap: 1024 },
  haut: { prCap: 2, lodBias: 1.4, fx: 1, shadowMap: 2048 },
  ultra: { prCap: 2.5, lodBias: 2.4, fx: 1, shadowMap: 4096 },
};

export function tuning() {
  return QUALITY_TUNING[settings.quality] ?? QUALITY_TUNING.moyen;
}

export const QUALITY_PRESETS: Record<Quality, Pick<Settings, 'resScale' | 'shadows' | 'antialias' | 'decorDensity'>> = {
  bas: { resScale: 0.75, shadows: false, antialias: false, decorDensity: 0.45 },
  moyen: { resScale: 1, shadows: true, antialias: false, decorDensity: 0.8 },
  haut: { resScale: 1, shadows: true, antialias: true, decorDensity: 1 },
  ultra: { resScale: 1.5, shadows: true, antialias: true, decorDensity: 1.3 },
};

const DEFAULTS: Settings = {
  quality: 'moyen', ...QUALITY_PRESETS.moyen, fpsCap: 0,
  volMaster: 0.8, volMusic: 0.5, volSfx: 0.8, edgeScroll: false, damageNumbers: false,
  textScale: 1, colorblind: false, reduceShake: false, showKeys: false, dynRes: true, autoDetected: false,
};

export const settings: Settings = load('settings', DEFAULTS);

export function saveSettings() {
  save('settings', settings);
}

export function applyPreset(q: Quality) {
  settings.quality = q;
  Object.assign(settings, QUALITY_PRESETS[q]);
  saveSettings();
}

/** Détection automatique simple au premier lancement. */
export function autoDetect(gl: WebGLRenderingContext | WebGL2RenderingContext) {
  if (settings.autoDetected) return;
  let q: Quality = 'moyen';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).toLowerCase() : '';
    if (/rtx|radeon rx|geforce gtx 1[0-9]{3}|apple m[1-9] (pro|max)/.test(r)) q = 'haut';
    else if (/swiftshader|llvmpipe|software|mali-4|adreno \(tm\) 3/.test(r)) q = 'bas';
    if ((navigator.hardwareConcurrency ?? 4) <= 2) q = 'bas';
  } catch {
    /* ignoré */
  }
  applyPreset(q);
  settings.autoDetected = true;
  saveSettings();
}

// ---------------------------------------------------------------- Raccourcis

export type Action =
  | 'hero' | 'skill1' | 'skill2' | 'ult' | 'spell1' | 'spell2'
  | 'buildArcher' | 'buildBarracks' | 'buildMage' | 'buildArtillery' | 'buildMine' | 'buildCamp' | 'prio'
  | 'upgrade' | 'sell' | 'rally' | 'wave' | 'speed' | 'chat' | 'menu' | 'debug' | 'fpv'
  | 'camUp' | 'camDown' | 'camLeft' | 'camRight';

export const ACTION_LABELS: Record<Action, string> = {
  hero: 'Sélectionner son héros',
  skill1: 'Compétence 1 du héros',
  skill2: 'Compétence 2 du héros',
  ult: 'Ultime du héros',
  spell1: 'Sort général 1',
  spell2: 'Sort général 2',
  buildArcher: 'Construire : Archers',
  buildBarracks: 'Construire : Caserne',
  buildMage: 'Construire : Mages',
  buildArtillery: 'Construire : Artillerie',
  buildMine: 'Construire : Mine',
  buildCamp: 'Construire : Campement',
  prio: 'Priorité de ciblage de la tour',
  upgrade: 'Améliorer la tour',
  sell: 'Vendre la tour',
  rally: 'Point de ralliement',
  wave: 'Appeler la vague',
  speed: 'Vitesse ×2',
  chat: 'Discussion',
  menu: 'Pause / menu',
  debug: 'Affichage debug',
  fpv: 'Vue du héros (première personne)',
  camUp: 'Caméra : haut',
  camDown: 'Caméra : bas',
  camLeft: 'Caméra : gauche',
  camRight: 'Caméra : droite',
};

/** Codes physiques (event.code) : fonctionnent en AZERTY comme en QWERTY. */
export const DEFAULT_KEYS: Record<Action, string> = {
  hero: 'KeyH', skill1: 'KeyQ', skill2: 'KeyW', ult: 'KeyR', spell1: 'Digit1', spell2: 'Digit2',
  buildArcher: 'KeyZ', buildBarracks: 'KeyX', buildMage: 'KeyC', buildArtillery: 'KeyV', buildMine: 'KeyB', buildCamp: 'KeyN', prio: 'KeyT',
  upgrade: 'KeyU', sell: 'KeyS', rally: 'KeyD', wave: 'Space', speed: 'KeyF', chat: 'Enter', menu: 'Escape', debug: 'F3', fpv: 'KeyG',
  camUp: 'ArrowUp', camDown: 'ArrowDown', camLeft: 'ArrowLeft', camRight: 'ArrowRight',
};

export const keys: Record<Action, string> = load('keys', DEFAULT_KEYS);

export function saveKeys() {
  save('keys', keys);
}

export function resetKeys() {
  Object.assign(keys, DEFAULT_KEYS);
  saveKeys();
}

const AZERTY: Record<string, string> = {
  KeyQ: 'A', KeyW: 'Z', KeyA: 'Q', KeyZ: 'W', KeyM: ',', Semicolon: 'M',
  Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9', Digit0: '0',
};
const NAMES: Record<string, string> = {
  Space: 'Espace', Enter: 'Entrée', Escape: 'Échap', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  ShiftLeft: 'Maj', ShiftRight: 'Maj D', ControlLeft: 'Ctrl', Tab: 'Tab', Backspace: 'Retour',
};

let layout: Map<string, string> | null = null;
export async function detectLayout() {
  try {
    const kb = (navigator as unknown as { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } }).keyboard;
    if (kb) layout = await kb.getLayoutMap();
  } catch {
    layout = null;
  }
}

/** Libellé lisible d'une touche, selon la disposition réelle du clavier (AZERTY par défaut). */
export function keyLabel(code: string): string {
  if (NAMES[code]) return NAMES[code];
  if (/^F\d+$/.test(code)) return code;
  const l = layout?.get(code);
  if (l) return l.toUpperCase();
  if (AZERTY[code]) return AZERTY[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}
