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

<div class="toasts">
  {#each ui.toasts as t (t.id)}
    <div class="toast {t.kind}">{t.text}</div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    top: 84px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    z-index: 60;
    width: min(560px, calc(100vw - 32px));
  }
  .toast {
    padding: 8px 16px;
    border-radius: 10px;
    background: rgba(30, 20, 12, 0.88);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
    font-weight: 700;
    animation: rise 0.25s ease;
    text-align: center;
  }
  .toast.warn { border-color: #f59e0b; }
  .toast.danger { border-color: #ef4444; color: #fecaca; }
  .toast.good { border-color: #4ade80; color: #dcfce7; }
  .toast.enemy { border-color: #c084fc; background: rgba(40, 20, 50, 0.9); }
</style>
