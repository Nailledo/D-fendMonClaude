import type { ClassSkill } from '@dfend/shared';
import { ICON, SKILL_ICON as LINE_SKILL } from './icons';
import { PASSIVE_ICON, SKILL_ICON as HERO_SKILL } from './skillIcons';

/** Compétences reprises des anciens héros : leurs icônes 3D (sk_<héros>_<i>) et dessinées. */
const LEGACY: Record<string, [string, number]> = {
  charge: ['samuel', 0], ralliement: ['samuel', 1], ethan: ['samuel', 2],
  perce: ['lyra', 0], pluie: ['lyra', 1], aube: ['lyra', 2],
  marteau: ['brom', 0], tourelle: ['brom', 1],
  os: ['nox', 0], drain: ['nox', 1], armee: ['nox', 2],
};
const LEGACY_PASSIVE: Record<string, string> = { vaillant: 'samuel', oeil: 'lyra', enclume: 'brom', vampire: 'nox' };

/** Icône d'une compétence de classe : clé 3D (si elle existe) et dessin de repli. */
export function skillIcon(s: ClassSkill): { k: string; fb: string } {
  const l = LEGACY[s.id];
  if (l) return { k: `sk_${l[0]}_${l[1]}`, fb: HERO_SKILL[l[0]]?.[l[1]] ?? LINE_SKILL[s.icon] ?? '' };
  return { k: 'cs_' + s.id, fb: LINE_SKILL[s.icon] ?? '' };
}

export function passiveIcon(p: { id: string }): { k: string; fb: string } {
  const h = LEGACY_PASSIVE[p.id];
  if (h) return { k: 'pa_' + h, fb: PASSIVE_ICON[h] ?? LINE_SKILL.passive };
  return { k: 'cp_' + p.id, fb: LINE_SKILL.passive };
}

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** Dessin d'un nœud de l'arbre (clé d'icône des données). */
export const nodeIcon = (key: string) => LINE_SKILL[key] ?? ICON[key as keyof typeof ICON] ?? LINE_SKILL.passive;
