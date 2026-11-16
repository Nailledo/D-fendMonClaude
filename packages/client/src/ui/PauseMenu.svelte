<script lang="ts">
  import { app } from '../app';
  import { ui } from '../state.svelte';

  const local = $derived(!!app.game?.host.local);
  function resume() {
    if (local) app.game?.setPaused(false);
    else ui.paused = false;
  }
</script>

<div class="overlay-bg">
  <div class="panel box">
    <h2>{local ? 'Pause' : 'Menu'}</h2>
    {#if !local}<p class="muted">La partie continue pendant que ce menu est ouvert.</p>{/if}
    <button class="btn gold big" onclick={resume}>Reprendre</button>
    {#if local}<button class="btn" onclick={() => app.restart()}>Recommencer</button>{/if}
    <button class="btn" onclick={() => (ui.overlay = 'settings')}>Paramètres</button>
    <button class="btn" onclick={() => (ui.overlay = 'help')}>Comment jouer</button>
    <button class="btn red" onclick={() => { if (!local) { import('../net/Net').then(({ net }) => net.send({ t: 'leave' })); ui.room = null; } app.leaveGame(); if (!local) ui.screen = 'multi'; }}>
      {local ? 'Quitter la partie' : 'Quitter le salon'}
    </button>
  </div>
</div>

<style>
  .box { width: min(340px, 100%); display: flex; flex-direction: column; gap: 10px; text-align: center; }
  h2 { margin: 0; }
  .muted { margin: 0; color: #7a6040; font-size: 0.9em; }
</style>
