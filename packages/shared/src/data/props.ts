import type { Biome } from '../types';

/**
 * Carte interactive : éléments du décor sur lesquels on peut cliquer. Leur place vient de la carte
 * (mapgen, déterministe) ; leur état (prêt, rechargement, pont effondré, secret trouvé) vit dans la simulation.
 */
export enum PropKind {
  /** tonneau de poudre au bord du chemin : il explose, une seule fois par partie */
  Poudre = 0,
  /** camp de mercenaires : on les loue, ils vont barrer le chemin */
  Camp = 1,
  /** clin d'œil caché : on clique plusieurs fois dessus… */
  Secret = 2,
}

export interface MapProp {
  kind: PropKind;
  x: number;
  z: number;
  /** orientation */
  ang: number;
  /** variante (secret : indice dans SECRETS[biome]) */
  v: number;
  /** rayon de clic */
  r: number;
}

export interface PropInfo {
  name: string;
  desc: string;
  /** libellé du bouton */
  act: string;
  cost: number;
}

export const PROP_INFO: PropInfo[] = [
  {
    name: 'Tonneau de poudre', act: 'Allumer la mèche', cost: 0,
    desc: 'Explose : 220 dégâts autour de lui. Il n’y en a qu’un : une seule explosion par partie.',
  },
  {
    name: 'Camp de mercenaires', act: 'Engager', cost: 90,
    desc: 'Trois mercenaires vont barrer le chemin le plus proche pendant 30 secondes.',
  },
  { name: '???', act: '', cost: 0, desc: '' },
];

export const POUDRE_R = 2.8;
export const POUDRE_DMG = 220;
export const CAMP_CD_S = 45;
export const MERC = { n: 3, hp: 150, dmg: [6, 10] as [number, number], armor: 0.25, kind: 4, dur: 30 };
export interface SecretDef {
  id: string;
  name: string;
  /** clics pour le trouver */
  clicks: number;
  gold: number;
  /** réponse à chaque clic avant le dernier */
  steps: string[];
  done: string;
  /** disparaît une fois trouvé */
  vanish?: boolean;
}

/** Clins d'œil cachés, par biome : deux par carte, tirés de cette liste. */
export const SECRETS: Record<Biome, SecretDef[]> = {
  vallee: [
    {
      id: 'mouton', name: 'Un mouton', clicks: 5, gold: 40, vanish: true,
      steps: ['Bêê.', 'Bêêê ?', 'BÊÊÊÊÊ !', 'Le mouton vous fixe intensément.'],
      done: 'Le mouton explose en pièces d’or. Personne ne sait pourquoi.',
    },
    {
      id: 'epee', name: 'L’épée dans le rocher', clicks: 7, gold: 50,
      steps: ['Elle ne bouge pas.', 'Toujours pas.', 'Un léger frémissement…', 'Vous tirez de toutes vos forces.', 'Elle vient !', 'Presque…'],
      done: 'Ce n’était qu’une épée rouillée. Mais quelqu’un avait caché 50 pièces dessous.',
    },
    {
      id: 'puits', name: 'Le vieux puits', clicks: 3, gold: 35,
      steps: ['Plouf.', 'Une voix lointaine : « Encore. »'],
      done: 'Le puits vous rend vos pièces, avec les intérêts.',
    },
  ],
  marais: [
    {
      id: 'grenouille', name: 'Une grenouille', clicks: 4, gold: 40, vanish: true,
      steps: ['Croâ.', 'Croâ ?', 'Elle attend visiblement un baiser.'],
      done: 'Ce n’était pas un prince. Mais elle crache 40 pièces d’or avant de filer.',
    },
    {
      id: 'chaudron', name: 'Un chaudron de sorcière', clicks: 5, gold: 55,
      steps: ['Ça bouillonne.', 'Ça sent l’orteil de troll.', 'Une bulle éclate : « Ne remuez pas ! »', 'Vous remuez.'],
      done: 'Le chaudron recrache un trésor oublié !',
    },
    {
      id: 'champignon', name: 'Le champignon chantant', clicks: 3, gold: 31,
      steps: ['♪ La la la ♪', '♪ LA LA LAAAA ♪'],
      done: 'Fin du concert. Le champignon vous lance une pièce… puis trente autres.',
    },
  ],
  cendre: [
    {
      id: 'oeuf', name: 'Un œuf de dragon', clicks: 6, gold: 60, vanish: true,
      steps: ['Il est tiède.', 'Il bouge !', 'Crac.', 'Crac crac.', 'Un œil vous regarde.'],
      done: 'Un dragonnet éclôt, éternue des étincelles et s’envole. Sa coquille était en or.',
    },
    {
      id: 'couronne', name: 'Un crâne couronné', clicks: 3, gold: 45,
      steps: ['« Qui ose ? »', '« Bon. Prenez-la, ma couronne. »'],
      done: 'Ci-gît le dernier roi qui a cliqué ici. Sa couronne vaut 45 pièces.',
    },
    {
      id: 'enclume', name: 'Une enclume abandonnée', clicks: 5, gold: 50,
      steps: ['Bonnng.', 'BONNNNG.', 'Les gobelins se bouchent les oreilles.', 'Un nain applaudit au loin.'],
      done: 'L’enclume se fend : un forgeron y avait scellé sa paie.',
    },
  ],
};

/** nombre total de secrets (pour le compteur de la progression) */
export const SECRET_TOTAL = Object.values(SECRETS).reduce((n, l) => n + l.length, 0);
