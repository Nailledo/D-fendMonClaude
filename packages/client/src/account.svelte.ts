import { HERO_IDS, mergeProgress, sameProgress, sanitizeProgress, type Difficulty, type HeroId, type Progress } from '@dfend/shared';
import { audio } from './audio/Audio';
import { keys, settings, type Settings } from './settings';
import { progress, setDifficulty, setHero, setName, toast, ui } from './state.svelte';
import { loadRaw, onSave, save } from './storage';

/**
 * Compte sayk.fr (connexion Discord). Le service `api.sayk.fr` (hub MiniGames Sayk) pose un cookie
 * de session partagé par tous les sous-domaines. Connecté, la progression (campagne, étoiles,
 * atelier), le nom, le héros et les réglages qui ne dépendent pas de l'appareil suivent le joueur
 * d'un navigateur à l'autre. Hors de sayk.fr (développement local) ou si le service ne répond pas,
 * le jeu reste anonyme et tout reste dans `localStorage`, comme avant.
 *
 * Sur le service : `profile` (8 ko max) = progression + nom/héros/difficulté ;
 * `settings` (16 ko max) = réglages communs + raccourcis clavier.
 */

const GAME = 'defend';
const PUSH_DELAY_MS = 1200;

/** Réglages qui suivent le compte ; la qualité graphique, la résolution, etc. dépendent de l'appareil. */
const SYNCED_SETTINGS = [
  'volMaster', 'volMusic', 'volSfx', 'edgeScroll', 'damageNumbers', 'textScale', 'colorblind', 'reduceShake', 'showKeys',
] as const satisfies readonly (keyof Settings)[];

const PROFILE_KEYS = new Set(['progress', 'name', 'hero', 'difficulty']);
const SETTINGS_KEYS = new Set(['settings', 'keys']);

export interface AccountUser {
  id: string;
  name: string;
  avatar: string | null;
}

export const account = $state({
  user: null as AccountUser | null,
  /** off : pas de service (hors sayk.fr) ; idle : service joignable, non connecté */
  status: 'off' as 'off' | 'idle' | 'loading' | 'synced' | 'saving' | 'error',
});

/** Dernier compte synchronisé sur cet appareil et date de la dernière modification locale de la progression. */
interface SyncMeta {
  owner: string | null;
  at: number;
}
let meta: SyncMeta = { owner: null, at: 0, ...loadRaw<Partial<SyncMeta>>('sync', {}) };
const saveMeta = () => {
  try {
    localStorage.setItem('dfend.sync', JSON.stringify(meta));
  } catch {
    /* ignoré */
  }
};

export function apiBase(): string | null {
  const configured = (import.meta.env as Record<string, string | undefined>).VITE_SAYK_API;
  if (configured) return configured.replace(/\/$/, '');
  return typeof location !== 'undefined' && /(^|\.)sayk\.fr$/.test(location.hostname) ? 'https://api.sayk.fr' : null;
}

/** Adresse du bouton « Se connecter avec Discord » : revient sur la page courante. */
export function loginUrl(): string | null {
  const base = apiBase();
  if (base === null) return null;
  const back = new URL(location.href);
  back.searchParams.delete('login_error');
  return `${base}/auth/login?return=${encodeURIComponent(back.toString())}`;
}

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${apiBase()}${path}`, {
    credentials: 'include',
    signal: AbortSignal.timeout(8000),
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
}

// ---------------------------------------------------------------- corps envoyés

const snapshot = (): Progress => sanitizeProgress(JSON.parse(JSON.stringify(progress)));

function profileBody(): string {
  return JSON.stringify({ v: 1, progress: snapshot(), at: meta.at, name: ui.name, hero: ui.hero, difficulty: ui.difficulty });
}

function settingsBody(): string {
  const s: Record<string, unknown> = {};
  for (const k of SYNCED_SETTINGS) s[k] = settings[k];
  return JSON.stringify({ v: 1, settings: s, keys: { ...keys } });
}

// ---------------------------------------------------------------- envoi (différé, regroupé)

type Kind = 'profile' | 'settings';
let ready = false;
let applying = false;
const lastPushed: Record<Kind, string> = { profile: '', settings: '' };
const timers: Record<Kind, ReturnType<typeof setTimeout> | undefined> = { profile: undefined, settings: undefined };
const pending = new Set<Kind>();

function push(kind: Kind, keepalive = false) {
  clearTimeout(timers[kind]);
  pending.delete(kind);
  if (!ready) return;
  const body = kind === 'profile' ? profileBody() : settingsBody();
  if (body === lastPushed[kind]) return;
  lastPushed[kind] = body;
  account.status = 'saving';
  call(`/api/games/${GAME}/${kind}`, { method: 'PUT', body, keepalive })
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      if (account.user) meta.owner = account.user.id;
      saveMeta();
      if (pending.size === 0) account.status = 'synced';
    })
    .catch(() => {
      // échec réseau : on réessaiera à la prochaine modification
      lastPushed[kind] = '';
      account.status = 'error';
    });
}

function schedule(kind: Kind) {
  pending.add(kind);
  clearTimeout(timers[kind]);
  timers[kind] = setTimeout(() => push(kind), PUSH_DELAY_MS);
}

/** Envoie tout de suite ce qui attend (fermeture de l'onglet, retour au menu). */
export function flushAccount() {
  for (const k of [...pending]) push(k, true);
}

onSave((key) => {
  if (key === 'progress' && !applying) {
    meta.at = Date.now();
    saveMeta();
  }
  if (!ready || applying) return;
  if (PROFILE_KEYS.has(key)) schedule('profile');
  else if (SETTINGS_KEYS.has(key)) schedule('settings');
});

// ---------------------------------------------------------------- lecture et fusion

interface RemoteData {
  settings: { settings?: Record<string, unknown>; keys?: Record<string, unknown> } | null;
  profile: { progress?: unknown; at?: unknown; name?: unknown; hero?: unknown; difficulty?: unknown } | null;
  updatedAt: { settings: number; profile: number };
}

function applyProgress(p: Progress) {
  applying = true;
  Object.assign(progress, p);
  save('progress', p);
  applying = false;
}

function applyProfile(data: RemoteData, user: AccountUser) {
  const remote = data.profile;
  const local = snapshot();
  // progression laissée ici par un autre compte : elle lui appartient déjà, on ne la mélange pas
  const foreign = meta.owner !== null && meta.owner !== user.id;
  let merged: Progress;
  if (remote?.progress) {
    const rp = sanitizeProgress(remote.progress);
    const remoteAt = Number(remote.at) || data.updatedAt.profile || 0;
    merged = foreign ? rp : mergeProgress(local, rp, meta.at, remoteAt);
  } else {
    merged = foreign ? sanitizeProgress({}) : local;
  }
  if (!sameProgress(merged, local)) applyProgress(merged);

  applying = true;
  if (remote) {
    if (typeof remote.name === 'string' && remote.name.trim()) setName(remote.name.trim());
    if (HERO_IDS.includes(remote.hero as HeroId)) setHero(remote.hero as HeroId);
    if (remote.difficulty === 0 || remote.difficulty === 1 || remote.difficulty === 2) setDifficulty(remote.difficulty as Difficulty);
  }
  // pas encore de nom (ou un nom tiré au hasard) : celui de Discord
  if (!ui.name || /^Chevalier\d{1,2}$/.test(ui.name)) setName(user.name.slice(0, 16));
  applying = false;

  // ce qui vient d'être appliqué correspond au serveur s'il n'y a rien eu à fusionner
  const body = profileBody();
  const remoteSame = remote?.progress && sameProgress(sanitizeProgress(remote.progress), merged) && remote.name === ui.name && remote.hero === ui.hero && remote.difficulty === ui.difficulty;
  lastPushed.profile = remoteSame ? body : '';
  if (!remoteSame) pending.add('profile');
}

function applySettings(data: RemoteData) {
  const remote = data.settings;
  if (!remote) {
    pending.add('settings');
    return;
  }
  applying = true;
  const s = remote.settings ?? {};
  for (const k of SYNCED_SETTINGS) {
    const v = s[k];
    if (typeof v === typeof settings[k] && (typeof v !== 'number' || Number.isFinite(v))) (settings as unknown as Record<string, unknown>)[k] = v;
  }
  save('settings', settings);
  const kk = remote.keys ?? {};
  for (const a of Object.keys(keys) as (keyof typeof keys)[]) {
    const v = kk[a];
    if (typeof v === 'string' && /^[A-Za-z0-9]{1,24}$/.test(v)) keys[a] = v;
  }
  save('keys', keys);
  applying = false;
  audio.applyVolumes();
  document.documentElement.style.setProperty('--scale', String(settings.textScale));
  document.documentElement.classList.toggle('show-keys', !!settings.showKeys);
  lastPushed.settings = settingsBody();
}

async function pull(user: AccountUser) {
  const res = await call(`/api/games/${GAME}/data`);
  if (!res.ok) throw new Error(String(res.status));
  const data = (await res.json()) as RemoteData;
  applyProfile(data, user);
  applySettings(data);
  meta.owner = user.id;
  saveMeta();
  ready = true;
  account.status = 'synced';
  // ce que le serveur n'avait pas encore (première connexion, progression fusionnée)
  for (const k of [...pending]) schedule(k);
}

let started = false;

/** À appeler une fois au démarrage : lit la session et lance la synchronisation. */
export async function initAccount() {
  if (started || apiBase() === null) return;
  started = true;
  account.status = 'idle';

  const params = new URLSearchParams(location.search);
  const err = params.get('login_error');
  if (err !== null) {
    toast(err === 'denied' ? 'Connexion Discord annulée.' : 'La connexion Discord a échoué, réessayez.', 'warn', 5000);
    params.delete('login_error');
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  }
  addEventListener('pagehide', flushAccount);
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAccount();
  });

  try {
    const res = await call('/api/me');
    if (!res.ok) return;
    const { user } = (await res.json()) as { user: AccountUser | null };
    if (!user) return;
    account.user = user;
    account.status = 'loading';
    await pull(user);
  } catch {
    // service injoignable : on reste anonyme (la progression locale est intacte)
    account.status = account.user ? 'error' : 'idle';
  }
}

/** Déconnexion : la progression reste sur cet appareil, rattachée au compte qui vient de partir. */
export async function logout() {
  flushAccount();
  ready = false;
  account.user = null;
  account.status = 'idle';
  await call('/auth/logout', { method: 'POST' }).catch(() => undefined);
}
