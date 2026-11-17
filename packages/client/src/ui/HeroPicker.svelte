<script lang="ts">
  import { HEROES, HERO_IDS, type HeroId } from '@dfend/shared';
  import { ui } from '../state.svelte';

  let { value, onpick, compact = false }: { value: HeroId; onpick: (h: HeroId) => void; compact?: boolean } = $props();
  const cur = $derived(HEROES[value]);
</script>

<div class="picker">
  <div class="list">
    {#each HERO_IDS as h}
      <button class="hero" class:on={h === value} onclick={() => onpick(h)} title={HEROES[h].name}>
        {#if ui.portraits[h]}<img src={ui.portraits[h]} alt={HEROES[h].name} />{/if}
        <span>{HEROES[h].name}</span>
      </button>
    {/each}
  </div>
  {#if !compact}
    <div class="info">
      <b>{cur.name}</b> <span class="muted">— {cur.title}</span>
      <p>{cur.desc}</p>
      <ul>
        <li><b>Passif :</b> {cur.passive.name}. {cur.passive.desc}</li>
        {#each cur.skills as s, i}
          <li><b>{i === 2 ? 'Ultime' : 'Compétence ' + (i + 1)} :</b> {s.name} <span class="muted">(niv. {s.unlock}, {s.cd} s)</span>. {s.desc}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .picker { display: flex; flex-direction: column; gap: 10px; }
  .list { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .hero {
    cursor: pointer;
    background: rgba(0, 0, 0, 0.12);
    border: 2px solid transparent;
    border-radius: 10px;
    padding: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-weight: 800;
    font-size: 0.85em;
    color: inherit;
  }
  .hero img { width: 100%; max-width: 64px; height: auto; aspect-ratio: 1; }
  .hero.on { border-color: var(--gold-2); background: rgba(242, 193, 78, 0.25); }
  .info { font-size: 0.88em; line-height: 1.35; }
  .info p { margin: 4px 0; }
  .info ul { margin: 4px 0 0; padding-left: 18px; }
  .muted { color: #7a6040; }
</style>
