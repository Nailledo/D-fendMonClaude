<script lang="ts">
  import { FAMILIES, TOWERS } from '@dfend/shared';
  import { app } from '../app';
  import { ui } from '../state.svelte';
  import { keyLabel, keys } from '../settings';
  import { FAMILY_COLOR, FAMILY_ICON, ICON } from './icons';
  import { sellValue as sellOf } from './towerStats';
  import { UPGRADE_ICON } from './skillIcons';
  import { fit } from './fit';

  type Tip = { title: string; text: string; cost?: number };
  const sel = $derived(ui.sel!);
  const gold = $derived(ui.hud.gold);
  let tip = $state<Tip | null>(null);
  /** option armée au tactile : un premier appui la montre, un second la confirme */
  let armed = $state<string | null>(null);
  /** infobulle à gauche quand le menu est dans le tiers droit de l'écran */
  let flip = $state(false);
  const place = (e: PointerEvent) => (flip = (e.currentTarget as HTMLElement).getBoundingClientRect().left > window.innerWidth * 0.6);
  const g = () => app.game;
  const R = $derived(ui.touch ? (ui.short ? 70 : 82) : 74);
  const at = (angleDeg: number, r = R) => {
    const a = (angleDeg * Math.PI) / 180;
    return `left:${Math.cos(a) * r}px;top:${Math.sin(a) * r}px`;
  };

  const fam = $derived(sel.fam !== undefined ? FAMILIES[sel.fam] : 'archer');
  const lvl = $derived(sel.level ?? 0);
  const sk = $derived(sel.sk ?? [0, 0]);
  const sellValue = $derived(sellOf(sel.fam ?? 0, lvl, sk as [number, number]));
  const statLine = (fi: string, l: number) => {
    const t = TOWERS[fi as keyof typeof TOWERS][l];
    if (t.soldiers) return `${t.soldiers.count} soldats · ${t.soldiers.hp} PV · ${t.soldiers.dmg[0]}-${t.soldiers.dmg[1]} dégâts · armure ${Math.round(t.soldiers.armor * 100)} %`;
    const dps = ((t.dmg[0] + t.dmg[1]) / 2 / t.cooldown) * (t.burst ?? 1);
    return `${t.dmg[0]}-${t.dmg[1]} ${t.dmgType === 1 ? 'magiques' : 'physiques'} · portée ${t.range} · ${dps.toFixed(0)} dégâts/s${t.hitsAir ? ' · anti-air' : ''}${t.splash ? ' · zone' : ''}`;
  };

  // une autre sélection (autre emplacement, tour améliorée…) désarme
  $effect(() => {
    void sel.kind; void sel.slot; void sel.level; void sel.sk?.[0]; void sel.sk?.[1];
    armed = null;
    ui.radialTip = null;
    if (app.game) { app.game.hoverFam = -1; app.game.hoverLevel = -1; }
  });
  $effect(() => () => {
    ui.radialTip = null;
    if (app.game) { app.game.hoverFam = -1; app.game.hoverLevel = -1; }
  });

  function preview(t: Tip, famHover = -1, levelHover = -1) {
    tip = t;
    if (app.game) { app.game.hoverFam = famHover; app.game.hoverLevel = levelHover; }
  }
  /** Au tactile, le premier appui arme l'option (aperçu de portée et prix), le second exécute. */
  function act(key: string, t: Tip, run: () => void, famHover = -1, levelHover = -1) {
    if (ui.touch && armed !== key) {
      armed = key;
      preview(t, famHover, levelHover);
      ui.radialTip = t;
      navigator.vibrate?.(8);
      return;
    }
    armed = null;
    ui.radialTip = null;
    run();
  }
</script>

<div class="radial ui" class:touch={ui.touch} class:short={ui.touch && ui.short} role="menu" tabindex="-1" onpointerover={place} onpointerleave={() => { if (ui.touch) return; tip = null; if (app.game) { app.game.hoverFam = -1; app.game.hoverLevel = -1; } }}>
  <div class="ring" style="left:{-R - 2}px;top:{-R - 2}px;width:{R * 2 + 4}px;height:{R * 2 + 4}px"></div>
  {#if sel.kind === 'build'}
    {#each FAMILIES as f, i}
      {@const t = TOWERS[f][0]}
      {@const tp = { title: t.name, text: t.desc + ' ' + statLine(f, 0), cost: t.cost }}
      <button class="opt" class:poor={gold < t.cost} class:armed={armed === 'b' + i} style={at(-90 + i * 90)}
        onpointerenter={(e) => e.pointerType !== 'touch' && preview(tp, i)}
        onclick={() => act('b' + i, tp, () => g()?.build(i), i)}>
        <span class="face hex" style="--fc:{FAMILY_COLOR[i]}">{@html FAMILY_ICON[i]}</span>
        <span class="cost">{t.cost}</span>
        <span class="kbd">{keyLabel([keys.buildArcher, keys.buildBarracks, keys.buildMage, keys.buildArtillery][i])}</span>
      </button>
    {/each}
  {:else if sel.kind === 'tower'}
    {#if lvl < 2}
      {@const next = TOWERS[fam][lvl + 1]}
      {@const tp = { title: next.name, text: next.desc + ' ' + statLine(fam, lvl + 1), cost: next.cost }}
      <button class="opt up" class:poor={gold < next.cost} class:armed={armed === 'up'} style={at(-90)}
        onpointerenter={(e) => e.pointerType !== 'touch' && preview(tp, -1, lvl + 1)}
        onclick={() => act('up', tp, () => g()?.upgrade(), -1, lvl + 1)}>
        <span class="face hex" style="--fc:var(--gold)">{@html ICON.up}</span><span class="cost">{next.cost}</span><span class="kbd">{keyLabel(keys.upgrade)}</span>
      </button>
    {:else if lvl === 2}
      {#each [1, 2] as s}
        {@const spec = TOWERS[fam][2 + s]}
        {@const tp = { title: spec.name, text: spec.desc + ' ' + statLine(fam, 2 + s), cost: spec.cost }}
        <button class="opt spec" class:poor={gold < spec.cost} class:armed={armed === 's' + s} style={at(s === 1 ? -130 : -50)}
          onpointerenter={(e) => e.pointerType !== 'touch' && preview(tp, -1, 2 + s)}
          onclick={() => act('s' + s, tp, () => g()?.upgrade(s as 1 | 2), -1, 2 + s)}>
          <span class="face hex" style="--fc:{FAMILY_COLOR[sel.fam ?? 0]}">{#if ui.portraits[`t_${sel.fam}_${2 + s}`]}<img src={ui.portraits[`t_${sel.fam}_${2 + s}`]} alt="" />{:else}{@html FAMILY_ICON[sel.fam ?? 0]}{/if}</span>
          <span class="cost">{spec.cost}</span>
        </button>
      {/each}
    {:else}
      {#each TOWERS[fam][lvl].skills ?? [] as s, i}
        {@const rank = sk[i]}
        {@const cost = rank < 3 ? s.costs[rank] : 0}
        {@const tp = { title: `${s.name} (rang ${rank}/3)`, text: s.desc, cost: rank < 3 ? cost : undefined }}
        <button class="opt skill" class:poor={rank < 3 && gold < cost} class:max={rank >= 3} class:armed={armed === 'k' + i} style={at(i === 0 ? -130 : -50)}
          onpointerenter={(e) => e.pointerType !== 'touch' && preview(tp)}
          onclick={() => rank < 3 && act('k' + i, tp, () => g()?.skill(i as 0 | 1))}>
          {#if UPGRADE_ICON[s.id]}<span class="sicon">{@html UPGRADE_ICON[s.id]}</span>{:else}<span class="sname">{s.name}</span>{/if}
          <span class="pips">{#each [0, 1, 2] as k}<i class:on={k < rank}></i>{/each}</span>
          {#if rank < 3}<span class="cost">{cost}</span>{/if}
        </button>
      {/each}
    {/if}
    {#if sel.mine}
      {@const tp = { title: 'Vendre', text: `Rend ${sellValue} or (100 % pendant 3 s après un achat).` }}
      <button class="opt sell" class:armed={armed === 'sell'} style={at(90)} onpointerenter={(e) => e.pointerType !== 'touch' && preview(tp)} onclick={() => act('sell', tp, () => g()?.sell())}>
        <span class="face hex neutral">{@html ICON.sell}</span><span class="cost">+{sellValue}</span><span class="kbd">{keyLabel(keys.sell)}</span>
      </button>
      {#if fam === 'barracks'}
        <button class="opt" style={at(180)} onpointerenter={(e) => e.pointerType !== 'touch' && preview({ title: 'Point de ralliement', text: 'Choisissez où vos soldats se postent.' })} onclick={() => g()?.startRally()}>
          <span class="face hex neutral">{@html ICON.flag}</span><span class="kbd">{keyLabel(keys.rally)}</span>
        </button>
      {/if}
    {/if}
  {/if}
  {#if tip && !ui.touch}
    <div class="tip panel" class:flip use:fit>
      <b>{tip.title}</b>{#if tip.cost !== undefined} <span class="tc" class:poor={gold < tip.cost}>{@html ICON.coin}{tip.cost}</span>{/if}
      <div>{tip.text}</div>
    </div>
  {/if}
</div>

<style>
  .radial { position: absolute; left: 0; top: 0; width: 0; height: 0; animation: radialIn 0.18s cubic-bezier(0.2, 1.4, 0.4, 1); }
  @keyframes radialIn { from { transform: scale(0.6); opacity: 0; } }
  .ring { position: absolute; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.45); background: radial-gradient(circle, rgba(15, 19, 22, 0) 55%, rgba(15, 19, 22, 0.25) 100%); pointer-events: none; }
  .opt { position: absolute; transform: translate(-50%, -50%); width: 62px; height: 62px; cursor: pointer; border: 0; padding: 0; background: none; display: grid; place-items: center; transition: transform 0.12s; touch-action: manipulation; }
  .opt:hover { transform: translate(-50%, -50%) scale(1.08); }
  .face { width: 62px; height: 62px; display: grid; place-items: center; background: var(--fc); color: var(--line); border: 3px solid rgba(255, 255, 255, 0.85);
    box-shadow: inset 0 -5px 0 rgba(0, 0, 0, 0.22), 0 3px 0 rgba(8, 10, 12, 0.6), 0 6px 14px rgba(0, 0, 0, 0.35); }
  .face :global(.icon) { width: 30px; height: 30px; }
  .face.neutral { background: var(--raised-2); color: var(--text); }
  .face.neutral :global(.icon) { color: var(--gold); }
  .opt:hover .face { filter: brightness(1.12); }
  .opt.poor .face { filter: saturate(0.15) brightness(0.7); }
  .opt.spec { width: 70px; height: 70px; }
  .opt.spec .face { width: 70px; height: 70px; overflow: hidden; }
  .opt.spec img { width: 64px; height: 64px; }
  .opt.skill { width: 82px; height: 64px; color: var(--text); font-size: 11px; font-weight: 700; line-height: 1.1; text-align: center; padding: 6px 6px 14px;
    background: var(--raised); border-radius: var(--r); box-shadow: var(--rim), var(--shadow-sm); }
  .opt.skill.max { color: var(--gold); }
  .sname { display: block; }
  .sicon :global(svg.icon) { width: 32px; height: 32px; margin-top: -6px; filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.45)); }
  .pips { position: absolute; bottom: 7px; display: flex; gap: 3px; }
  .pips i { width: 7px; height: 7px; border-radius: 50%; background: var(--line); }
  .pips i.on { background: var(--gold); }
  .cost { position: absolute; bottom: -12px; font-size: 12.5px; font-weight: 700; color: var(--gold); background: var(--line); padding: 0 8px; border-radius: 99px; font-variant-numeric: tabular-nums; }
  .opt .kbd { position: absolute; top: -8px; right: -4px; font-size: 11px; }
  .tip { position: absolute; left: 100px; top: -44px; width: min(270px, calc(100vw - 24px)); padding: 10px 12px; font-size: 0.86em; z-index: 5; display: flex; flex-direction: column; gap: 4px; animation: pop 0.1s ease; }
  .tip.flip { left: auto; right: 100px; }
  .tip b { font-family: var(--font-display); font-size: 1.3em; }
  .tip div { color: var(--muted); }
  .tc { display: inline-flex; align-items: center; gap: 3px; font-weight: 700; color: var(--gold); font-variant-numeric: tabular-nums; }
  .tc.poor { color: var(--bad); }

  /* tactile : options plus grandes, l'option armée gonfle et pulse en attendant la confirmation */
  .touch .opt, .touch .face { width: 66px; height: 66px; }
  .touch.short .opt, .touch.short .face { width: 58px; height: 58px; }
  .touch.short .face :global(.icon) { width: 26px; height: 26px; }
  .touch .opt .kbd { display: none; }
  .touch .opt:hover { transform: translate(-50%, -50%); }
  .opt.armed { transform: translate(-50%, -50%) scale(1.16); z-index: 2; }
  .touch .opt.armed:hover { transform: translate(-50%, -50%) scale(1.16); }
  .opt.armed .face, .opt.skill.armed { border-color: var(--gold); }
  .opt.armed::after { content: ''; position: absolute; inset: -7px; border-radius: 50%; border: 3px solid var(--gold); animation: armed 1s ease-out infinite; pointer-events: none; }
  .opt.skill.armed::after { border-radius: var(--r); }
  .opt.skill.armed { box-shadow: inset 0 0 0 3px var(--gold), var(--shadow-sm); }
  @keyframes armed { from { opacity: 1; transform: scale(0.95); } to { opacity: 0; transform: scale(1.3); } }
</style>
