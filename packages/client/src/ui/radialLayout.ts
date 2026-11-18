import type { Selection } from '../state.svelte';

/**
 * Rayon du menu radial : plus grand quand il porte plus d'options (six bâtiments à construire,
 * ou deux spécialisations / compétences en haut avec la priorité ou le ralliement sur le côté),
 * pour que les médaillons et leurs prix ne se chevauchent pas.
 */
export function radialRadius(sel: Pick<Selection, 'kind' | 'level'>, touch: boolean, short: boolean): number {
  const base = touch ? (short ? 70 : 82) : 74;
  if (sel.kind === 'build') return base + (short ? 12 : 18);
  if (sel.kind === 'tower' && (sel.level ?? 0) >= 2) return base + (short ? 16 : 24);
  return base;
}
