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
    <div class="seg">
      {#each DIFFICULTY_NAMES as d, i}
        <button class:on={diff === i} onclick={() => setDifficulty(i as Difficulty)}>{d}</button>
      {/each}
    </div>
    <HeroPicker value={ui.hero} onpick={setHero} />
    <div class="row">
      <button class="btn gold big grow" onclick={play}>Jouer seul</button>
      <button class="btn" onclick={() => { ui.screen = 'multi'; app.connect(); }}>{@html ICON.users} En coop</button>
      <button class="btn ghost" onclick={() => (ui.screen = 'title')}>{@html ICON.back} Retour</button>
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
  .wrap { position: fixed; inset: 0; display: grid; grid-template-columns: minmax(0, 660px) 300px; justify-content: center; align-content: start; gap: 16px; padding: 28px 16px; overflow: auto; background: rgba(12, 14, 16, 0.55); }
  .main { display: flex; flex-direction: column; gap: 14px; padding: 22px; }
  h2 { margin: 0; font-size: 2.3em; }
  h3 { margin: 0; font-size: 1.35em; display: flex; align-items: center; gap: 8px; }
  .muted { color: var(--muted); margin: 0; }
  .maps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .map { cursor: pointer; text-align: left; padding: 12px; border: 0; color: #fff; display: flex; flex-direction: column; gap: 6px; min-height: 104px; background: var(--b);
    border-radius: var(--r-sm); box-shadow: inset 0 -5px 0 rgba(0, 0, 0, 0.25); }
  .map b { font-family: var(--font-display); font-size: 1.3em; line-height: 1; }
  .map span { font-size: 0.84em; opacity: 0.92; }
  .map.vallee { --b: #5f8f3e; }
  .map.marais { --b: #46705a; }
  .map.cendre { --b: #7a3b2e; }
  .map.on { box-shadow: inset 0 0 0 3px var(--gold), inset 0 -5px 0 rgba(0, 0, 0, 0.25); }
  .map:hover { filter: brightness(1.1); }
  .lb { display: flex; flex-direction: column; gap: 8px; }
  ol { margin: 0; padding: 0; list-style: none; counter-reset: r; }
  li { display: flex; justify-content: space-between; gap: 8px; padding: 5px 0; border-bottom: 1px solid rgba(243, 238, 226, 0.1); font-variant-numeric: tabular-nums; counter-increment: r; }
  li::before { content: counter(r); color: var(--faint); width: 1.6em; }
  li span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  li b { color: var(--gold); }
  @media (max-width: 900px) { .wrap { grid-template-columns: 1fr; } .maps { grid-template-columns: 1fr; } }
</style>
