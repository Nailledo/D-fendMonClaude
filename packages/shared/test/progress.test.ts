import { describe, expect, it } from 'vitest';
import { emptyProgress, isFreshProgress, mergeProgress, progressEarned, sanitizeProgress, treeCost, type Progress } from '../src';

const p = (o: Partial<Progress>): Progress => ({ ...emptyProgress(), ...o });

describe('sanitizeProgress', () => {
  it('borne les valeurs et écarte les types invalides', () => {
    const s = sanitizeProgress({ unlocked: -3, stars: [[9, 2, 'x'], 'nope'], seen: ['orc', 'orc', 42, '<script>'], tree: [99], shopSpent: NaN, finished: 'yes' });
    expect(s.unlocked).toBe(0);
    expect(s.stars).toEqual([[3, 2, 0], []]);
    expect(s.seen).toEqual(['orc']);
    expect(s.tree[0]).toBe(5);
    expect(s.shopSpent).toBe(0);
    expect(s.finished).toBe(false);
  });
  it('accepte une valeur qui n’est pas un objet', () => {
    expect(isFreshProgress(sanitizeProgress(null))).toBe(true);
  });
});

describe('mergeProgress', () => {
  it('une progression vierge prend celle de l’autre côté', () => {
    const remote = p({ unlocked: 4, stars: [[3], [2]], tree: [1], shopSpent: 2 });
    expect(mergeProgress(emptyProgress(), remote, 999, 1)).toEqual(sanitizeProgress(remote));
    expect(mergeProgress(remote, emptyProgress(), 1, 999)).toEqual(sanitizeProgress(remote));
  });

  it('garde le meilleur de ce qui se gagne', () => {
    const local = p({ unlocked: 2, stars: [[3, 1], [2]], seen: ['orc'], seenPrologue: true, bonusStars: 4 });
    const remote = p({ unlocked: 5, stars: [[1, 3], [0, 2], [1]], seen: ['wolf'], finished: true, bonusStars: 1 });
    const m = mergeProgress(local, remote, 10, 20);
    expect(m.unlocked).toBe(5);
    expect(m.stars).toEqual([[3, 3], [2, 2], [1]]);
    expect(m.seen.sort()).toEqual(['orc', 'wolf']);
    expect(m.seenPrologue && m.finished).toBe(true);
    expect(m.bonusStars).toBe(4);
  });

  it('les dépenses viennent du côté le plus récent', () => {
    const local = p({ stars: [[3, 3, 3]], tree: [1, 0], items: [2], shopSpent: 4 });
    const remote = p({ stars: [[3, 3, 3]], tree: [0, 1], items: [0, 1], shopSpent: 3 });
    expect(mergeProgress(local, remote, 50, 20).items[0]).toBe(2);
    const m = mergeProgress(local, remote, 10, 20);
    expect(m.items.slice(0, 2)).toEqual([0, 1]);
    expect(m.shopSpent).toBe(3);
    expect(m.tree.slice(0, 2)).toEqual([0, 1]);
  });

  it('ne laisse jamais un solde d’étoiles négatif', () => {
    const local = p({ stars: [[1]], seen: ['orc'] });
    const remote = p({ stars: [[1]], tree: [5, 5, 5], seen: ['orc'] });
    const m = mergeProgress(local, remote, 1, 2);
    expect(progressEarned(m) - m.shopSpent - treeCost(m.tree)).toBeGreaterThanOrEqual(0);
  });
});
