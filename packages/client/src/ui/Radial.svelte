<script lang="ts">
  import { FAMILIES, SELL_RATIO, TOWERS, investedCost } from '@dfend/shared';
  import { app } from '../app';
  import { ui } from '../state.svelte';
  import { keyLabel, keys } from '../settings';
  import { FAMILY_ICON, FAMILY_NAME, ICON } from './icons';
  import { UPGRADE_ICON } from './skillIcons';

  const sel = $derived(ui.sel!);
  const gold = $derived(ui.hud.gold);
  let tip = $state<{ title: string; text: string; cost?: number } | null>(null);
  const g = () => app.game;
  const R = 74;
  const at = (angleDeg: number, r = R) => {
    const a = (angleDeg * Math.PI) / 180;
    return `left:${Math.cos(a) * r}px;top:${Math.sin(a) * r}px`;
  };

  const fam = $derived(sel.fam !== undefined ? FAMILIES[sel.fam] : 'archer');
  const lvl = $derived(sel.level ?? 0);
  const sk = $derived(sel.sk ?? [0, 0]);
  const skillCost = (i: number) => {
    const s = TOWERS[fam][lvl].skills?.[i];
    if (!s) return 0;
    let c = 0;
    for (let r = 0; r < sk[i]; r++) c += s.costs[r];
    return c;
  };
  const sellValue = $derived(Math.floor((investedCost(fam, lvl) + skillCost(0) + skillCost(1)) * SELL_RATIO));
  const statLine = (fi: string, l: number) => {
    const t = TOWERS[fi as keyof typeof TOWERS][l];
    if (t.soldiers) return `${t.soldiers.count} soldats · ${t.soldiers.hp} PV · ${t.soldiers.dmg[0]}-${t.soldiers.dmg[1]} dégâts · armure ${Math.round(t.soldiers.armor * 100)} %`;
    const dps = ((t.dmg[0] + t.dmg[1]) / 2 / t.cooldown) * (t.burst ?? 1);
    return `${t.dmg[0]}-${t.dmg[1]} ${t.dmgType === 1 ? 'magiques' : 'physiques'} · portée ${t.range} · ${dps.toFixed(0)} dégâts/s${t.hitsAir ? ' · anti-air' : ''}${t.splash ? ' · zone' : ''}`;
  };
</script>

<div class="radial ui" role="menu" tabindex="-1" onpointerleave={() => { tip = null; if (app.game) app.game.hoverFam = -1; }}>
  <div class="ring"></div>
  {#if sel.kind === 'build'}
    {#each FAMILIES as f, i}
      {@const t = TOWERS[f][0]}
      <button class="opt" class:poor={gold < t.cost} style={at(-90 + i * 90)}
        onpointerenter={() => { tip = { title: t.name, text: t.desc + ' ' + statLine(f, 0), cost: t.cost }; if (app.game) app.game.hoverFam = i; }}
        onclick={() => g()?.build(i)}>
        {@html FAMILY_ICON[i]}
        <span class="cost">{t.cost}</span>
        <span class="kbd">{keyLabel([keys.buildArcher, keys.buildBarracks, keys.buildMage, keys.buildArtillery][i])}</span>
      </button>
    {/each}
  {:else if sel.kind === 'tower' && sel.mine}
    {#if lvl < 2}
      {@const next = TOWERS[fam][lvl + 1]}
      <button class="opt up" class:poor={gold < next.cost} style={at(-90)}
        onpointerenter={() => (tip = { title: next.name, text: next.desc + ' ' + statLine(fam, lvl + 1), cost: next.cost })}
        onclick={() => g()?.upgrade()}>
        {@html ICON.up}<span class="cost">{next.cost}</span><span class="kbd">{keyLabel(keys.upgrade)}</span>
      </button>
    {:else if lvl === 2}
      {#each [1, 2] as s}
        {@const spec = TOWERS[fam][2 + s]}
        <button class="opt spec" class:poor={gold < spec.cost} style={at(s === 1 ? -130 : -50)}
          onpointerenter={() => (tip = { title: spec.name, text: spec.desc + ' ' + statLine(fam, 2 + s), cost: spec.cost })}
          onclick={() => g()?.upgrade(s as 1 | 2)}>
          {#if ui.portraits[`t_${sel.fam}_${2 + s}`]}<img src={ui.portraits[`t_${sel.fam}_${2 + s}`]} alt="" />{:else}{@html FAMILY_ICON[sel.fam ?? 0]}{/if}
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
          {#if UPGRADE_ICON[s.id]}<span class="sicon">{@html UPGRADE_ICON[s.id]}</span>{:else}<span class="sname">{s.name}</span>{/if}
          <span class="pips">{#each [0, 1, 2] as k}<i class:on={k < rank}></i>{/each}</span>
          {#if rank < 3}<span class="cost">{cost}</span>{/if}
        </button>
      {/each}
    {/if}
    <button class="opt sell" style={at(90)} onpointerenter={() => (tip = { title: 'Vendre', text: `Rend ${sellValue} or (100 % pendant 3 s après un achat).` })} onclick={() => g()?.sell()}>
      {@html ICON.sell}<span class="cost">+{sellValue}</span><span class="kbd">{keyLabel(keys.sell)}</span>
    </button>
    {#if fam === 'barracks'}
      <button class="opt" style={at(180)} onpointerenter={() => (tip = { title: 'Point de ralliement', text: 'Choisissez où vos soldats se postent.' })} onclick={() => g()?.startRally()}>
        {@html ICON.flag}<span class="kbd">{keyLabel(keys.rally)}</span>
      </button>
    {/if}
  {/if}
  {#if tip}
    <div class="tip panel">
      <b>{tip.title}</b>{#if tip.cost !== undefined} <span class="tc" class:poor={gold < tip.cost}>{@html ICON.coin}{tip.cost}</span>{/if}
      <div>{tip.text}</div>
    </div>
  {/if}
</div>

<style>
  .radial { position: absolute; left: 0; top: 0; width: 0; height: 0; animation: pop 0.15s ease; }
  .ring { position: absolute; left: -76px; top: -76px; width: 152px; height: 152px; border-radius: 50%; border: 3px dashed rgba(255, 243, 196, 0.55); pointer-events: none; }
  .opt {
    position: absolute; transform: translate(-50%, -50%); width: 58px; height: 58px; border-radius: 50%; cursor: pointer;
    border: 3px solid var(--wood-dark); background: radial-gradient(circle at 35% 30%, #fff4cf, #d9a94e);
    font-size: 28px; display: grid; place-items: center; padding: 0; color: var(--ink);
    box-shadow: 0 3px 0 var(--wood-dark), 0 6px 12px rgba(0, 0, 0, 0.45); transition: transform 0.1s;
  }
  .opt:hover { transform: translate(-50%, -50%) scale(1.12); }
  .opt.poor { filter: grayscale(0.8) brightness(0.8); }
  .opt.up { background: radial-gradient(circle at 35% 30%, #dcfce7, #4caf50); }
  .opt.sell { background: radial-gradient(circle at 35% 30%, #fff7d1, #c98a14); }
  .opt.spec { width: 66px; height: 66px; overflow: visible; }
  .opt.spec img { width: 62px; height: 62px; border-radius: 50%; }
  .opt.skill { width: 74px; height: 74px; font-size: 10px; font-weight: 800; background: radial-gradient(circle at 35% 30%, #e0e7ff, #6366f1); color: #fff; text-shadow: 0 1px 2px #000; line-height: 1.05; text-align: center; padding: 6px; }
  .opt.skill.max { background: radial-gradient(circle at 35% 30%, #fff7d1, #c98a14); }
  .sname { display: block; }
  .sicon :global(svg.icon) { width: 38px; height: 38px; margin-top: -8px; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5)); }
  .pips { position: absolute; bottom: 8px; display: flex; gap: 3px; }
  .pips i { width: 7px; height: 7px; border-radius: 50%; background: rgba(0, 0, 0, 0.4); }
  .pips i.on { background: #fde047; }
  .cost { position: absolute; bottom: -12px; font-size: 12px; font-weight: 800; color: #ffe08a; background: #2b1d12; padding: 0 6px; border-radius: 99px; }
  .opt .kbd { position: absolute; top: -6px; right: -6px; font-size: 10px; }
  .tip { position: absolute; left: 92px; top: -40px; width: 260px; padding: 8px 10px; font-size: 0.82em; z-index: 5; }
  .tc { display: inline-flex; align-items: center; gap: 2px; font-weight: 800; color: #7a4d06; }
  .tc.poor { color: var(--red); }
</style>
