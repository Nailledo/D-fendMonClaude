<script lang="ts">
  import Ico from './Ico.svelte';
  import { FAMILIES, PRIO_NAMES, SHOOTERS, TOWERS, UNDO_SELL_S } from '@dfend/shared';
  import { app } from '../app';
  import { keyLabel, keys } from '../settings';
  import { ui } from '../state.svelte';
  import { FAMILY_COLOR, FAMILY_NAME, ICON } from './icons';
  import { LEVEL_LABEL, compareStats, sellValue, towerStats, towerTags } from './towerStats';

  const sel = $derived(ui.sel!);
  const gold = $derived(ui.hud.gold);
  const fi = $derived(sel.fam ?? 0);
  const fam = $derived(FAMILIES[fi]);
  const lvl = $derived(sel.level ?? 0);
  const sk = $derived((sel.sk ?? [0, 0]) as [number, number]);
  const cur = $derived(TOWERS[fam][lvl]);
  const next = $derived(lvl < 2 ? TOWERS[fam][lvl + 1] : null);
  const prep = $derived(ui.hud.state === 0);
  const sell = $derived(sellValue(fi, lvl, sk, prep));
  const mine = $derived(sel.mine !== false);
  const ownerName = $derived(ui.hud.players.find((p) => p.id === sel.owner)?.name ?? 'un allié');
  const g = () => app.game;
  /** aperçu de portée au sol pendant le survol d'une amélioration */
  const hover = (target: number) => {
    if (app.game) app.game.hoverLevel = target;
  };
</script>

<div class="tp panel ui sheet-{ui.touch ? ui.sheet : 'none'}" class:open={!ui.touch || ui.panelOpen} role="region" aria-label="Tour sélectionnée" style="--fc:{FAMILY_COLOR[fi]}; --accent:{FAMILY_COLOR[fi]}" onpointerleave={() => hover(-1)}>
  <div class="th">
    <small>{FAMILY_NAME[fi]} · {LEVEL_LABEL[lvl]}{#if !mine} · à {ownerName}{/if}</small>
    <b>{cur.name}</b>
    {#if ui.touch}
      <button class="btn small ghost more" class:open={ui.panelOpen} aria-expanded={ui.panelOpen} onclick={() => (ui.panelOpen = !ui.panelOpen)}>
        {ui.panelOpen ? 'Moins' : 'Détails'}{@html ICON.down}
      </button>
    {/if}
  </div>
  {#if !ui.touch || ui.panelOpen}

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
      {#if mine}<button class="btn" onclick={() => g()?.sell()}>Vendre +{sell}<span class="kbd">{keyLabel(keys.sell)}</span></button>{/if}
    </div>
  {:else if lvl === 2}
    <p class="hint">Choisissez une spécialisation : elle débloque deux compétences.</p>
    <div class="specs">
      {#each [1, 2] as s}
        {@const spec = TOWERS[fam][2 + s]}
        <button class="spec" style="--fc:{FAMILY_COLOR[fi]}" class:poor={gold < spec.cost} onpointerenter={() => hover(2 + s)} onfocus={() => hover(2 + s)} onclick={() => g()?.upgrade(s as 1 | 2)}>
          <b>{spec.name}</b>
          <span class="desc">{spec.desc}</span>
          <span class="mini">{#each towerStats(fam, 2 + s).slice(0, 4) as r}<span>{r.label} <i>{r.text}</i></span>{/each}</span>
          <span class="cost"><Ico k="coin" fb={ICON.coin} />{spec.cost}</span>
        </button>
      {/each}
    </div>
    {#if mine}<div class="btns one"><button class="btn" onclick={() => g()?.sell()}>Vendre +{sell}<span class="kbd">{keyLabel(keys.sell)}</span></button></div>{/if}
  {:else}
    <div class="stats">{#each towerStats(fam, lvl) as r}<span class="k">{r.label}</span><span class="v">{r.text}</span>{/each}</div>
    <div class="skills">
      {#each cur.skills ?? [] as s, i}
        {@const rank = sk[i]}
        <button class="sk" class:poor={rank < 3 && gold < s.costs[rank]} disabled={rank >= 3} onclick={() => g()?.skill(i as 0 | 1)}>
          <span class="sn"><b>{s.name}</b><span class="pips">{#each [0, 1, 2] as k}<i class:on={k < rank}></i>{/each}</span></span>
          <span class="desc">{s.desc}</span>
          <span class="cost">{#if rank < 3}<Ico k="coin" fb={ICON.coin} />{s.costs[rank]}{:else}Maximum{/if}</span>
        </button>
      {/each}
    </div>
    {#if mine}<div class="btns one"><button class="btn" onclick={() => g()?.sell()}>Vendre +{sell}<span class="kbd">{keyLabel(keys.sell)}</span></button></div>{/if}
  {/if}

  {#if SHOOTERS.includes(fi) && mine}
    <div class="prio" role="radiogroup" aria-label="Priorité de ciblage">
      <span class="pl"><Ico k="target" fb={ICON.target} /> Cible<span class="kbd">{keyLabel(keys.prio)}</span></span>
      {#each PRIO_NAMES as n, p}
        <button role="radio" aria-checked={(sel.prio ?? 0) === p} class:on={(sel.prio ?? 0) === p} onclick={() => g()?.setPrio(p)}>{n}</button>
      {/each}
    </div>
  {/if}
  {#if fam === 'barracks' && mine}
    <button class="btn ghost rally" onclick={() => g()?.startRally()}><Ico k="flag" fb={ICON.flag} /> Déplacer le point de ralliement<span class="kbd">{keyLabel(keys.rally)}</span></button>
  {/if}
  {#if mine}
    <p class="undo">{prep ? 'Préparation : la revente rend tout l’or tant que la première vague n’est pas lancée.' : `Remboursement intégral pendant ${UNDO_SELL_S} s après un achat.`}</p>
  {:else}
    <p class="undo">Vous payez avec votre or ; seul {ownerName} peut vendre la tour.</p>
  {/if}
  {/if}
</div>

<style>
  .tp { position: absolute; right: 10px; bottom: 10px; width: min(360px, calc(100vw - 20px)); padding: 16px 16px 12px; display: flex; flex-direction: column; gap: 10px; font-size: 0.93em; max-height: calc(100vh - 140px); overflow: auto; }
  .th { position: relative; display: flex; flex-direction: column; gap: 3px; }
  .more { position: absolute; right: -4px; top: 50%; transform: translateY(-50%); padding: 6px 10px; min-height: 36px; gap: 4px; }
  .more :global(.icon) { transition: transform 0.15s; }
  .more.open :global(.icon) { transform: rotate(180deg); }
  .th small { align-self: flex-start; font-size: 11.5px; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink); background: var(--fc); border: 2px solid var(--ink); border-radius: 99px; padding: 0 9px; }
  .th b { font-family: var(--font-display); font-weight: 400; font-size: 1.75em; line-height: 1; }
  .cmp, .stats { display: grid; grid-template-columns: 1fr auto auto auto; gap: 4px 10px; font-variant-numeric: tabular-nums; align-items: baseline; }
  .stats { grid-template-columns: 1fr auto; }
  .k, .from, .arr { color: var(--muted); font-weight: 700; }
  .from { text-align: right; }
  .to, .v { font-weight: 900; text-align: right; }
  .to.better { color: var(--good); }
  .to.worse { color: var(--bad); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tags span { font-size: 11px; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; padding: 1px 8px; border-radius: 99px; border: 2px solid var(--ink); background: var(--panel-hi); }
  .btns { display: grid; grid-template-columns: 1.3fr 1fr; gap: 8px; }
  .btns.one { grid-template-columns: 1fr; }
  .btns .btn, .rally { padding: 9px 10px; font-size: 0.95em; }
  .poor { opacity: 0.6; }
  .hint { margin: 0; color: var(--muted); }
  .specs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .spec, .sk { cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 5px; padding: 10px; border: 2.5px solid var(--ink); color: var(--text); font: inherit;
    background: var(--toon-cream); border-radius: var(--r-sm); box-shadow: 0 3px 0 var(--ink); transition: transform 0.08s; }
  .spec { box-shadow: inset 0 6px 0 var(--fc), 0 3px 0 var(--ink); }
  .spec:hover, .sk:hover:not(:disabled), .spec:focus-visible, .sk:focus-visible { transform: translateY(-2px); }
  .sk:disabled { cursor: default; opacity: 0.7; }
  .spec b, .sk b { font-family: var(--font-display); font-weight: 400; font-size: 1.15em; }
  .desc { font-size: 12.5px; font-weight: 700; color: var(--muted); line-height: 1.3; }
  .mini { display: flex; flex-direction: column; gap: 1px; font-size: 12px; color: var(--muted); }
  .mini i { font-style: normal; font-weight: 900; color: var(--text); }
  .cost { display: inline-flex; align-items: center; gap: 4px; font-family: var(--font-display); font-size: 1.1em; color: #a05f00; margin-top: auto; font-variant-numeric: tabular-nums; }
  .skills { display: grid; grid-template-columns: 1fr; gap: 6px; }
  .sn { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .pips { display: flex; gap: 3px; }
  .pips i { width: 11px; height: 11px; border-radius: 50%; background: #d8bf8f; border: 1.5px solid var(--ink); }
  .pips i.on { background: var(--gold-fill); }
  .prio { display: grid; grid-template-columns: repeat(4, auto); justify-content: start; align-items: center; gap: 4px; }
  .prio .pl { grid-column: 1 / -1; }
  .prio .pl { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-right: 2px; }
  .prio button { font: inherit; font-size: 12px; font-weight: 900; padding: 4px 7px; min-height: 32px; white-space: nowrap; border: 2px solid var(--ink); border-radius: 99px; background: var(--toon-cream); color: var(--text); cursor: pointer; }
  .prio button.on { background: var(--fc); box-shadow: inset 0 -2px 0 rgba(0,0,0,0.2); }
  .undo { margin: 0; font-size: 12px; font-weight: 700; color: var(--faint); }
  .kbd { margin-left: 2px; }
</style>
