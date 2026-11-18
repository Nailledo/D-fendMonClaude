<script lang="ts">
  import { HEROES, classOf } from '@dfend/shared';
  import { progress, ui } from '../state.svelte';
  import { heroBuild, heroPointsLeft } from '../meta';
  import { hex } from './classIcons';

  /** Héros du joueur : apparence + classe, et accès à l'arbre du héros. */
  const b = $derived((progress.hero, heroBuild()));
  const c = $derived(classOf(b));
  const pts = $derived(heroPointsLeft());
</script>

<button class="badge" style="--cc:{hex(c.color)}" onclick={() => (ui.overlay = 'herotree')}>
  {#if ui.portraits[ui.hero]}<img src={ui.portraits[ui.hero]} alt="" />{/if}
  <span class="tx">
    <b>{HEROES[ui.hero].name}</b>
    <span class="cl">{c.name}{b.common ? ` · entraînement ${b.common}` : ''}</span>
  </span>
  <span class="go">Arbre du héros{#if pts > 0}<em>{pts}</em>{/if}</span>
</button>

<style>
  .badge { cursor: pointer; width: 100%; display: flex; align-items: center; gap: 10px; padding: 6px 10px 6px 6px; text-align: left; font: inherit; color: var(--text);
    background: var(--panel-hi); border: 2.5px solid var(--ink); border-left: 8px solid var(--cc); border-radius: var(--r-sm); box-shadow: 0 3px 0 var(--ink); transition: transform 0.08s; }
  .badge:hover { transform: translateY(-2px); }
  img { width: 48px; height: 48px; flex: none; border-radius: 50%; border: 2px solid var(--ink); background: linear-gradient(180deg, #78acf7 0 50%, #3f7ee0 50%); }
  .tx { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .tx b { font-family: var(--font-display); font-weight: 400; font-size: 1.2em; line-height: 1.05; }
  .cl { font-size: 0.85em; font-weight: 800; color: var(--muted); }
  .go { flex: none; display: inline-flex; align-items: center; gap: 5px; font-weight: 900; font-size: 0.85em; padding: 4px 10px; border: 2px solid var(--ink); border-radius: 99px; background: var(--gold-fill); }
  em { font-style: normal; min-width: 20px; text-align: center; padding: 0 5px; border-radius: 99px; background: var(--bad); color: #fff; border: 2px solid var(--ink); font-size: 0.9em; }
</style>
