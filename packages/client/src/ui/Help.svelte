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
      <li>Clic droit n’importe où pour le déplacer (ou sélectionnez-le, puis cliquez au sol). Il bloque et combat les ennemis et gagne des niveaux.</li>
      <li>Ses compétences se débloquent aux niveaux 1, 3 et 5 : <span class="kbd">{keyLabel(keys.skill1)}</span> <span class="kbd">{keyLabel(keys.skill2)}</span> <span class="kbd">{keyLabel(keys.ult)}</span>.</li>
    </ul>
    <h3>Sorts et vagues</h3>
    <ul>
      <li><span class="kbd">{keyLabel(keys.spell1)}</span> Pluie de météores et <span class="kbd">{keyLabel(keys.spell2)}</span> Renforts : choisissez ensuite un point sur la carte.</li>
      <li>Le bouton rouge au début du chemin appelle la vague suivante. L’appeler en avance rapporte de l’or et recharge les sorts.</li>
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
  .box { width: min(680px, 100%); max-height: 86vh; }
  .head { display: flex; justify-content: space-between; align-items: center; }
  h2, h3 { margin: 0; }
  h3 { margin-top: 12px; }
  p, ul { margin: 6px 0; line-height: 1.45; }
</style>
