<script lang="ts">
  import { app } from '../app';
  import { net } from '../net/Net';
  import { ui } from '../state.svelte';

  const local = $derived(!!app.game?.host.local);
  const canFull = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  let isFull = $state(typeof document !== 'undefined' && !!document.fullscreenElement);
  function toggleFull() {
    if (document.fullscreenElement) void document.exitFullscreen().then(() => (isFull = false));
    else void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => (isFull = true)).catch(() => {});
  }
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
    {#if canFull}<button class="btn" onclick={toggleFull}>{isFull ? 'Quitter le plein écran' : 'Plein écran'}</button>{/if}
    <button class="btn" onclick={() => (ui.overlay = 'settings')}>Paramètres</button>
    <button class="btn" onclick={() => (ui.overlay = 'help')}>Comment jouer</button>
    <button class="btn red" onclick={() => { if (!local) { net.send({ t: 'leave' }); ui.room = null; } app.leaveGame(); if (!local) ui.screen = 'multi'; }}>
      {local ? 'Quitter la partie' : 'Quitter le salon'}
    </button>
  </div>
</div>

<style>
  .box { width: min(360px, 100%); display: flex; flex-direction: column; gap: 12px; text-align: center; padding: 22px; animation: pop 0.2s ease; }
  h2 { margin: 0 0 6px; font-size: 2.8em; color: #fff; -webkit-text-stroke: 8px var(--ink); paint-order: stroke fill; text-shadow: 0 5px 0 var(--ink); }
  .muted { margin: 0; color: var(--muted); font-size: 0.9em; font-weight: 700; }
</style>
