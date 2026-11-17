<script lang="ts">
  import Ico from './Ico.svelte';
  import { HEROES, HERO_IDS, type HeroId } from '@dfend/shared';
  import { ui } from '../state.svelte';
  import { PASSIVE_ICON, SKILL_ICON } from './skillIcons';

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
        <li><Ico k={'pa_' + cur.id} fb={PASSIVE_ICON[cur.id] ?? ''} /> <b>Passif :</b> {cur.passive.name}. {cur.passive.desc}</li>
        {#each cur.skills as s, i}
          <li><Ico k={`sk_${cur.id}_${i}`} fb={SKILL_ICON[cur.id]?.[i] ?? ''} /> <b>{i === 2 ? 'Ultime' : 'Compétence ' + (i + 1)} :</b> {s.name} <span class="muted">(niv. {s.unlock}, {s.cd} s)</span>. {s.desc}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .picker { display: flex; flex-direction: column; gap: 10px; }
  .list { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  .hero { cursor: pointer; background: var(--toon-cream); border: 2.5px solid var(--ink); border-radius: var(--r-sm); padding: 5px 4px 6px; display: flex; flex-direction: column; align-items: center; gap: 3px; font-weight: 900; font-size: 0.85em; color: var(--text); box-shadow: 0 3px 0 var(--ink); transition: transform 0.08s; }
  .hero:hover { filter: brightness(1.05); }
  .hero img { width: 100%; max-width: 64px; height: auto; aspect-ratio: 1; background: linear-gradient(180deg, #78acf7 0 50%, #3f7ee0 50%); border: 2px solid var(--ink); border-radius: 50%; }
  .hero.on { background: var(--toon-gold); transform: translateY(-2px); box-shadow: 0 5px 0 var(--ink); }
  .info { font-size: 0.9em; line-height: 1.4; }
  .info p { margin: 4px 0; color: var(--muted); }
  .info ul { margin: 4px 0 0; padding-left: 0; list-style: none; }
  .info li { margin: 3px 0; }
  .info li :global(svg.icon) { width: 1.6em; height: 1.6em; vertical-align: -0.45em; }
  .muted { color: var(--muted); }
  /* médaillons des compétences et passifs : lisibles dans les listes */
  li :global(.icon.ico3d) { width: 1.9em; height: 1.9em; vertical-align: -0.62em; }
</style>
