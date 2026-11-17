export type Speaker = 'samuel' | 'ethan' | 'kessin' | 'roi' | 'lyra' | 'brom' | 'nox' | 'grolbak' | 'vasiere' | 'narrateur' | 'corbeau';

export interface Line {
  who: Speaker;
  text: string;
}

export const SPEAKERS: Record<Speaker, { name: string; color: string }> = {
  samuel: { name: 'Samuel', color: '#6aa8ff' },
  ethan: { name: 'Princesse Ethan', color: '#f472b6' },
  kessin: { name: 'Kessin', color: '#f26464' },
  roi: { name: 'Le Roi Gontran', color: '#f2c94c' },
  lyra: { name: 'Lyra', color: '#6fcf74' },
  brom: { name: 'Brom', color: '#e0954a' },
  nox: { name: 'Nox', color: '#b48cff' },
  grolbak: { name: 'Grôlbak', color: '#a3d65c' },
  vasiere: { name: 'Mère Vasière', color: '#8fbf5a' },
  narrateur: { name: 'Narrateur', color: '#c9bba4' },
  corbeau: { name: 'Corbeau messager', color: '#a5b4c8' },
};

export interface LevelStory {
  intro: Line[];
  /** dialogues déclenchés au début d'une vague donnée */
  waves?: Record<number, Line[]>;
  outro: Line[];
}

export const PROLOGUE: Line[] = [
  { who: 'narrateur', text: 'Royaume d’Aubeclair. Le grand bal d’été bat son plein. Les violons jouent, les petits fours circulent.' },
  { who: 'narrateur', text: 'Soudain, les chandeliers s’éteignent. Une odeur de soufre envahit la salle. Quelqu’un a encore oublié de fermer le portail des Enfers.' },
  { who: 'kessin', text: 'Bonsoir, mortels ! Je suis Kessin, Seigneur des Cendres. Je ne reste pas, je prends juste… la princesse.' },
  { who: 'ethan', text: 'Lâchez-moi, espèce de chèvre carbonisée !' },
  { who: 'kessin', text: 'Charmante. Le pouvoir qui dort en toi m’ouvrira les portes du monde. Ah ah ah ! *disparaît dans un nuage de fumée*' },
  { who: 'roi', text: 'MA FILLE ! Gardes ! Chevaliers ! Quelqu’un ! … Où sont passés tous mes chevaliers ?' },
  { who: 'samuel', text: '*revient avec une assiette de petits fours* J’ai raté quelque chose ?' },
  { who: 'roi', text: 'Samuel. Tu es le dernier chevalier debout. Ramène-moi ma fille, et… pose ces petits fours.' },
  { who: 'samuel', text: 'Je le jure sur mon épée, Majesté. Et sur les petits fours. Surtout ceux à la framboise.' },
];

export const STORY: LevelStory[] = [
  {
    intro: [
      { who: 'samuel', text: 'Le pont d’Aubeclair ! Les gobelins de Kessin vont essayer de le traverser pour piller le château.' },
      { who: 'samuel', text: 'Je dois construire des défenses sur les emplacements le long du chemin. Les archers, c’est un bon début.' },
      { who: 'narrateur', text: 'Astuce : cliquez sur un emplacement pour construire. Cliquez sur Samuel puis sur le sol pour le déplacer (ou clic droit).' },
    ],
    waves: {
      3: [{ who: 'samuel', text: 'Des loups ! Ils courent vite. Mes soldats de caserne pourront les bloquer.' }],
      6: [{ who: 'samuel', text: 'Une brute en armure… Les flèches ricochent dessus. Il me faudrait de la magie.' }],
    },
    outro: [
      { who: 'samuel', text: 'Le pont tient ! Mais Kessin est loin. Il faut avancer.' },
      { who: 'corbeau', text: 'Croâ ! Message de la princesse : « Samuel, si tu lis ça, dépêche-toi. Ce démon chante faux sous la douche. »' },
    ],
  },
  {
    intro: [
      { who: 'samuel', text: 'Les moulins du Val. Deux chemins se rejoignent ici… Ça va être sportif.' },
      { who: 'lyra', text: 'Sportif, oui. Surtout pour toi, chevalier. Tu fais autant de bruit qu’une armoire qui dévale un escalier.' },
      { who: 'samuel', text: 'Qui va là ?!' },
      { who: 'lyra', text: 'Lyra, archère de la forêt. Ces gobelins ont brûlé mes arbres. Je viens avec toi. Essaie de suivre.' },
    ],
    waves: {
      3: [{ who: 'lyra', text: 'Des corbeaux de guerre ! Tes soldats ne peuvent pas les atteindre. Archers et mages, vite !' }],
      5: [{ who: 'samuel', text: 'Ce chaman soigne les autres. Il faut l’abattre en premier !' }],
    },
    outro: [
      { who: 'lyra', text: 'Pas mal, pour une armoire.' },
      { who: 'samuel', text: 'Merci ! … Attends, c’était un compliment ?' },
    ],
  },
  {
    intro: [
      { who: 'narrateur', text: 'Au cœur de la forêt se tient le campement du terrible Grôlbak, chef de tous les gobelins.' },
      { who: 'grolbak', text: 'GRÔLBAK A FAIM ! GRÔLBAK VA MANGER LE PETIT CHEVALIER ! ET SES PETITS FOURS !' },
      { who: 'samuel', text: 'Personne ne touche à mes petits fours.' },
    ],
    waves: {
      14: [{ who: 'grolbak', text: 'ASSEZ ! GRÔLBAK S’EN OCCUPE LUI-MÊME !' }, { who: 'lyra', text: 'Concentre tout sur lui, Samuel. Et ne te fais pas écraser.' }],
    },
    outro: [
      { who: 'grolbak', text: 'Grôlbak… vaincu… Kessin a promis… beaucoup de cuillères…' },
      { who: 'samuel', text: 'Pourquoi Kessin veut-il la princesse ?' },
      { who: 'grolbak', text: 'Princesse a pouvoir… très ancien… Kessin veut ouvrir… la Grande Porte… *s’endort*' },
      { who: 'lyra', text: 'Il dort ou il est vaincu ?' },
      { who: 'samuel', text: 'Les deux, je crois. Direction le marais de Brumenoire.' },
    ],
  },
  {
    intro: [
      { who: 'samuel', text: 'Le marais de Brumenoire. On n’y voit pas à trois pas et ça sent le vieux chou.' },
      { who: 'brom', text: 'C’est pas le marais, gamin. C’est mon fromage. Brom, forgeron. Kessin m’a volé ma forge pour fabriquer ses armures.' },
      { who: 'brom', text: 'Je viens avec vous. J’ai un marteau et une rancune très tenace.' },
    ],
    waves: {
      2: [{ who: 'brom', text: 'Des crapauds-bombes ! Gardez vos soldats loin d’eux, ou alors acceptez de les perdre.' }],
      4: [{ who: 'lyra', text: 'Une sorcière ! Elle paralyse nos tours. Et la magie lui fait à peine des chatouilles.' }],
    },
    outro: [
      { who: 'corbeau', text: 'Croâ ! Message de la princesse : « J’ai crocheté ma serrure avec une épingle à cheveux. Puis Kessin a mis une deuxième serrure. Puis une troisième. Apportez des épingles. »' },
      { who: 'samuel', text: 'Elle se débrouille drôlement bien.' },
      { who: 'brom', text: 'Mieux que toi, gamin.' },
    ],
  },
  {
    intro: [
      { who: 'nox', text: 'Arrêtez-vous, voyageurs. Ce marais appartient à Mère Vasière. Personne n’en ressort vivant.' },
      { who: 'samuel', text: 'Et vous êtes… ?' },
      { who: 'nox', text: 'Nox. Ancienne nécromancienne. Repentie. Enfin, presque. Mère Vasière garde le passage vers les Terres de Cendre. Je vais vous aider à la noyer dans sa propre vase.' },
      { who: 'brom', text: 'Une nécromancienne. Génial. Ne réveille pas mon grand-père, il était insupportable.' },
    ],
    waves: {
      15: [{ who: 'vasiere', text: 'Qui ose troubler mes eaux ? Je vais vous engloutir, petits êtres de chair !' }, { who: 'nox', text: 'C’est elle. Elle régénère et paralyse les tours. Frappez fort et vite !' }],
    },
    outro: [
      { who: 'vasiere', text: 'Kessin… m’avait promis… un marais éternel…' },
      { who: 'nox', text: 'Les promesses des démons ne valent rien. Je suis bien placée pour le savoir.' },
      { who: 'samuel', text: 'La route vers les Terres de Cendre est ouverte. Tiens bon, Ethan.' },
    ],
  },
  {
    intro: [
      { who: 'narrateur', text: 'Les Terres de Cendre. Ici, le ciel brûle et la terre fume. Même les cailloux ont l’air de mauvaise humeur.' },
      { who: 'kessin', text: '*projection démoniaque* Tiens, tiens. Le chevalier aux petits fours. Tu es venu jusqu’ici ? C’est mignon.' },
      { who: 'samuel', text: 'Rends-moi la princesse, Kessin !' },
      { who: 'kessin', text: 'Non. Mes légions vont te transformer en barbecue. Bon appétit !' },
    ],
    waves: {
      8: [{ who: 'brom', text: 'Un golem de lave ! Les flèches n’y feront rien, il faut des mages ou de l’artillerie lourde !' }],
    },
    outro: [
      { who: 'ethan', text: '*voix lointaine* Samuel ! Je sens que tu approches ! Le démon devient nerveux, il a renversé son thé trois fois !' },
      { who: 'samuel', text: 'J’arrive, princesse !' },
    ],
  },
  {
    intro: [
      { who: 'samuel', text: 'Les remparts de la Citadelle. Une fois passés, nous serons devant Kessin.' },
      { who: 'lyra', text: 'Des chevaliers infernaux. Ils résistent à tout.' },
      { who: 'nox', text: 'À tout, sauf à beaucoup de tout à la fois.' },
    ],
    waves: {
      10: [{ who: 'kessin', text: 'Pourquoi ne meurs-tu pas ?! J’ai payé ces gargouilles très cher !' }],
    },
    outro: [
      { who: 'brom', text: 'La porte de la salle du trône. Elle est en acier démoniaque… J’en ferais bien une enclume.' },
      { who: 'samuel', text: 'Plus tard, Brom. On a une princesse à sauver.' },
    ],
  },
  {
    intro: [
      { who: 'kessin', text: 'Enfin. Le chevalier et sa bande de bras cassés.' },
      { who: 'ethan', text: '*enchaînée près du trône* Samuel ! Il veut utiliser mon pouvoir pour ouvrir la Grande Porte des Enfers !' },
      { who: 'samuel', text: 'Kessin ! Au nom du roi, des petits fours et de la princesse : rends-toi !' },
      { who: 'kessin', text: 'Me rendre ? Je vais te montrer ce que vaut un vrai démon !' },
    ],
    waves: {
      16: [
        { who: 'kessin', text: 'ASSEZ JOUÉ ! JE M’EN OCCUPE MOI-MÊME !' },
        { who: 'ethan', text: 'Samuel, il a trois formes ! Quand il s’envole, seules les tours qui tirent en l’air peuvent le toucher !' },
      ],
    },
    outro: [
      { who: 'kessin', text: 'Impossible… vaincu… par un chevalier… qui sent la framboise…' },
      { who: 'ethan', text: '*brise ses chaînes* Ça, c’est pour la serrure numéro trois !' },
      { who: 'samuel', text: 'Princesse Ethan ! Vous êtes sauvée !' },
      { who: 'ethan', text: 'Sauvée ? Je m’étais presque évadée toute seule. Mais merci d’être venu. Vraiment.' },
      { who: 'narrateur', text: 'Et c’est ainsi que Samuel ramena la princesse Ethan au royaume d’Aubeclair, où un grand banquet fut donné.' },
      { who: 'samuel', text: 'Il reste des petits fours ?' },
      { who: 'roi', text: 'SAMUEL.' },
      { who: 'narrateur', text: 'FIN… ou presque. Dans les profondeurs, une petite flamme cornue continue de brûler. Le mode Survie vous attend.' },
    ],
  },
];
