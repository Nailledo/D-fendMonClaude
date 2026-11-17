<script lang="ts">
  import { DIFFICULTY_NAMES, MAPS, SURVIVAL_MAPS, type Difficulty } from '@dfend/shared';
  import { app } from '../app';
  import { audio } from '../audio/Audio';
  import { setDifficulty, setHero, ui } from '../state.svelte';
  import HeroPicker from './HeroPicker.svelte';
  import { ICON } from './icons';

  let map = $state(SURVIVAL_MAPS[0]);
  const diff = $derived<Difficulty>(ui.difficulty);
  let top = $state<{ name: string; wave: number }[]>([]);
  const BIOME_DESC: Record<string, string> = {
    carrefour: 'Trois routes s’ouvrent au fil des vagues.',
    brumes: 'Le brouillard du marais cache des surprises.',
    fournaise: 'Quatre chemins, la lave et beaucoup de démons.',
  };
  $effect(() => {
    const m = map, d = diff;
    fetch(`/api/leaderboard?map=${m}&players=1&difficulty=${d}`).then((r) => r.json()).then((j) => (top = j.rows ?? [])).catch(() => (top = []));
  });
  function play() {
    audio.play('click');
    app.startSolo('survival', map, diff, ui.hero);
  }
</script>

<div class="wrap ui">
  <div class="panel main">
    <h2>Mode survie</h2>
    <p class="muted">Des vagues infinies, une mutation toutes les 5 vagues, un boss toutes les 10. Jusqu’où tiendrez-vous ?</p>
    <div class="maps">
      {#each SURVIVAL_MAPS as m}
        <button class="map {MAPS[m].biome}" class:on={map === m} onclick={() => (map = m)}>
          <b>{MAPS[m].name}</b>
          <span>{BIOME_DESC[m]}</span>
        </button>
      {/each}
    </div>
    <div class="row">
      {#each DIFFICULTY_NAMES as d, i}
        <button class="btn small" class:gold={diff === i} onclick={() => setDifficulty(i as Difficulty)}>{d}</button>
      {/each}
    </div>
    <HeroPicker value={ui.hero} onpick={setHero} />
    <div class="row">
      <button class="btn gold big grow" onclick={play}>Jouer seul</button>
      <button class="btn" onclick={() => { ui.screen = 'multi'; app.connect(); }}>{@html ICON.users} En coop</button>
      <button class="btn ghost" onclick={() => (ui.screen = 'title')}>Retour</button>
    </div>
  </div>
  <div class="panel lb">
    <h3>{@html ICON.trophy} Meilleurs scores (solo, {DIFFICULTY_NAMES[diff]})</h3>
    {#if top.length === 0}<p class="muted">Aucun score pour l’instant. À vous l’honneur !</p>{/if}
    <ol>
      {#each top.slice(0, 10) as r}<li><span>{r.name}</span><b>vague {r.wave}</b></li>{/each}
    </ol>
  </div>
</div>

<style>
  .wrap { position: fixed; inset: 0; display: grid; grid-template-columns: minmax(0, 640px) 280px; justify-content: center; align-items: start; gap: 16px; padding: 24px 16px; overflow: auto; background: rgba(20, 12, 6, 0.45); }
  .main { display: flex; flex-direction: column; gap: 12px; }
  h2, h3 { margin: 0; }
  .muted { color: #7a6040; margin: 0; }
  .maps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .map { cursor: pointer; text-align: left; border-radius: 10px; padding: 12px; border: 3px solid transparent; color: #fff; display: flex; flex-direction: column; gap: 4px; min-height: 96px; box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.35); }
  .map span { font-size: 0.82em; opacity: 0.9; }
  .map.vallee { background: linear-gradient(160deg, #7db955, #3f6e2a); }
  .map.marais { background: linear-gradient(160deg, #6f8a6a, #2f4234); }
  .map.cendre { background: linear-gradient(160deg, #a5402a, #3a1d18); }
  .map.on { border-color: var(--gold); }
  ol { margin: 8px 0 0; padding-left: 22px; }
  li { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed rgba(90, 58, 34, 0.3); }
  @media (max-width: 900px) { .wrap { grid-template-columns: 1fr; } .maps { grid-template-columns: 1fr; } }
</style>
