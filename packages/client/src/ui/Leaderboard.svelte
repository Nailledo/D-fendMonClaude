<script lang="ts">
  import Ico from './Ico.svelte';
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
      <h2><Ico k="trophy" fb={ICON.trophy} /> Classement survie</h2>
      <button class="btn small" onclick={() => (ui.overlay = null)}>Fermer</button>
    </div>
    <div class="seg">
      {#each SURVIVAL_MAPS as m}<button class:on={map === m} onclick={() => (map = m)}>{MAPS[m].name}</button>{/each}
    </div>
    <div class="seg">
      {#each [1, 2, 3, 4] as n}<button class:on={players === n} onclick={() => (players = n)}>{n} joueur{n > 1 ? 's' : ''}</button>{/each}
    </div>
    <div class="seg">
      {#each DIFFICULTY_NAMES as dn, i}<button class:on={difficulty === i} onclick={() => (difficulty = i as Difficulty)}>{dn}</button>{/each}
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
  .box { width: min(580px, 100%); max-height: 88vh; display: flex; flex-direction: column; gap: 10px; }
  .head { display: flex; justify-content: space-between; align-items: center; }
  h2 { margin: 0; font-size: 2em; display: flex; align-items: center; gap: 10px; }
  ol { list-style: none; margin: 6px 0 0; padding: 0; }
  li { display: flex; gap: 12px; align-items: center; padding: 7px 4px; border-bottom: 1px solid rgba(243, 238, 226, 0.1); font-variant-numeric: tabular-nums; }
  li.podium { font-weight: 700; }
  .rank { width: 30px; height: 27px; display: grid; place-items: center; background: var(--raised); font-weight: 700; border-radius: 50%; }
  li.podium .rank { background: var(--gold); color: var(--gold-ink); }
  .d { color: var(--faint); font-size: 0.82em; }
  .muted { color: var(--muted); margin: 0; }
</style>
