<script lang="ts">
  import { HEROES, HERO_IDS, type HeroId } from '@dfend/shared';
  import { heroName, setHero, setName, ui } from '../state.svelte';
  import { save } from '../storage';

  /** Premier lancement : choix de l'apparence (skin) du héros ; ses pouvoirs viennent ensuite de l'arbre du héros. */
  let pick = $state<HeroId>(ui.hero);
  let name = $state(ui.name);
  function done() {
    setHero(pick);
    if (name.trim()) setName(name.trim());
    save('skinChosen2', true);
    ui.overlay = null;
  }
</script>

<div class="overlay-bg">
  <div class="panel box">
    <h2>Choisissez votre personnage</h2>
    <p class="sub">Ces personnages n’ont pas de nom : le vôtre portera votre pseudo. Ce n’est qu’une apparence : tous débutent en Aventurier, avec les mêmes statistiques et les mêmes compétences. En finissant des niveaux, vous gagnerez des points pour le développer dans l’arbre du héros et le spécialiser dans une classe et l’une de ses trois routes. Vous pourrez changer de personnage à tout moment.</p>
    <label class="pseudo">Votre pseudo <input type="text" maxlength="16" placeholder="Votre pseudo" bind:value={name} /></label>
    <div class="list">
      {#each HERO_IDS as h}
        <button class="hero" class:on={pick === h} onclick={() => (pick = h)} ondblclick={() => { pick = h; done(); }}>
          {#if ui.portraits['full_' + h] || ui.portraits[h]}<img src={ui.portraits['full_' + h] ?? ui.portraits[h]} alt="" />{/if}
          <b>{HEROES[h].title}</b>
        </button>
      {/each}
    </div>
    <p class="desc"><b>{heroName(name)}</b>, {HEROES[pick].title.toLowerCase()}. {HEROES[pick].desc}</p>
    <button class="btn gold big" onclick={done}>Jouer ce personnage</button>
  </div>
</div>

<style>
  .box { width: min(820px, 100%); display: flex; flex-direction: column; gap: 14px; align-items: center; text-align: center; }
  h2 { margin: 0; font-size: 2.1em; }
  .sub, .desc { margin: 0; max-width: 62ch; font-weight: 700; color: var(--muted); line-height: 1.4; }
  .desc { color: var(--text); min-height: 2.8em; }
  .list { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; width: 100%; }
  .hero { cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 6px; background: var(--panel-hi); border: 2.5px solid var(--ink); border-radius: var(--r-sm); box-shadow: 0 3px 0 var(--ink); color: var(--text); font: inherit; transition: transform 0.08s; }
  .hero:hover { transform: translateY(-2px); }
  .hero.on { background: var(--gold-fill); transform: translateY(2px); box-shadow: 0 1px 0 var(--ink); }
  .hero img { width: 100%; max-width: 112px; aspect-ratio: 1; border-radius: 50%; border: 2.5px solid var(--ink); background: linear-gradient(180deg, #a9d3f2 0 55%, #7cc242 55%); }
  .hero b { font-family: var(--font-display); font-weight: 400; font-size: 1.05em; line-height: 1.1; }
  .pseudo { display: flex; align-items: center; gap: 10px; font-weight: 900; }
  .pseudo input { width: 200px; }
  .hero span { font-size: 0.82em; font-weight: 800; color: var(--muted); line-height: 1.2; }
  @media (max-width: 720px) { .list { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
