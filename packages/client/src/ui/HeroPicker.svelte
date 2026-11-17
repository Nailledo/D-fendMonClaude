<script lang="ts">
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
        <li>{@html PASSIVE_ICON[cur.id] ?? ''} <b>Passif :</b> {cur.passive.name}. {cur.passive.desc}</li>
        {#each cur.skills as s, i}
          <li>{@html SKILL_ICON[cur.id]?.[i] ?? ''} <b>{i === 2 ? 'Ultime' : 'Compétence ' + (i + 1)} :</b> {s.name} <span class="muted">(niv. {s.unlock}, {s.cd} s)</span>. {s.desc}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .picker { display: flex; flex-direction: column; gap: 10px; }
  .list { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  .hero { cursor: pointer; background: var(--raised); border: 0; padding: 4px 4px 6px; display: flex; flex-direction: column; align-items: center; gap: 3px; font-weight: 700; font-size: 0.85em; color: var(--text); box-shadow: inset 0 0 0 2px transparent; }
  .hero:hover { background: var(--raised-2); }
  .hero img { width: 100%; max-width: 64px; height: auto; aspect-ratio: 1; background: #d9cfb8; }
  .hero.on { box-shadow: inset 0 0 0 2px var(--gold); color: var(--gold); }
  .info { font-size: 0.9em; line-height: 1.4; }
  .info p { margin: 4px 0; color: var(--muted); }
  .info ul { margin: 4px 0 0; padding-left: 0; list-style: none; }
  .info li { margin: 3px 0; }
  .info li :global(svg.icon) { width: 1.6em; height: 1.6em; vertical-align: -0.45em; }
  .muted { color: var(--muted); }
</style>
