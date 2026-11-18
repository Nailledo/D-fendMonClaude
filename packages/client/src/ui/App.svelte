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
  import Atelier from './Atelier.svelte';
  import HeroTree from './HeroTree.svelte';
  import SkinPick from './SkinPick.svelte';
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
{#if ui.overlay === 'atelier'}<Atelier />{/if}
{#if ui.overlay === 'herotree'}<HeroTree />{/if}
{#if ui.overlay === 'skin'}<SkinPick />{/if}

<Loading />

<div class="toasts" class:boss={ui.screen === 'game' && ui.hud.boss.on}>
  {#each ui.toasts as t (t.id)}
    <div class="toast {t.kind}">{t.text}</div>
  {/each}
</div>

<style>
  .toasts { position: fixed; top: calc(70px + env(safe-area-inset-top, 0px)); left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; align-items: center; z-index: 60; width: min(560px, calc(100vw - 32px)); }
  .toast { --tc: var(--panel-lo); padding: 7px 18px 7px 16px; background: var(--panel); border: var(--bw) solid var(--ink); border-radius: 99px; box-shadow: inset 8px 0 0 var(--tc), 0 3px 0 var(--ink); font-weight: 800; animation: pop 0.22s ease; text-align: center; }
  .toast.warn { --tc: var(--gold-fill); }
  .toast.danger { --tc: var(--life); color: var(--bad); }
  .toast.good { --tc: var(--good-fill); }
  .toast.enemy { --tc: #9b6bdf; color: var(--magic); }
  @media (max-width: 640px) { .toasts { top: calc(116px + env(safe-area-inset-top, 0px)); } }
  /* barre de vie d'un boss en haut : les messages passent dessous */
  .toasts.boss { top: calc(140px + env(safe-area-inset-top, 0px)); }
</style>
