<script lang="ts">
  import { FAMILIES, TOWERS } from '@dfend/shared';
  import { app } from '../app';
  import { ui } from '../state.svelte';
  import { keyLabel, keys } from '../settings';
  import { FAMILY_COLOR, FAMILY_ICON, ICON } from './icons';
  import { sellValue as sellOf } from './towerStats';

  const sel = $derived(ui.sel!);
  const gold = $derived(ui.hud.gold);
  let tip = $state<{ title: string; text: string; cost?: number } | null>(null);
  /** infobulle à gauche quand le menu est dans le tiers droit de l'écran */
  let flip = $state(false);
  const place = (e: PointerEvent) => (flip = (e.currentTarget as HTMLElement).getBoundingClientRect().left > window.innerWidth * 0.6);
  const g = () => app.game;
  const R = 74;
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
</script>

<div class="radial ui" role="menu" tabindex="-1" onpointerover={place} onpointerleave={() => { tip = null; if (app.game) { app.game.hoverFam = -1; app.game.hoverLevel = -1; } }}>
  <div class="ring"></div>
  {#if sel.kind === 'build'}
    {#each FAMILIES as f, i}
      {@const t = TOWERS[f][0]}
      <button class="opt" class:poor={gold < t.cost} style={at(-90 + i * 90)}
        onpointerenter={() => { tip = { title: t.name, text: t.desc + ' ' + statLine(f, 0), cost: t.cost }; if (app.game) app.game.hoverFam = i; }}
        onclick={() => g()?.build(i)}>
        <span class="face hex" style="--fc:{FAMILY_COLOR[i]}">{@html FAMILY_ICON[i]}</span>
        <span class="cost">{t.cost}</span>
        <span class="kbd">{keyLabel([keys.buildArcher, keys.buildBarracks, keys.buildMage, keys.buildArtillery][i])}</span>
      </button>
    {/each}
  {:else if sel.kind === 'tower' && sel.mine}
    {#if lvl < 2}
      {@const next = TOWERS[fam][lvl + 1]}
      <button class="opt up" class:poor={gold < next.cost} style={at(-90)}
        onpointerenter={() => { tip = { title: next.name, text: next.desc + ' ' + statLine(fam, lvl + 1), cost: next.cost }; if (app.game) app.game.hoverLevel = lvl + 1; }}
        onclick={() => g()?.upgrade()}>
        <span class="face hex" style="--fc:var(--gold)">{@html ICON.up}</span><span class="cost">{next.cost}</span><span class="kbd">{keyLabel(keys.upgrade)}</span>
      </button>
    {:else if lvl === 2}
      {#each [1, 2] as s}
        {@const spec = TOWERS[fam][2 + s]}
        <button class="opt spec" class:poor={gold < spec.cost} style={at(s === 1 ? -130 : -50)}
          onpointerenter={() => { tip = { title: spec.name, text: spec.desc + ' ' + statLine(fam, 2 + s), cost: spec.cost }; if (app.game) app.game.hoverLevel = 2 + s; }}
          onclick={() => g()?.upgrade(s as 1 | 2)}>
          <span class="face hex" style="--fc:{FAMILY_COLOR[sel.fam ?? 0]}">{#if ui.portraits[`t_${sel.fam}_${2 + s}`]}<img src={ui.portraits[`t_${sel.fam}_${2 + s}`]} alt="" />{:else}{@html FAMILY_ICON[sel.fam ?? 0]}{/if}</span>
          <span class="cost">{spec.cost}</span>
        </button>
      {/each}
    {:else}
      {#each TOWERS[fam][lvl].skills ?? [] as s, i}
        {@const rank = sk[i]}
        {@const cost = rank < 3 ? s.costs[rank] : 0}
        <button class="opt skill" class:poor={rank < 3 && gold < cost} class:max={rank >= 3} style={at(i === 0 ? -130 : -50)}
          onpointerenter={() => (tip = { title: `${s.name} (rang ${rank}/3)`, text: s.desc, cost: rank < 3 ? cost : undefined })}
          onclick={() => rank < 3 && g()?.skill(i as 0 | 1)}>
          <span class="sname">{s.name}</span>
          <span class="pips">{#each [0, 1, 2] as k}<i class:on={k < rank}></i>{/each}</span>
          {#if rank < 3}<span class="cost">{cost}</span>{/if}
        </button>
      {/each}
    {/if}
    <button class="opt sell" style={at(90)} onpointerenter={() => (tip = { title: 'Vendre', text: `Rend ${sellValue} or (100 % pendant 3 s après un achat).` })} onclick={() => g()?.sell()}>
      <span class="face hex neutral">{@html ICON.sell}</span><span class="cost">+{sellValue}</span><span class="kbd">{keyLabel(keys.sell)}</span>
    </button>
    {#if fam === 'barracks'}
      <button class="opt" style={at(180)} onpointerenter={() => (tip = { title: 'Point de ralliement', text: 'Choisissez où vos soldats se postent.' })} onclick={() => g()?.startRally()}>
        <span class="face hex neutral">{@html ICON.flag}</span><span class="kbd">{keyLabel(keys.rally)}</span>
      </button>
    {/if}
  {/if}
  {#if tip}
    <div class="tip panel" class:flip>
      <b>{tip.title}</b>{#if tip.cost !== undefined} <span class="tc" class:poor={gold < tip.cost}>{@html ICON.coin}{tip.cost}</span>{/if}
      <div>{tip.text}</div>
    </div>
  {/if}
</div>

<style>
  .radial { position: absolute; left: 0; top: 0; width: 0; height: 0; animation: pop 0.12s ease; filter: var(--drop); }
  .ring { position: absolute; left: -76px; top: -76px; width: 152px; height: 152px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.45); pointer-events: none; }
  .opt { position: absolute; transform: translate(-50%, -50%); width: 66px; height: 60px; cursor: pointer; border: 0; padding: 0; background: none; display: grid; place-items: center; transition: transform 0.1s; }
  .opt:hover { transform: translate(-50%, -50%) scale(1.08); }
  .face { width: 66px; height: 60px; display: grid; place-items: center; background: var(--fc); color: var(--line); box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.22); }
  .face :global(.icon) { width: 30px; height: 30px; }
  .face.neutral { background: var(--raised-2); color: var(--text); }
  .face.neutral :global(.icon) { color: var(--gold); }
  .opt:hover .face { filter: brightness(1.12); }
  .opt.poor .face { filter: saturate(0.15) brightness(0.7); }
  .opt.spec { width: 72px; height: 66px; }
  .opt.spec .face { width: 72px; height: 66px; overflow: hidden; }
  .opt.spec img { width: 64px; height: 64px; }
  .opt.skill { width: 86px; height: 62px; color: var(--text); font-size: 11px; font-weight: 700; line-height: 1.1; text-align: center; padding: 6px 6px 14px;
    background: linear-gradient(135deg, transparent var(--cut-sm), var(--raised) 0) left / 50.5% 100% no-repeat, linear-gradient(-45deg, transparent var(--cut-sm), var(--raised) 0) right / 50.5% 100% no-repeat; }
  .opt.skill.max { color: var(--gold); }
  .sname { display: block; }
  .pips { position: absolute; bottom: 7px; display: flex; gap: 3px; }
  .pips i { width: 7px; height: 7px; background: var(--line); }
  .pips i.on { background: var(--gold); }
  .cost { position: absolute; bottom: -13px; font-size: 12.5px; font-weight: 700; color: var(--gold); background: var(--line); padding: 0 7px; font-variant-numeric: tabular-nums; }
  .opt .kbd { position: absolute; top: -8px; right: -4px; font-size: 11px; }
  .tip { position: absolute; left: 96px; top: -44px; width: 270px; padding: 10px 12px; font-size: 0.86em; z-index: 5; display: flex; flex-direction: column; gap: 4px; }
  .tip b { font-family: var(--font-display); font-size: 1.3em; }
  .tip div { color: var(--muted); }
  .tip.flip { left: auto; right: 96px; }
  .tc { display: inline-flex; align-items: center; gap: 3px; font-weight: 700; color: var(--gold); font-variant-numeric: tabular-nums; }
  .tc.poor { color: var(--bad); }
</style>
