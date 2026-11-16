/** Génère docs/modeles-3d.md (liste des modèles à produire dans Higgsfield) à partir du catalogue. */
import { writeFileSync } from 'node:fs';
import { CATALOG, type CatalogEntry } from './catalog';

const GROUPS: Record<CatalogEntry['group'], string> = {
  heros: 'Héros', boss: 'Boss', ennemis: 'Ennemis', soldats: 'Soldats et unités', tours: 'Tours', decor: 'Décor', batiments: 'Bâtiments (porte, entrées)',
};
const ANIM: Record<CatalogEntry['anim'], string> = {
  rig: 'rig Meshy (jambes/bras depuis le squelette)', biped: 'bipède (découpe automatique)', quad: 'quadrupède', flyer: 'ailes', blob: 'masse (rebond)', sway: 'balancement (végétation)', static: 'statique',
};

let md = `# Modèles 3D à générer dans Higgsfield

Ce fichier est généré par \`pnpm models:prompts\` à partir de \`tools/models/catalog.ts\`. Ne le modifiez pas à la main.

## Procédure

1. Dans Higgsfield, ouvrez **3D → Meshy 7 Image to 3D** (ou **Meshy 6 Text to 3D** pour partir du texte).
   - Si vous passez par une image : générez-la d'abord (Soul ou Nano Banana) avec le prompt ci-dessous,
     **vue de face, fond uni gris, pas d'ombre portée, personnage entier**.
2. Réglages recommandés :
   - \`model_type\` : **lowpoly**, \`target_polycount\` : **6000** (le jeu re-décime ensuite au budget indiqué),
   - \`should_texture\` : **oui**, \`enable_pbr\` : **non**, \`symmetry_mode\` : auto,
   - personnages (colonne « rig ») : \`pose_mode\` : **a-pose**, \`enable_rigging\` : **oui**, \`rigging_height_meters\` : 1.7,
     \`enable_animation\` : non (les animations sont procédurales dans le jeu),
   - tours, décor, bâtiments : pas de rig.
3. Téléchargez le **GLB** et enregistrez-le sous le nom indiqué dans \`assets/models-src/\` (dossier ignoré par git).
4. \`pnpm models:bake\` puis \`pnpm dev\` : le modèle remplace l'art en code. Un modèle absent garde l'art en code.
5. Le modèle doit **regarder vers +Z** (vers le bas de l'écran à l'orientation 0). S'il marche à reculons ou de côté,
   ajoutez \`yaw: 180\` (ou 90 / -90) à son entrée du catalogue puis relancez la cuisson.

Un seul matériau et une seule texture par modèle (c'est ce que Meshy produit par défaut) : sinon la texture est cuite
dans les couleurs de sommets (moins fin).

Budget : 81 modèles (les variantes de décor sont optionnelles). Priorité conseillée : héros → boss → ennemis fréquents (gobelin, loup, brute) → tours → décor.
`;

for (const g of Object.keys(GROUPS) as CatalogEntry['group'][]) {
  const list = CATALOG.filter((e) => e.group === g);
  if (!list.length) continue;
  md += `\n## ${GROUPS[g]} (${list.length})\n\n`;
  for (const e of list) {
    md += `### ${e.label}\n\n`;
    md += `- Fichier : \`assets/models-src/${e.src}\` · clé \`${e.key}\`\n`;
    md += `- Hauteur en jeu : ${e.height} · budget : ${e.tris} triangles · texture ${e.tex} px · animation : ${ANIM[e.anim]}${e.anim === 'rig' ? ' → **rig Meshy, A-pose**' : ''}\n`;
    md += `- Prompt :\n\n  > ${e.prompt}\n\n`;
  }
}
writeFileSync(new URL('../../docs/modeles-3d.md', import.meta.url), md);
console.log(`docs/modeles-3d.md : ${CATALOG.length} modèles`);
