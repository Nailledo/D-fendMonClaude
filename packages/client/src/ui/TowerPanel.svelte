<script lang="ts">
  import { FAMILIES, TOWERS, UNDO_SELL_S } from '@dfend/shared';
  import { app } from '../app';
  import { keyLabel, keys } from '../settings';
  import { ui } from '../state.svelte';
  import { FAMILY_NAME, ICON } from './icons';
  import { LEVEL_LABEL, compareStats, sellValue, towerStats, towerTags } from './towerStats';

  const sel = $derived(ui.sel!);
  const gold = $derived(ui.hud.gold);
  const fi = $derived(sel.fam ?? 0);
  const fam = $derived(FAMILIES[fi]);
  const lvl = $derived(sel.level ?? 0);
  const sk = $derived((sel.sk ?? [0, 0]) as [number, number]);
  const cur = $derived(TOWERS[fam][lvl]);
  const next = $derived(lvl < 2 ? TOWERS[fam][lvl + 1] : null);
  const sell = $derived(sellValue(fi, lvl, sk));
  const g = () => app.game;
  /** aperçu de portée au sol pendant le survol d'une amélioration */
  const hover = (target: number) => {
    if (app.game) app.game.hoverLevel = target;
  };
</script>

<div class="tp panel ui" role="region" aria-label="Tour sélectionnée" style="--fc:{['#4c9a2a', '#2f6fa8', '#7c4dc4', '#c25e1f'][fi]}" onpointerleave={() => hover(-1)}>
  <div class="th">
    <small>{FAMILY_NAME[fi]} · {LEVEL_LABEL[lvl]}</small>
    <b>{cur.name}</b>
  </div>

  {#if next}
    <div class="cmp">
      {#each compareStats(fam, lvl, lvl + 1) as r}
        <span class="k">{r.label}</span><span class="from">{r.from}</span><span class="arr">→</span><span class="to" class:better={r.better} class:worse={r.worse}>{r.text}</span>
      {/each}
    </div>
    <div class="tags">{#each towerTags(fam, lvl + 1) as t}<span>{t}</span>{/each}</div>
    <div class="btns">
      <button class="btn gold" class:poor={gold < next.cost} onpointerenter={() => hover(lvl + 1)} onfocus={() => hover(lvl + 1)} onclick={() => g()?.upgrade()}>
        Améliorer · {next.cost}<span class="kbd">{keyLabel(keys.upgrade)}</span>
      </button>
      <button class="btn" onclick={() => g()?.sell()}>Vendre +{sell}<span class="kbd">{keyLabel(keys.sell)}</span></button>
    </div>
  {:else if lvl === 2}
    <p class="hint">Choisissez une spécialisation : elle débloque deux compétences.</p>
    <div class="specs">
      {#each [1, 2] as s}
        {@const spec = TOWERS[fam][2 + s]}
        <button class="spec" class:poor={gold < spec.cost} onpointerenter={() => hover(2 + s)} onfocus={() => hover(2 + s)} onclick={() => g()?.upgrade(s as 1 | 2)}>
          <b>{spec.name}</b>
          <span class="desc">{spec.desc}</span>
          <span class="mini">{#each towerStats(fam, 2 + s).slice(0, 4) as r}<span>{r.label} <i>{r.text}</i></span>{/each}</span>
          <span class="cost">{@html ICON.coin}{spec.cost}</span>
        </button>
      {/each}
    </div>
    <div class="btns one"><button class="btn" onclick={() => g()?.sell()}>Vendre +{sell}<span class="kbd">{keyLabel(keys.sell)}</span></button></div>
  {:else}
    <div class="stats">{#each towerStats(fam, lvl) as r}<span class="k">{r.label}</span><span class="v">{r.text}</span>{/each}</div>
    <div class="skills">
      {#each cur.skills ?? [] as s, i}
        {@const rank = sk[i]}
        <button class="sk" class:poor={rank < 3 && gold < s.costs[rank]} disabled={rank >= 3} onclick={() => g()?.skill(i as 0 | 1)}>
          <span class="sn"><b>{s.name}</b><span class="pips">{#each [0, 1, 2] as k}<i class:on={k < rank}></i>{/each}</span></span>
          <span class="desc">{s.desc}</span>
          <span class="cost">{#if rank < 3}{@html ICON.coin}{s.costs[rank]}{:else}Maximum{/if}</span>
        </button>
      {/each}
    </div>
    <div class="btns one"><button class="btn" onclick={() => g()?.sell()}>Vendre +{sell}<span class="kbd">{keyLabel(keys.sell)}</span></button></div>
  {/if}

  {#if fam === 'barracks'}
    <button class="btn ghost rally" onclick={() => g()?.startRally()}>{@html ICON.flag} Déplacer le point de ralliement<span class="kbd">{keyLabel(keys.rally)}</span></button>
  {/if}
  <p class="undo">Remboursement intégral pendant {UNDO_SELL_S} s après un achat.</p>
</div>

<style>
  .tp { position: absolute; right: 10px; bottom: 10px; width: min(360px, calc(100vw - 20px)); padding: 12px 14px; display: flex; flex-direction: column; gap: 9px; font-size: 0.92em; border-top: 5px solid var(--fc); max-height: calc(100vh - 140px); overflow: auto; }
  .th { display: flex; flex-direction: column; gap: 1px; }
  .th small { font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fc); }
  .th b { font-family: 'Cinzel', serif; font-size: 1.3em; line-height: 1.1; }
  .cmp, .stats { display: grid; grid-template-columns: 1fr auto auto auto; gap: 3px 10px; font-variant-numeric: tabular-nums; align-items: baseline; }
  .stats { grid-template-columns: 1fr auto; }
  .k { color: #6b5030; }
  .from { color: #6b5030; text-align: right; }
  .arr { color: #9a8060; }
  .to, .v { font-weight: 800; text-align: right; }
  .to.better { color: #2e7d32; }
  .to.worse { color: #b23a2a; }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tags span { font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; padding: 1px 7px; border: 1px solid rgba(43, 29, 18, 0.4); border-radius: 3px; }
  .btns { display: grid; grid-template-columns: 1.3fr 1fr; gap: 8px; }
  .btns.one { grid-template-columns: 1fr; }
  .btns .btn, .rally { display: flex; justify-content: center; align-items: center; gap: 8px; padding: 8px 10px; font-size: 0.95em; }
  .poor { filter: grayscale(0.7) brightness(0.85); }
  .hint { margin: 0; font-size: 0.92em; }
  .specs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .spec, .sk { cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 4px; padding: 8px; border-radius: 8px; border: 2px solid var(--wood); background: rgba(255, 255, 255, 0.45); color: var(--ink); font: inherit; }
  .spec:hover, .sk:hover:not(:disabled), .spec:focus-visible, .sk:focus-visible { border-color: var(--gold-2); background: rgba(255, 255, 255, 0.7); }
  .sk:disabled { cursor: default; opacity: 0.75; }
  .spec b, .sk b { font-size: 0.98em; }
  .desc { font-size: 12.5px; color: #5a4128; line-height: 1.3; }
  .mini { display: flex; flex-direction: column; gap: 1px; font-size: 12px; color: #5a4128; }
  .mini i { font-style: normal; font-weight: 800; color: var(--ink); }
  .cost { display: inline-flex; align-items: center; gap: 4px; font-weight: 800; color: #7a4d06; margin-top: auto; }
  .skills { display: grid; grid-template-columns: 1fr; gap: 6px; }
  .sn { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .pips { display: flex; gap: 3px; }
  .pips i { width: 9px; height: 9px; border-radius: 50%; background: rgba(0, 0, 0, 0.2); }
  .pips i.on { background: #d99a1e; }
  .undo { margin: 0; font-size: 12px; color: #6b5030; }
  .kbd { margin-left: 2px; }
</style>
