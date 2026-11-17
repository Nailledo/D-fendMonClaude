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
