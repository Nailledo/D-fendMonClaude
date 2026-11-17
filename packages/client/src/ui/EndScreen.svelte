<script lang="ts">
  import Ico from './Ico.svelte';
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
  <div class="panel end" class:paper={e.mode === 'story'}>
    {#if e.mode === 'story'}
      <p class="eyebrow">Fin du chapitre {level + 1}{LEVELS[level] ? ' · ' + LEVELS[level].name : ''}</p>
      <h1 class:won={e.won}>{e.won ? 'Victoire !' : 'Défaite…'}</h1>
      {#if e.won}
        <div class="stars">{#each [0, 1, 2] as k}<span class:on={k < e.stars} style="animation-delay:{0.2 + k * 0.25}s"><Ico k={k < e.stars ? 'star' : 'starEmpty'} fb={k < e.stars ? ICON.star : ICON.starEmpty} /></span>{/each}</div>
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
  .end { width: min(600px, 100%); text-align: center; display: flex; flex-direction: column; gap: 14px; padding: 26px 24px 22px; animation: pop 0.3s ease; }
  .eyebrow { margin: 0 0 -6px; }
  h1 { margin: 0; font-size: 3.4em; color: #fff; -webkit-text-stroke: 9px var(--ink); paint-order: stroke fill; text-shadow: 0 5px 0 var(--ink); }
  h1.won { color: var(--gold-fill); }
  /* sur le papier du conteur : titre à l'encre, défaite à la cire rouge */
  .paper h1 { font-size: 3.2em; color: var(--bad); -webkit-text-stroke: 0; text-shadow: none; }
  .paper h1.won { color: var(--ink); }
  p { margin: 0; color: var(--muted); font-weight: 700; }
  .paper p:not(.eyebrow) { font-family: var(--font-story); font-style: italic; font-weight: 400; font-size: 1.2em; }
  .stars { display: flex; justify-content: center; gap: 8px; }
  .stars span { animation: starIn 0.45s cubic-bezier(0.2, 1.6, 0.4, 1) both; }
  .stars span:nth-child(2) { transform: translateY(-10px); }
  @keyframes starIn { from { transform: scale(0) rotate(-40deg); opacity: 0; } }
  .stars :global(.icon) { width: 68px; height: 68px; }
  .big { font-size: 1.2em; color: var(--text); }
  .big b { font-family: var(--font-display); font-weight: 400; font-size: 1.3em; }
  table { width: 100%; border-collapse: collapse; font-size: 0.93em; font-variant-numeric: tabular-nums; font-weight: 800; }
  th, td { padding: 7px 6px; border-bottom: 2px dashed rgba(43, 26, 18, 0.18); text-align: right; }
  th:first-child, td:first-child { text-align: left; }
  th { font-size: 11.5px; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
  .paper th { font-family: var(--font-story-sc); font-weight: 400; text-transform: none; font-size: 15px; letter-spacing: 0.04em; }
  .dmgcell { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
  .bar { width: 70px; height: 10px; background: #d8bf8f; border: 2px solid var(--ink); border-radius: 99px; overflow: hidden; display: inline-block; }
  .bar i { display: block; height: 100%; }
  .pct { color: var(--faint); font-size: 0.85em; min-width: 3.2em; }
  .btns { justify-content: center; flex-wrap: wrap; margin-top: 4px; }
  /* téléphone : le tableau tient dans la largeur (barre et pourcentage masqués) */
  @media (max-width: 560px) {
    .end { padding: 20px 14px 18px; }
    h1 { font-size: 2.6em; }
    table { font-size: 0.85em; }
    th { font-size: 10px; letter-spacing: 0.02em; }
    .paper th { font-size: 13px; }
    th, td { padding: 6px 3px; }
    .bar, .pct { display: none; }
  }
</style>
