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
      <li>Cliquez sur un <b>emplacement de pierre</b> : un menu circulaire propose quatre tours.</li>
      <li><b>Archers</b> : rapides, touchent les volants. <b>Caserne</b> : des soldats bloquent les ennemis au sol. <b>Mages</b> : ignorent l’armure. <b>Artillerie</b> : dégâts de zone.</li>
      <li>Cliquez sur une tour pour l’améliorer (3 niveaux), puis choisir l’une des deux <b>spécialisations</b> et acheter ses compétences.</li>
      <li>La revente rend 60 % de l’investissement, ou 100 % pendant 3 secondes après un achat.</li>
    </ul>
    <h3>Votre héros</h3>
    <ul>
      <li>Clic droit n’importe où pour le déplacer (au tactile : appui long), ou sélectionnez-le puis touchez le sol. Il bloque et combat les ennemis et gagne des niveaux.</li>
      <li>Ses compétences se débloquent aux niveaux 1, 3 et 5 : <span class="kbd">{keyLabel(keys.skill1)}</span> <span class="kbd">{keyLabel(keys.skill2)}</span> <span class="kbd">{keyLabel(keys.ult)}</span>.</li>
    </ul>
    <h3>Sorts et vagues</h3>
    <ul>
      <li><span class="kbd">{keyLabel(keys.spell1)}</span> Pluie de météores et <span class="kbd">{keyLabel(keys.spell2)}</span> Renforts : choisissez ensuite un point sur la carte.</li>
      <li>Le bouton rouge au début du chemin appelle la vague suivante ; survolez-le (ou touchez-le une fois) pour voir les ennemis qui arrivent. L’appeler en avance rapporte de l’or à chaque joueur et recharge les sorts.</li>
    </ul>
    <h3>En coopération</h3>
    <ul>
      <li>Chaque joueur a son or et ses tours (bannières à sa couleur). Les vies sont communes.</li>
      <li>Les ennemis ont plus de PV et sont plus nombreux selon le nombre de joueurs.</li>
      <li><b>Alt + clic</b> pour signaler un point à vos alliés, <span class="kbd">{keyLabel(keys.chat)}</span> pour discuter, et le bouton cadeau pour donner 50 or.</li>
    </ul>
    <h3>Caméra</h3>
    <p>Molette pour zoomer, glisser (clic gauche, droit ou molette) pour déplacer, flèches du clavier.</p>
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
