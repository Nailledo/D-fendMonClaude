/** Accès localStorage protégé (navigation privée, stockage bloqué...). */
export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('dfend.' + key);
    if (v === null) return fallback;
    return { ...fallback, ...JSON.parse(v) } as T;
  } catch {
    return fallback;
  }
}

export function loadRaw<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('dfend.' + key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

type SaveListener = (key: string, value: unknown) => void;
const listeners: SaveListener[] = [];

/** Prévenu à chaque enregistrement local (synchronisation du compte). */
export function onSave(fn: SaveListener) {
  listeners.push(fn);
}

export function save(key: string, value: unknown) {
  for (const fn of listeners) fn(key, value);
  try {
    localStorage.setItem('dfend.' + key, JSON.stringify(value));
  } catch {
    /* ignoré */
  }
}
