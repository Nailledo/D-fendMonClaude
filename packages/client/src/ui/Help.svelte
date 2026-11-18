<script lang="ts">
  import { keyLabel, keys } from '../settings';
  import { ui } from '../state.svelte';
</script>

<div class="overlay-bg">
  <div class="panel box scroll">
    <div class="head"><h2>Comment jouer</h2><button class="btn small" onclick={() => (ui.overlay = null)}>Fermer</button></div>
    <h3>Le principe</h3>
    <p>Empêchez les ennemis d’atteindre la porte au bout du chemin. Chaque ennemi qui passe vous coûte des vies, et la partie est perdue à zéro.</p>
    <h3>Construire</h3>
    <ul>
      <li>Cliquez (ou touchez) un <b>emplacement de pierre</b> : un menu circulaire propose six bâtiments. Au tactile, un premier appui sur une tour montre sa portée et son prix, un second la construit.</li>
      <li><b>Archers</b> : rapides, touchent les volants. <b>Caserne</b> : des soldats bloquent les ennemis au sol. <b>Mages</b> : ignorent l’armure. <b>Artillerie</b> : dégâts de zone.</li>
      <li><b>Mine</b> : ne tire pas, mais rapporte de l’or au début de chaque vague ; sa spécialisation Ferme royale soigne la porte ou enrichit vos alliés. <b>Campement</b> : augmente la portée et la cadence des tours voisines ; la Tour de guet repère aussi les camouflés. Investir tôt rapporte, mais laisse le chemin moins défendu.</li>
      <li><b>Priorité de ciblage</b> : chaque tour qui tire vise par défaut l’ennemi le plus avancé (« Premier »). Le bouton cible du menu circulaire, ou <span class="kbd">{keyLabel(keys.prio)}</span>, la fait passer à « Dernier », « Plus fort » ou « Plus proche ».</li>
      <li>Cliquez sur une tour pour l’améliorer (3 niveaux), puis choisir l’une des deux <b>spécialisations</b> et acheter ses compétences.</li>
      <li>La revente rend 60 % de l’investissement, ou 100 % pendant 3 secondes après un achat.</li>
    </ul>
    <h3>Ennemis particuliers</h3>
    <ul>
      <li>Une vague peut doter des ennemis d’une propriété, visible dans l’aperçu de la vague :</li>
      <li><b>Camouflé</b> : les tours et soldats ne le voient que près d’une tour de mages, d’une tour de guet ou de votre héros. Les explosions et les sorts le touchent quand même.</li>
      <li><b>Cuirassé de plomb</b> (gris) : flèches et lames ricochent ; préférez la magie, l’artillerie et les sorts.</li>
      <li><b>Régénérant</b> (pulsation verte) : il se soigne s’il n’est pas blessé pendant un moment ; le poison et la brûlure l’en empêchent.</li>
    </ul>
    <h3>Votre héros</h3>
    <ul>
      <li>Clic droit n’importe où pour le déplacer (au tactile : appui long), ou sélectionnez-le puis touchez le sol. Il bloque et combat les ennemis et gagne des niveaux.</li>
      <li>Clic droit sur un ennemi (au tactile : appui long dessus, ou sélectionnez le héros puis touchez l’ennemi) pour l’attaquer : un héros de mêlée fonce au contact, un héros à distance se place juste à portée de tir. Un anneau rouge marque la cible ; un nouvel ordre de déplacement l’annule.</li>
      <li><b>Apparence et classe</b> : l’apparence (Samuel, Patoche, Matéo, William) ne change rien aux pouvoirs. Sans vocation, le héros est un Aventurier (Coup puissant, Second souffle). Chaque niveau de l’histoire réussi donne un <b>point de héros</b> (un de plus en Vétéran ou Cauchemar) à dépenser dans l’<b>arbre du héros</b> : Épéiste, Gardien, Archer, Mage, Nécromancien, Alchimiste ou Ingénieur, chacun avec sa chaîne vocation → passif → compétence → passif → ultime, plus l’Entraînement commun. Une seule classe à la fois ; la réinitialisation est gratuite.</li>
      <li>En partie, les compétences se débloquent aux niveaux 1, 3 et 5 du héros : <span class="kbd">{keyLabel(keys.skill1)}</span> <span class="kbd">{keyLabel(keys.skill2)}</span> <span class="kbd">{keyLabel(keys.ult)}</span>.</li>
    </ul>
    <h3>Sorts et vagues</h3>
    <ul>
      <li><span class="kbd">{keyLabel(keys.spell1)}</span> Pluie de météores et <span class="kbd">{keyLabel(keys.spell2)}</span> Renforts : choisissez ensuite un point sur la carte.</li>
      <li>Le bouton rouge au début du chemin appelle la vague suivante ; survolez-le (ou touchez-le une fois) pour voir les ennemis qui arrivent. L’appeler en avance rapporte de l’or à chaque joueur et recharge les sorts.</li>
    </ul>
    <h3>Atelier : compétences et boutique</h3>
    <ul>
      <li>Les <b>étoiles</b> gagnées en partie se dépensent dans l’<b>Atelier</b> (menu principal, carte de campagne, fin de partie). Elles viennent des niveaux de l’histoire (jusqu’à 3 par niveau et par difficulté), de la survie (1 toutes les 5 vagues) et des victoires sur un niveau déjà parfait (+1).</li>
      <li><b>Arbre de compétences</b> : six branches (Archers, Casernes, Mages, Artillerie, Héros, Royaume) de cinq rangs, à apprendre dans l’ordre. Les bonus sont permanents ; l’arbre peut être réinitialisé à tout moment, toutes ses étoiles sont rendues.</li>
      <li><b>Boutique</b> : bourse d’or, potion de vie, fiole de givre et bombe, à usage unique. Ils apparaissent en partie à côté des sorts ; la fiole et la bombe se lancent sur la carte.</li>
    </ul>
    <h3>En coopération</h3>
    <ul>
      <li>Chaque joueur a son or et ses tours (bannières à sa couleur). Les vies sont communes.</li>
      <li>Les ennemis ont plus de PV et sont plus nombreux selon le nombre de joueurs.</li>
      <li><b>Alt + clic</b> pour signaler un point à vos alliés, <span class="kbd">{keyLabel(keys.chat)}</span> pour discuter, et le bouton cadeau pour donner 50 or.</li>
    </ul>
    <h3>Caméra</h3>
    <p>Molette pour zoomer vers le curseur, glisser (clic gauche, droit ou molette) pour déplacer, flèches du clavier.</p>
    <p>Au tactile : glissez un doigt pour déplacer la carte, pincez à deux doigts pour zoomer, touchez deux fois le terrain pour zoomer ou revenir à la vue d’ensemble. En portrait, la carte pivote pour occuper toute la hauteur.</p>
  </div>
</div>

<style>
  .box { width: min(700px, 100%); max-height: 88vh; }
  .head { display: flex; justify-content: space-between; align-items: center; }
  h2 { margin: 0; font-size: 2em; }
  h3 { margin: 18px 0 4px; font-size: 1.4em; color: var(--gold); }
  p, ul { margin: 6px 0; line-height: 1.5; max-width: 66ch; }
  ul { padding-left: 20px; }
  li { margin: 4px 0; }
  li::marker { color: var(--gold); }
</style>
