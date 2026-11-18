/**
 * Jeu d'icônes Facette : un seul style, au trait, d'une couleur (`currentColor`).
 * Quelques icônes portent une couleur par défaut (or, vies) ; le texte autour ne la change pas.
 */
const line = (body: string, color?: string, fill = false) =>
  `<svg class="icon line" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${color ? ` style="color:${color}"` : ''} aria-hidden="true">${body}</svg>`;

const GOLD = 'var(--gold)';
const LIFE = 'var(--life)';
const STAR = 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z';

export const ICON = {
  coin: line('<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.8h5M9.5 14.2h5"/>', GOLD),
  heart: line('<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>', LIFE),
  skull: line('<path d="M12 3.5c-4.4 0-7.5 3-7.5 7 0 2.4 1.1 4 2.8 5v3.5h9.4v-3.5c1.7-1 2.8-2.6 2.8-5 0-4-3.1-7-7.5-7z"/><circle cx="9.2" cy="11" r="1.4"/><circle cx="14.8" cy="11" r="1.4"/><path d="M10.5 19v-2.2M13.5 19v-2.2"/>'),
  horn: line('<path d="M3.5 13.5c6 0 10.5-3 16-8.5v14c-5.5-3.5-10-4.5-16-4.5zM3.5 13.5v4h3.5"/>'),
  bow: line('<path d="M7 3.5c7.5 3 7.5 14 0 17M7 3.5v17M3.5 12h15M15.5 9l3 3-3 3"/>'),
  shield: line('<path d="M12 3.5l7 2.8v5.2c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6.3z"/><path d="M12 7.5v9M8.5 11h7"/>'),
  orb: line('<circle cx="12" cy="9" r="5"/><path d="M7.5 20.5h9M9.5 14l-1 6.5M14.5 14l1 6.5M10.5 7.5l1.5-1.5"/>'),
  cannon: line('<path d="M3.5 13.5l11-6 2.5 4.6-11 6z"/><circle cx="8.5" cy="17.5" r="2.5"/><path d="M17.5 8.5l3-1.5"/>'),
  up: line('<path d="M12 19.5v-15M6 10.5l6-6 6 6"/>'),
  sell: line('<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>', GOLD),
  flag: line('<path d="M6 21V3.5M6 4.5h11l-2.5 4 2.5 4H6"/>'),
  meteor: line('<circle cx="15" cy="15" r="4.5"/><path d="M3.5 3.5l8 8M8 3l5.5 5.5M3 8l5.5 5.5"/>'),
  helmet: line('<path d="M5 16a7 7 0 0 1 14 0v3H5z"/><path d="M12 9v10M8 14h2.5M13.5 14H16M12 9c.5-2.5 2.5-3.5 4.5-3"/>'),
  pause: line('<path d="M9 5.5v13M15 5.5v13"/>'),
  play: line('<path d="M7 5l12 7-12 7z"/>'),
  fast: line('<path d="M4 6.5l7 5.5-7 5.5zM13 6.5l7 5.5-7 5.5z"/>'),
  gear: line('<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'),
  book: line('<path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z"/>'),
  trophy: line('<path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0zM7.5 6H4.5c0 3 1.5 4.5 3.5 4.5M16.5 6h3c0 3-1.5 4.5-3.5 4.5M12 13.5V18M8.5 20h7"/>'),
  star: line(`<path d="${STAR}"/>`, GOLD, true),
  starEmpty: line(`<path d="${STAR}"/>`, 'var(--faint)'),
  gift: line('<rect x="4" y="9" width="16" height="11"/><path d="M3 9h18M12 9v11M12 9c-1.5-4-5.5-3.5-4.5-1M12 9c1.5-4 5.5-3.5 4.5-1"/>'),
  lock: line('<rect x="5.5" y="10.5" width="13" height="9.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  close: line('<path d="M6 6l12 12M18 6L6 18"/>'),
  full: line('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
  down: line('<path d="M6 9l6 6 6-6"/>'),
  users: line('<circle cx="9" cy="8.5" r="3.5"/><path d="M3 20c.5-3.8 3-5.8 6-5.8s5.5 2 6 5.8M15.5 5.5a3 3 0 0 1 0 6M17.5 14.5c2 .6 3.2 2.5 3.5 5.5"/>'),
  chev: line('<path d="M9 5l7 7-7 7"/>'),
  back: line('<path d="M15 5l-7 7 7 7"/>'),
  edit: line('<path d="M15 5l4 4L9 19H5v-4z"/>'),
  help: line('<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 16.5v.5"/>'),
  crown: line('<path d="M4 18.5h16M4.5 16L3.5 7l5 4 3.5-6 3.5 6 5-4-1 9z"/>'),
  tree: line('<circle cx="12" cy="4.5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="19.5" r="2"/><circle cx="18" cy="19.5" r="2"/><path d="M11 6.2L7 10.4M13 6.2l4 4.2M6 14v3.5M18 14v3.5"/>'),
  bag: line('<path d="M6 8.5h12l1.2 11.5H4.8z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>'),
  potion: line('<path d="M10 3.5h4M10.5 3.5v4.2L6.5 14a5.5 5.5 0 1 0 11 0l-4-6.3V3.5"/><path d="M7 14.5h10"/>', LIFE),
  snow: line('<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>', '#3d8fd1'),
  pick: line('<path d="M4 7c5-4.5 11-4.5 16 0"/><path d="M12 4.5L9 21"/><path d="M15.5 16l2 2.5 2.5-1-1-2.5z"/>', GOLD),
  tent: line('<path d="M3 20L12 4l9 16z"/><path d="M12 4v16M9.5 20l2.5-5 2.5 5"/><path d="M12 4V2.5h3"/>'),
  target: line('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
  eye: line('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
  weight: line('<path d="M6.5 9h11l2.5 11H4z"/><circle cx="12" cy="6" r="2.5"/>'),
  regrow: line('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v4h-4"/><path d="M12 9v6M9 12h6"/>'),
  bomb: line('<circle cx="11" cy="14.5" r="6.5"/><path d="M9.5 8.2V6.5h3v1.7"/><path d="M11 6.5c0-2.5 2-3.5 4-2.5"/><path d="M17 2.5v1.5M19.5 4h-1.5M18.6 2.4l-1 1"/><path d="M8 13a3 3 0 0 1 2.5-2"/>'),
};

/** Icône de chaque objet de boutique (même ordre que ITEMS). */
export const ITEM_ICON = [ICON.coin, ICON.potion, ICON.snow, ICON.bomb];
/** Icône de chaque branche de l'arbre de compétences (même ordre que TREE). */
export const BRANCH_ICON = [ICON.bow, ICON.shield, ICON.orb, ICON.cannon, ICON.helmet, ICON.crown];

/** Ancien nom conservé : même jeu d'icônes. */
export const LINE = ICON;

export const FAMILY_ICON = [ICON.bow, ICON.shield, ICON.orb, ICON.cannon, ICON.pick, ICON.tent];
export const FAMILY_NAME = ['Archers', 'Caserne', 'Mages', 'Artillerie', 'Mine', 'Campement'];
/** Couleur de chaque famille de tours (jetons CSS). */
export const FAMILY_COLOR = ['var(--f-arch)', 'var(--f-bar)', 'var(--f-mag)', 'var(--f-art)', 'var(--f-mine)', 'var(--f-camp)'];
/** Icône de chaque propriété d'ennemi (même ordre que TRAITS). */
export const TRAIT_ICONS = [ICON.eye, ICON.weight, ICON.regrow];
/** Couleur de chaque propriété d'ennemi. */
export const TRAIT_COLOR = ['#3f9a7a', '#7d8792', '#4caf50'];

/** Une icône par compétence de héros (clé `icon` des données). */
export const SKILL_ICON: Record<string, string> = {
  charge: line('<path d="M14.5 4.5h5v5L9 20l-5-5z"/><path d="M7 12l5 5M4 20l2-2"/>'),
  rally: line('<path d="M4 10h3l7-4.5v13L7 14H4z"/><path d="M17.5 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
  ultSword: line('<path d="M12 3l2 5.5 5.5-2-2.5 5.5 4 3-5.5.5L14 21l-2-4.5L10 21l-1.5-5.5L3 15l4-3-2.5-5.5 5.5 2z"/>'),
  pierce: line('<path d="M3 12h15M15 8l4 4-4 4"/><path d="M7 8.5v7M11 8.5v7"/>'),
  rain: line('<path d="M7 3v6M12 3v8M17 3v6M5 13l2 7M10 13l2 7M15 13l2 7"/>'),
  dawn: line('<path d="M4 17h16M7 17a5 5 0 0 1 10 0"/><path d="M12 4v3M5 8l2 2M19 8l-2 2"/>'),
  hammer: line('<path d="M4 9l5-5 4 4-5 5z"/><path d="M11 10l9 9"/>'),
  turret: line('<rect x="6" y="13" width="12" height="7"/><path d="M9 13v-3h6v3M15 11.5h5"/>'),
  flame: line('<path d="M12 21c-4 0-6.5-2.6-6.5-6 0-3.5 3-5.5 3.5-9 2 1.5 3 3 3 5 1-1 1.5-2 1.5-3.5 2.5 2 4.5 4.5 4.5 7.5 0 3.4-2 6-6 6z"/>'),
  bones: line('<path d="M6 18L18 6M6 6l12 12"/><circle cx="5" cy="5" r="1.6"/><circle cx="19" cy="19" r="1.6"/><circle cx="19" cy="5" r="1.6"/><circle cx="5" cy="19" r="1.6"/>'),
  drain: line('<path d="M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10z"/><path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5"/>'),
  army: line('<path d="M8 4.5c-2.5 0-4 1.6-4 3.8 0 1.3.6 2.2 1.5 2.7V13h5v-2c.9-.5 1.5-1.4 1.5-2.7 0-2.2-1.5-3.8-4-3.8z"/><path d="M16 10.5c-2.5 0-4 1.6-4 3.8 0 1.3.6 2.2 1.5 2.7V19h5v-2c.9-.5 1.5-1.4 1.5-2.7 0-2.2-1.5-3.8-4-3.8z"/>'),
  strike: line('<path d="M5 19L15 9M13 5l6 6M16.5 3.5l4 4"/><path d="M3 13l3 1M10 21l-1-3M2 18l2-1"/>'),
  breath: line('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/><path d="M12 10v5M9.5 12.5h5"/>'),
  spin: line('<path d="M12 4a8 8 0 1 1-7.4 5"/><path d="M4 4v5h5"/><path d="M12 8l1 4-1 4"/>'),
  bulwark: line('<path d="M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z"/><path d="M8 11h8M8 15h8"/>'),
  fireball: line('<circle cx="14" cy="10" r="5"/><path d="M10 13.5L4 20M9 10l-5 3M14 15l-3 5"/>'),
  nova: line('<path d="M12 2v20M3.5 7l17 10M3.5 17l17-10"/><circle cx="12" cy="12" r="3"/>'),
  meteor: line('<circle cx="15" cy="15" r="5"/><path d="M11 11L3 3M13 9.5L8 3M9.5 13L3 8"/>'),
  acid: line('<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>'),
  elixir: line('<path d="M10 3h4M10.5 3v4.5a6 6 0 1 0 3 0V3"/><path d="M12 12v5M9.5 14.5h5"/>'),
  transmute: line('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5L19.5 16h-15z"/><circle cx="12" cy="12" r="2.5"/>'),
  bomb: line('<circle cx="10.5" cy="14" r="6.5"/><path d="M15 9.5l2.5-2.5M17 4.5l1 1.5 1.8.2-1.3 1.2.4 1.8"/>'),
  passive: line('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'),
};
