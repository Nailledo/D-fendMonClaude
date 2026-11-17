<script lang="ts">
  import { DIFFICULTY_NAMES, MAPS, SURVIVAL_MAPS, type Difficulty } from '@dfend/shared';
  import { ui } from '../state.svelte';
  import { ICON } from './icons';

  let map = $state(SURVIVAL_MAPS[0]);
  let players = $state(1);
  let difficulty = $state<Difficulty>(1);
  let rows = $state<{ name: string; wave: number; date: number }[]>([]);
  let error = $state(false);
  $effect(() => {
    const m = map, p = players, d = difficulty;
    error = false;
    fetch(`/api/leaderboard?map=${m}&players=${p}&difficulty=${d}`).then((r) => r.json()).then((j) => (rows = j.rows ?? [])).catch(() => { rows = []; error = true; });
  });
</script>

<div class="overlay-bg">
  <div class="panel box">
    <div class="head">
      <h2>{@html ICON.trophy} Classement survie</h2>
      <button class="btn small" onclick={() => (ui.overlay = null)}>Fermer</button>
    </div>
    <div class="row wrap">
      {#each SURVIVAL_MAPS as m}<button class="btn small" class:gold={map === m} onclick={() => (map = m)}>{MAPS[m].name}</button>{/each}
    </div>
    <div class="row">
      {#each [1, 2, 3, 4] as n}<button class="btn small" class:gold={players === n} onclick={() => (players = n)}>{n} joueur{n > 1 ? 's' : ''}</button>{/each}
    </div>
    <div class="row">
      {#each DIFFICULTY_NAMES as dn, i}<button class="btn small" class:gold={difficulty === i} onclick={() => (difficulty = i as Difficulty)}>{dn}</button>{/each}
    </div>
    {#if error}<p class="muted">Serveur indisponible.</p>{:else if rows.length === 0}<p class="muted">Aucun score pour l’instant.</p>{/if}
    <ol class="scroll">
      {#each rows as r, i}
        <li class:podium={i < 3}><span class="rank">{i + 1}</span><span class="grow">{r.name}</span><b>vague {r.wave}</b><span class="d">{new Date(r.date).toLocaleDateString('fr-FR')}</span></li>
      {/each}
    </ol>
  </div>
</div>

<style>
  .box { width: min(560px, 100%); max-height: 86vh; display: flex; flex-direction: column; gap: 10px; }
  .head { display: flex; justify-content: space-between; align-items: center; }
  h2 { margin: 0; }
  .wrap { flex-wrap: wrap; }
  ol { list-style: none; margin: 0; padding: 0; }
  li { display: flex; gap: 10px; align-items: center; padding: 5px 8px; border-bottom: 1px dashed rgba(90, 58, 34, 0.3); }
  li.podium { font-weight: 800; }
  .rank { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: rgba(0, 0, 0, 0.12); font-weight: 800; }
  li.podium .rank { background: var(--gold); }
  .d { color: #7a6040; font-size: 0.8em; }
  .muted { color: #7a6040; margin: 0; }
</style>
