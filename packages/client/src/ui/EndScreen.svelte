<script lang="ts">
  import { DIFFICULTY_NAMES, LEVELS, PLAYER_COLORS } from '@dfend/shared';
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
  const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
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
          <tr><td>{s.name}</td><td>{s.kills}</td><td class="dmgcell"><span class="bar"><i style="width:{(s.damage / total) * 100}%; background:{hex(PLAYER_COLORS[s.id] ?? 0xf2b33d)}"></i></span>{s.damage} <span class="pct">{Math.round((s.damage / total) * 100)} %</span></td><td>{s.gold}</td></tr>
        {/each}
      </tbody>
    </table>
    <div class="row btns">
      {#if hasNext && !multi}
        <button class="btn gold big" onclick={() => app.startSolo('story', LEVELS[level + 1].mapId, e.difficulty, app.game?.cfg.players[0].hero ?? ui.hero, level + 1)}>Niveau suivant</button>
      {/if}
      {#if !multi}<button class="btn" onclick={() => app.restart()}>Rejouer</button>{/if}
      <button class="btn" onclick={() => app.leaveGame()}>{multi ? 'Retour au salon' : 'Menu'}</button>
    </div>
  </div>
</div>

<style>
  .end { width: min(600px, 100%); text-align: center; display: flex; flex-direction: column; gap: 14px; padding: 26px 24px 22px; animation: pop 0.25s ease; }
  h1 { margin: 0; font-size: 3em; color: var(--bad); }
  h1.won { color: var(--gold); }
  p { margin: 0; color: var(--muted); }
  .stars { display: flex; justify-content: center; gap: 10px; }
  .stars span { animation: pop 0.35s ease both; }
  .stars :global(.icon) { width: 58px; height: 58px; }
  .big { font-size: 1.2em; color: var(--text); }
  table { width: 100%; border-collapse: collapse; font-size: 0.93em; font-variant-numeric: tabular-nums; }
  th, td { padding: 7px 6px; border-bottom: 1px solid rgba(243, 238, 226, 0.1); text-align: right; }
  th:first-child, td:first-child { text-align: left; }
  th { font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .dmgcell { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
  .bar { width: 70px; height: 6px; background: var(--line); display: inline-block; }
  .bar i { display: block; height: 100%; }
  .pct { color: var(--faint); font-size: 0.85em; min-width: 3.2em; }
  .btns { justify-content: center; flex-wrap: wrap; margin-top: 4px; }
</style>
