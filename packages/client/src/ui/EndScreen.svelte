<script lang="ts">
  import { DIFFICULTY_NAMES, LEVELS } from '@dfend/shared';
  import { app } from '../app';
  import { progress, ui } from '../state.svelte';
  import { ICON } from './icons';

  const e = $derived(ui.end!);
  const multi = $derived(!!ui.game?.multi);
  const level = $derived(ui.game?.level ?? -1);
  const hasNext = $derived(e.mode === 'story' && e.won && level + 1 < LEVELS.length && level + 1 <= progress.unlocked);
  $effect(() => {
    if (e.mode === 'survival' && !multi && !ui.submitted) void app.submitScore();
  });
  const total = $derived(e.stats.reduce((s, p) => s + p.damage, 0) || 1);
</script>

<div class="overlay-bg">
  <div class="panel end">
    {#if e.mode === 'story'}
      <h1 class:won={e.won}>{e.won ? 'Victoire !' : 'Défaite…'}</h1>
      {#if e.won}
        <div class="stars">{#each [0, 1, 2] as k}<span class:on={k < e.stars} style="animation-delay:{0.2 + k * 0.25}s">{@html k < e.stars ? ICON.star : ICON.starEmpty}</span>{/each}</div>
      {:else}
        <p>Les forces de Kessin ont franchi vos défenses. Relevez-vous, chevalier !</p>
      {/if}
    {:else}
      <h1>Fin de la survie</h1>
      <p class="big">Vous avez tenu <b>{e.wave}</b> vague{e.wave > 1 ? 's' : ''} ({DIFFICULTY_NAMES[e.difficulty]})</p>
    {/if}
    <table>
      <thead><tr><th>Joueur</th><th>Éliminations</th><th>Dégâts</th><th>Or gagné</th></tr></thead>
      <tbody>
        {#each e.stats as s}
          <tr><td>{s.name}</td><td>{s.kills}</td><td>{s.damage} <span class="pct">({Math.round((s.damage / total) * 100)} %)</span></td><td>{s.gold}</td></tr>
        {/each}
      </tbody>
    </table>
    <div class="row btns">
      {#if hasNext && !multi}
        <button class="btn gold big" onclick={() => app.startSolo('story', LEVELS[level + 1].mapId, e.difficulty, 'samuel', level + 1)}>Niveau suivant</button>
      {/if}
      {#if !multi}<button class="btn" onclick={() => app.restart()}>Rejouer</button>{/if}
      <button class="btn" onclick={() => app.leaveGame()}>{multi ? 'Retour au salon' : 'Menu'}</button>
    </div>
  </div>
</div>

<style>
  .end { width: min(560px, 100%); text-align: center; display: flex; flex-direction: column; gap: 10px; animation: pop 0.3s ease; }
  h1 { margin: 0; font-size: 2.4em; color: #7f1d1d; }
  h1.won { color: #7a4d06; }
  .stars { display: flex; justify-content: center; gap: 8px; font-size: 54px; }
  .stars span { animation: pop 0.4s ease both; }
  .big { font-size: 1.2em; }
  table { width: 100%; border-collapse: collapse; font-size: 0.92em; }
  th, td { padding: 4px 6px; border-bottom: 1px dashed rgba(90, 58, 34, 0.35); }
  th { font-family: 'Cinzel', serif; font-size: 0.85em; }
  .pct { color: #7a6040; font-size: 0.85em; }
  .btns { justify-content: center; flex-wrap: wrap; }
</style>
