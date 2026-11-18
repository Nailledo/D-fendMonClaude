<script lang="ts">
  import { HEROES, HERO_IDS, type HeroId } from '@dfend/shared';
  import { ui } from '../state.svelte';
  
  let { value, onpick, compact = false }: { value: HeroId; onpick: (h: HeroId) => void; compact?: boolean } = $props();
</script>

<div class="picker">
  <div class="list">
    {#each HERO_IDS as h}
      <button class="hero" class:on={h === value} onclick={() => onpick(h)} title={HEROES[h].title} aria-label={HEROES[h].title}>
        {#if ui.portraits[h]}<img src={ui.portraits[h]} alt="" />{/if}
        {#if !compact}<span>{HEROES[h].title}</span>{/if}
      </button>
    {/each}
  </div>
  {#if !compact}<p class="who"><b>{HEROES[value].title}</b> · {HEROES[value].desc}</p>{/if}
</div>

<style>
  .picker { display: flex; flex-direction: column; gap: 12px; }
  .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(54px, 1fr)); gap: 8px; }
  .hero { cursor: pointer; background: var(--panel-hi); border: 2.5px solid var(--ink); border-radius: var(--r-sm); padding: 6px 4px 5px; display: flex; flex-direction: column; align-items: center; gap: 4px;
    font-weight: 900; font-size: 0.85em; color: var(--text); box-shadow: 0 3px 0 var(--ink); transition: transform 0.08s, box-shadow 0.08s; }
  .hero:hover:not(.on) { background: #fff; }
  .hero img { width: 100%; max-width: 60px; height: auto; aspect-ratio: 1; background: linear-gradient(180deg, #78acf7 0 50%, #3f7ee0 50%); border: 2px solid var(--ink); border-radius: 50%; }
  .hero span { line-height: 1.1; }
  .who { margin: 0; font-size: 0.9em; font-weight: 700; color: var(--muted); line-height: 1.35; }
  .who b { color: var(--text); }
  .hero.on { background: var(--gold-fill); transform: translateY(2px); box-shadow: 0 1px 0 var(--ink); }
</style>
