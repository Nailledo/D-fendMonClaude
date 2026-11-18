<script lang="ts">
  import { SKIN_TONES } from '@dfend/shared';

  /** Choix de la couleur de peau du héros (simple apparence, visible des autres joueurs). */
  let { value, onpick }: { value: number; onpick: (k: number) => void } = $props();
  const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
</script>

<div class="tones" role="radiogroup" aria-label="Couleur de peau">
  <span class="lab">Peau</span>
  {#each SKIN_TONES as t, k}
    <button class="tone" class:on={k === value} style:background={hex(t.color)} role="radio" aria-checked={k === value} aria-label={t.name} title={t.name} onclick={() => onpick(k)}></button>
  {/each}
</div>

<style>
  .tones { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; }
  .lab { font-weight: 900; margin-right: 2px; }
  .tone { cursor: pointer; width: 32px; height: 32px; padding: 0; border: 2.5px solid var(--ink); border-radius: 50%; box-shadow: 0 3px 0 var(--ink); transition: transform 0.08s, box-shadow 0.08s; }
  .tone:hover:not(.on) { transform: translateY(-2px); }
  .tone.on { transform: translateY(2px); box-shadow: 0 1px 0 var(--ink), 0 0 0 3px var(--gold-fill); }
</style>
