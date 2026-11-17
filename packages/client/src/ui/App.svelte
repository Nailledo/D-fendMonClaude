<script lang="ts">
  import { ui } from '../state.svelte';
  import Title from './Title.svelte';
  import StoryMap from './StoryMap.svelte';
  import Survival from './Survival.svelte';
  import Multi from './Multi.svelte';
  import Lobby from './Lobby.svelte';
  import Hud from './Hud.svelte';
  import Settings from './Settings.svelte';
  import Encyclopedia from './Encyclopedia.svelte';
  import Leaderboard from './Leaderboard.svelte';
  import Help from './Help.svelte';
  import Loading from './Loading.svelte';
</script>

{#if ui.screen === 'title'}
  <Title />
{:else if ui.screen === 'story'}
  <StoryMap />
{:else if ui.screen === 'survival'}
  <Survival />
{:else if ui.screen === 'multi'}
  <Multi />
{:else if ui.screen === 'lobby'}
  <Lobby />
{:else if ui.screen === 'game'}
  <Hud />
{/if}

{#if ui.overlay === 'settings'}<Settings />{/if}
{#if ui.overlay === 'encyclo'}<Encyclopedia />{/if}
{#if ui.overlay === 'leaderboard'}<Leaderboard />{/if}
{#if ui.overlay === 'help'}<Help />{/if}

<Loading />

<div class="toasts">
  {#each ui.toasts as t (t.id)}
    <div class="toast {t.kind}">{t.text}</div>
  {/each}
</div>

<style>
  .toasts { position: fixed; top: 66px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; align-items: center; z-index: 60; width: min(560px, calc(100vw - 32px)); filter: var(--drop-sm); }
  .toast { padding: 8px 16px; background: var(--panel); box-shadow: inset 4px 0 0 var(--muted); font-weight: 700; animation: rise 0.2s ease; text-align: center; }
  .toast.warn { box-shadow: inset 4px 0 0 var(--gold); }
  .toast.danger { box-shadow: inset 4px 0 0 var(--life); color: var(--bad); }
  .toast.good { box-shadow: inset 4px 0 0 var(--good); }
  .toast.enemy { box-shadow: inset 4px 0 0 var(--magic); color: #eadcff; }
</style>
