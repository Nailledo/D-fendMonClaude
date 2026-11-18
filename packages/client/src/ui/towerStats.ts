import { FAMILIES, SELL_RATIO, TOWERS, campAura, investedCost, mineIncome, perksOf, type Family } from '@dfend/shared';
import { progress } from '../state.svelte';

/** Or par vague d'une mine et bonus d'un campement, avec l'Intendance du joueur (atelier). */
export function ownMineIncome(level: number): number {
  return mineIncome(level, [0, 0], perksOf(progress.tree).mineGold);
}
export function ownCampAura(level: number) {
  const pk = perksOf(progress.tree);
  return campAura(level, [0, 0], pk.campAura, pk.campRange);
}

export interface StatRow {
  label: string;
  /** valeur numérique servant à comparer deux niveaux */
  value: number;
  text: string;
  /** une valeur plus basse est meilleure (cadence, réapparition) */
  lowerIsBetter?: boolean;
}

const num = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const pct = (n: number) => `${Math.round(n * 100)} %`;

/** Statistiques lisibles d'une tour à un niveau donné (0-2, puis 3 et 4 pour les spécialisations). */
export function towerStats(fam: Family, level: number): StatRow[] {
  const t = TOWERS[fam][level];
  if (t.soldiers) {
    const s = t.soldiers;
    return [
      { label: 'Soldats', value: s.count, text: String(s.count) },
      { label: 'PV', value: s.hp, text: String(s.hp) },
      { label: 'Dégâts', value: (s.dmg[0] + s.dmg[1]) / 2, text: `${s.dmg[0]}–${s.dmg[1]}` },
      { label: 'Armure', value: s.armor, text: pct(s.armor) },
      { label: 'Réapparition', value: s.respawn, text: `${s.respawn} s`, lowerIsBetter: true },
    ];
  }
  if (t.income !== undefined) {
    const inc = ownMineIncome(level);
    return [
      { label: 'Or par vague', value: inc, text: `+${inc}` },
      { label: 'Rentabilisée en', value: Math.ceil(investedCost(fam, level) / inc), text: `${Math.ceil(investedCost(fam, level) / inc)} vagues`, lowerIsBetter: true },
    ];
  }
  if (t.aura) {
    const a = ownCampAura(level);
    const rows: StatRow[] = [
      { label: 'Zone d’influence', value: a.r, text: num(a.r) },
      { label: 'Portée des voisines', value: a.range, text: '+' + pct(a.range) },
      { label: 'Cadence des voisines', value: a.rate, text: '+' + pct(a.rate) },
    ];
    if (t.detect) rows.push({ label: 'Repère les camouflés', value: 1, text: 'Oui' });
    return rows;
  }
  const burst = t.burst ?? 1;
  const chain = t.chain ?? 1;
  const dps = ((t.dmg[0] + t.dmg[1]) / 2 / t.cooldown) * burst;
  const rows: StatRow[] = [
    { label: 'Dégâts', value: (t.dmg[0] + t.dmg[1]) / 2, text: `${t.dmg[0]}–${t.dmg[1]}${burst > 1 ? ` ×${burst}` : ''}` },
    { label: 'Cadence', value: t.cooldown, text: `${num(t.cooldown)} s`, lowerIsBetter: true },
    { label: 'Portée', value: t.range, text: num(t.range) },
    { label: 'Dégâts / s', value: dps, text: num(dps) + (chain > 1 ? ` (×${chain} cibles)` : '') },
  ];
  if (t.splash) rows.push({ label: 'Zone', value: t.splash, text: num(t.splash) });
  if (t.slow) rows.push({ label: 'Ralentit', value: t.slow[0], text: `${pct(t.slow[0])} · ${num(t.slow[1])} s` });
  if (t.burn) rows.push({ label: 'Brûlure', value: t.burn[0], text: `${t.burn[0]}/s · ${t.burn[1]} s` });
  return rows;
}

/** Étiquettes courtes décrivant ce que la tour peut toucher. */
export function towerTags(fam: Family, level: number): string[] {
  const t = TOWERS[fam][level];
  if (t.soldiers) return ['Bloque au sol'];
  if (t.income !== undefined) return ['Économie', 'Ne tire pas'];
  if (t.aura) return t.detect ? ['Soutien', 'Détection'] : ['Soutien', 'Ne tire pas'];
  if (fam === 'mage') return [t.hitsAir ? 'Sol + air' : 'Sol uniquement', 'Magique', 'Détection'];
  return [t.hitsAir ? 'Sol + air' : 'Sol uniquement', t.dmgType === 1 ? 'Magique' : 'Physique'];
}

/** Compare deux niveaux, ligne par ligne. */
export function compareStats(fam: Family, from: number, to: number) {
  const a = towerStats(fam, from);
  return towerStats(fam, to).map((r) => {
    const old = a.find((x) => x.label === r.label);
    const better = old ? (r.lowerIsBetter ? r.value < old.value : r.value > old.value) : true;
    const same = old ? Math.abs(r.value - old.value) < 1e-6 : false;
    return { ...r, from: old?.text ?? '—', better: !same && better, worse: !same && !better };
  });
}

/** Or rendu à la revente ; `full` : remboursement intégral (préparation, ou juste après un achat). */
export function sellValue(fi: number, level: number, sk: [number, number], full = false): number {
  const fam = FAMILIES[fi];
  let c = investedCost(fam, level);
  const skills = TOWERS[fam][level].skills;
  if (skills) for (let i = 0; i < 2; i++) for (let r = 0; r < sk[i]; r++) c += skills[i].costs[r];
  return Math.floor(c * (full ? 1 : SELL_RATIO));
}

export const LEVEL_LABEL = ['Niveau 1 sur 3', 'Niveau 2 sur 3', 'Niveau 3 sur 3', 'Spécialisation', 'Spécialisation'];
