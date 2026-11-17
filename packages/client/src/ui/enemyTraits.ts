import type { EnemyDef } from '@dfend/shared';

/** Particularités d'un ennemi, en mots courts (aperçu de vague, encyclopédie). */
export function enemyTraits(d: EnemyDef): string[] {
  const t: string[] = [];
  if (d.boss) t.push('boss');
  if (d.flying) t.push('volant');
  if (d.armor >= 0.45) t.push('blindé');
  if (d.mres >= 0.45) t.push('anti-magie');
  if (d.speed >= 2.2) t.push('rapide');
  const a = d.ab;
  if (a.heal) t.push('soigne');
  if (a.regen && !d.boss) t.push('régénère');
  if (a.stunTowers) t.push('étourdit les tours');
  if (a.kamikaze) t.push('explose');
  if (a.split) t.push('se divise');
  if (a.burrow) t.push('creuse');
  if (a.summon && !d.boss) t.push('invoque');
  if (a.shield) t.push('protège');
  if (a.enrage) t.push('enragé');
  return t;
}

const svg = (body: string) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

/** Pictogramme de chaque trait (affiché en pastille sur le portrait de l'ennemi). */
export const TRAIT_ICON: Record<string, string> = {
  boss: svg('<path d="M4 17l-1-9 5 4 4-7 4 7 5-4-1 9z" fill="currentColor"/><path d="M4 20h16"/>'),
  volant: svg('<path d="M3 13c3-6 9-8 18-8-2 3-4 5-7 6 2 0 4 0 6-1-3 4-7 6-12 6-2 0-4-1-5-3z" fill="currentColor"/>'),
  blindé: svg('<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" fill="currentColor"/>'),
  'anti-magie': svg('<path d="M12 3l2 6 6 .5-4.7 3.8L17 20l-5-3.4L7 20l1.7-6.7L4 9.5 10 9z" fill="currentColor"/>'),
  rapide: svg('<path d="M13 2L5 14h6l-1 8 8-12h-6z" fill="currentColor"/>'),
  soigne: svg('<path d="M12 5v14M5 12h14" stroke-width="4"/>'),
  régénère: svg('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" fill="currentColor"/>'),
  'étourdit les tours': svg('<path d="M12 12m-2 0a2 2 0 1 0 4 0a4 4 0 1 0-8 0a6 6 0 1 0 12 0"/>'),
  explose: svg('<path d="M12 2l2 6 6-3-3 6 5 3-6 1 1 7-5-5-5 5 1-7-6-1 5-3-3-6 6 3z" fill="currentColor"/>'),
  'se divise': svg('<circle cx="8" cy="12" r="4.5" fill="currentColor"/><circle cx="17" cy="12" r="3.5" fill="currentColor"/>'),
  creuse: svg('<path d="M3 17c3-4 15-4 18 0z" fill="currentColor"/><path d="M12 3v8M8 8l4 4 4-4"/>'),
  invoque: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>'),
  protège: svg('<path d="M4 18a8 8 0 0 1 16 0z" fill="currentColor"/>'),
  enragé: svg('<path d="M12 2c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 1 2 2 2 3 2-1-3 0-5 0-7z" fill="currentColor"/>'),
};
