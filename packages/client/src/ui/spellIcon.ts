import { SPELLS } from '@dfend/shared';
import { SPELL_ICON } from './icons';

/** Clé de l'icône 3D d'un sort (index de SPELLS) : les deux sorts d'origine gardent leurs clés historiques. */
export function spellKey(i: number): string {
  return i === 0 ? 'meteor' : i === 1 ? 'reinforce' : `spell_${SPELLS[i]?.id ?? 'meteor'}`;
}
/** Icône de secours (SVG) d'un sort. */
export function spellFb(i: number): string {
  return SPELL_ICON[i] ?? SPELL_ICON[0];
}
