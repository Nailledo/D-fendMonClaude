<script lang="ts">
  import Ico from './Ico.svelte';
  import { HEROES, type HeroId } from '@dfend/shared';
  import { ui } from '../state.svelte';
  import { PASSIVE_ICON, SKILL_ICON } from './skillIcons';

  /** Fiche d'un héros : en-tête, puis ses 4 capacités en cases alignées (icône, nom, type, effet). */
  let { id, portrait = false }: { id: HeroId; portrait?: boolean } = $props();
  const h = $derived(HEROES[id]);
  const abilities = $derived([
    { icon: 'pa_' + id, fb: PASSIVE_ICON[id] ?? '', name: h.passive.name, kind: 'Passif', meta: 'toujours actif', desc: h.passive.desc, ult: false },
    ...h.skills.map((s, i) => ({
      icon: `sk_${id}_${i}`,
      fb: SKILL_ICON[id]?.[i] ?? '',
      name: s.name,
      kind: i === 2 ? 'Ultime' : `Compétence ${i + 1}`,
      meta: `niveau ${s.unlock} · recharge ${s.cd} s`,
      desc: s.desc,
      ult: i === 2,
    })),
  ]);
</script>

<div class="sheet" class:withp={portrait}>
  {#if portrait && ui.portraits['full_' + id]}<img class="big" src={ui.portraits['full_' + id]} alt={h.name} />{/if}
  <div class="main">
    <div class="hd"><b>{h.name}</b><span>{h.title}</span></div>
    <p class="desc">{h.desc}</p>
    <ul class="ab">
      {#each abilities as a}
        <li class:ult={a.ult}>
          <span class="ic"><Ico k={a.icon} fb={a.fb} /></span>
          <div class="tx">
            <b class="nm">{a.name}</b>
            <div class="meta"><span class="kind">{a.kind}</span>{a.meta}</div>
            <p>{a.desc}</p>
          </div>
        </li>
      {/each}
    </ul>
  </div>
</div>

<style>
  .sheet { display: flex; gap: 16px; align-items: flex-start; text-align: left; }
  .big { flex: none; width: 112px; height: 112px; border-radius: 50%; border: 2.5px solid var(--ink); background: linear-gradient(180deg, #a9d3f2 0 55%, #7cc242 55%); }
  .main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .hd { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; }
  .hd b { font-family: var(--font-display); font-weight: 400; font-size: 1.5em; line-height: 1; }
  .hd span { font-size: 0.9em; font-weight: 800; color: var(--muted); }
  .desc { margin: 0; font-size: 0.92em; color: var(--muted); font-weight: 700; line-height: 1.35; }
  .ab { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 8px; }
  li { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 10px; align-items: start; padding: 8px 10px 8px 8px; background: var(--panel-hi); border: 2px solid var(--ink); border-radius: var(--r-sm); }
  li.ult { background: #fff4d0; border-color: var(--gold-lo); }
  .ic { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; background: var(--ink); overflow: hidden; }
  .ic :global(.icon) { width: 44px; height: 44px; margin: 0; vertical-align: 0; }
  .ic :global(svg.icon) { width: 26px; height: 26px; color: #fff; }
  .tx { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .nm { font-weight: 900; font-size: 0.98em; line-height: 1.15; }
  .kind { flex: none; margin-right: 6px; font-size: 10px; color: var(--ink); font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; padding: 0 7px; border-radius: 99px; border: 1.5px solid var(--ink); background: var(--panel); }
  .ult .kind { background: var(--gold-fill); }
  .meta { display: flex; flex-wrap: wrap; align-items: center; row-gap: 2px; margin-top: 2px; font-size: 11.5px; font-weight: 800; color: var(--faint); }
  .tx p { margin: 2px 0 0; font-size: 0.86em; font-weight: 700; line-height: 1.3; color: var(--text); }
  @media (max-width: 560px) {
    .big { width: 72px; height: 72px; }
    .sheet { gap: 10px; }
  }
</style>
