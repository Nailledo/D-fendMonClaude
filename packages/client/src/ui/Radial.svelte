<script lang="ts">
  import Ico from './Ico.svelte';
  import { FAMILIES, PRIO_NAMES, PROP_INFO, PropKind, SHOOTERS, TOWERS } from '@dfend/shared';
  import { app } from '../app';
  import { ui } from '../state.svelte';
  import { keyLabel, keys } from '../settings';
  import { FAMILY_COLOR, FAMILY_ICON, ICON } from './icons';
  import { ownCampAura, ownMineIncome, sellValue as sellOf } from './towerStats';
  import { UPGRADE_ICON } from './skillIcons';
  import { fit } from './fit';
  import { radialRadius } from './radialLayout';

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
  const R = $derived(radialRadius(sel, ui.touch, ui.touch && ui.short));
  const at = (angleDeg: number, r = R) => {
    const a = (angleDeg * Math.PI) / 180;
    return `left:${Math.cos(a) * r}px;top:${Math.sin(a) * r}px`;
  };

  const fam = $derived(sel.fam !== undefined ? FAMILIES[sel.fam] : 'archer');
  const lvl = $derived(sel.level ?? 0);
  const sk = $derived(sel.sk ?? [0, 0]);
  /** avant la première vague, la revente rend tout */
  const prep = $derived(ui.hud.state === 0);
  const sellValue = $derived(sellOf(sel.fam ?? 0, lvl, sk as [number, number], prep));
  const famKeys = $derived([keys.buildArcher, keys.buildBarracks, keys.buildMage, keys.buildArtillery, keys.buildMine, keys.buildCamp]);
  const PRIO_SHORT = ['1er', 'Dernier', 'Fort', 'Proche'];
  const PRIO_DESC = [
    'vise l’ennemi le plus avancé sur le chemin.',
    'vise l’ennemi le moins avancé : utile en fin de chemin.',
    'vise l’ennemi qui a le plus de PV.',
    'vise l’ennemi le plus proche de la tour.',
  ];
  const statLine = (fi: string, l: number) => {
    const t = TOWERS[fi as keyof typeof TOWERS][l];
    if (t.income !== undefined) return `+${ownMineIncome(l)} or au début de chaque vague · ne tire pas`;
    if (t.aura) { const a = ownCampAura(l); return `tours voisines (rayon ${+a.r.toFixed(1)}) : portée +${Math.round(a.range * 100)} %, cadence +${Math.round(a.rate * 100)} %${t.detect ? ' · repère les camouflés' : ''}`; }
    if (t.soldiers) return `${t.soldiers.count} soldats · ${t.soldiers.hp} PV · ${t.soldiers.dmg[0]}-${t.soldiers.dmg[1]} dégâts · armure ${Math.round(t.soldiers.armor * 100)} %`;
    const dps = ((t.dmg[0] + t.dmg[1]) / 2 / t.cooldown) * (t.burst ?? 1);
    return `${t.dmg[0]}-${t.dmg[1]} ${t.dmgType === 1 ? 'magiques' : 'physiques'} · portée ${t.range} · ${dps.toFixed(0)} dégâts/s${t.hitsAir ? ' · anti-air' : ''}${t.splash ? ' · zone' : ''}`;
  };

  // une autre sélection (autre emplacement, tour améliorée…) désarme
  $effect(() => {
    void sel.kind; void sel.slot; void sel.prop; void sel.level; void sel.sk?.[0]; void sel.sk?.[1];
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
      <button class="opt" class:poor={gold < t.cost} class:armed={armed === 'b' + i} style={at(-90 + i * (360 / FAMILIES.length))}
        onpointerenter={(e) => e.pointerType !== 'touch' && preview(tp, i)}
        onclick={() => act('b' + i, tp, () => g()?.build(i), i)}>
        <span class="face hex" style="--fc:{FAMILY_COLOR[i]}"><Ico k={'fam_' + i} fb={FAMILY_ICON[i]} /></span>
        <span class="cost">{t.cost}</span>
        <span class="kbd">{keyLabel(famKeys[i])}</span>
      </button>
    {/each}
  {:else if sel.kind === 'tower'}
    {#if lvl < 2}
      {@const next = TOWERS[fam][lvl + 1]}
      {@const tp = { title: next.name, text: next.desc + ' ' + statLine(fam, lvl + 1), cost: next.cost }}
      <button class="opt up" class:poor={gold < next.cost} class:armed={armed === 'up'} style={at(-90)}
        onpointerenter={(e) => e.pointerType !== 'touch' && preview(tp, -1, lvl + 1)}
        onclick={() => act('up', tp, () => g()?.upgrade(), -1, lvl + 1)}>
        <span class="face hex" style="--fc:var(--gold)"><Ico k="up" fb={ICON.up} /></span><span class="cost">{next.cost}</span><span class="kbd">{keyLabel(keys.upgrade)}</span>
      </button>
    {:else if lvl === 2}
      {#each [1, 2] as s}
        {@const spec = TOWERS[fam][2 + s]}
        {@const tp = { title: spec.name, text: spec.desc + ' ' + statLine(fam, 2 + s), cost: spec.cost }}
        <button class="opt spec" class:poor={gold < spec.cost} class:armed={armed === 's' + s} style={at(s === 1 ? -125 : -55)}
          onpointerenter={(e) => e.pointerType !== 'touch' && preview(tp, -1, 2 + s)}
          onclick={() => act('s' + s, tp, () => g()?.upgrade(s as 1 | 2), -1, 2 + s)}>
          <span class="face hex" style="--fc:{FAMILY_COLOR[sel.fam ?? 0]}">{#if ui.portraits[`t_${sel.fam}_${2 + s}`]}<img src={ui.portraits[`t_${sel.fam}_${2 + s}`]} alt="" />{:else}<Ico k={'fam_' + (sel.fam ?? 0)} fb={FAMILY_ICON[sel.fam ?? 0]} />{/if}</span>
          <span class="cost">{spec.cost}</span>
        </button>
      {/each}
    {:else}
      {#each TOWERS[fam][lvl].skills ?? [] as s, i}
        {@const rank = sk[i]}
        {@const cost = rank < 3 ? s.costs[rank] : 0}
        {@const tp = { title: `${s.name} (rang ${rank}/3)`, text: s.desc, cost: rank < 3 ? cost : undefined }}
        <button class="opt skill" class:poor={rank < 3 && gold < cost} class:max={rank >= 3} class:armed={armed === 'k' + i} style={at(i === 0 ? -125 : -55)}
          onpointerenter={(e) => e.pointerType !== 'touch' && preview(tp)}
          onclick={() => rank < 3 && act('k' + i, tp, () => g()?.skill(i as 0 | 1))}>
          {#if UPGRADE_ICON[s.id]}<span class="sicon"><Ico k={'up_' + s.id} fb={UPGRADE_ICON[s.id]} /></span>{:else}<span class="sname">{s.name}</span>{/if}
          <span class="pips">{#each [0, 1, 2] as k}<i class:on={k < rank}></i>{/each}</span>
          {#if rank < 3}<span class="cost">{cost}</span>{/if}
        </button>
      {/each}
    {/if}
    {#if sel.mine}
      {@const tp = { title: 'Vendre', text: prep ? `Rend ${sellValue} or : remboursement intégral tant que la première vague n’est pas lancée.` : `Rend ${sellValue} or (100 % pendant 3 s après un achat).` }}
      <button class="opt sell" class:armed={armed === 'sell'} style={at(90)} onpointerenter={(e) => e.pointerType !== 'touch' && preview(tp)} onclick={() => act('sell', tp, () => g()?.sell())}>
        <span class="face hex neutral"><Ico k="sell" fb={ICON.sell} /></span><span class="cost">+{sellValue}</span><span class="kbd">{keyLabel(keys.sell)}</span>
      </button>
      {#if SHOOTERS.includes(sel.fam ?? -1)}
        {@const p = sel.prio ?? 0}
        {@const tp = { title: `Priorité : ${PRIO_NAMES[p]}`, text: `La tour ${PRIO_DESC[p]} Touchez pour passer à « ${PRIO_NAMES[(p + 1) % 4]} ».` }}
        <button class="opt prio" style={at(180)} onpointerenter={(e) => e.pointerType !== 'touch' && preview(tp)} onclick={() => { const n = ((sel.prio ?? 0) + 1) % 4; g()?.setPrio(n); tip = { title: `Priorité : ${PRIO_NAMES[n]}`, text: `La tour ${PRIO_DESC[n]}` }; }}>
          <span class="face hex neutral"><Ico k="target" fb={ICON.target} /></span><span class="cost plabel">{PRIO_SHORT[p]}</span><span class="kbd">{keyLabel(keys.prio)}</span>
        </button>
      {/if}
      {#if fam === 'barracks'}
        <button class="opt" style={at(180)} onpointerenter={(e) => e.pointerType !== 'touch' && preview({ title: 'Point de ralliement', text: 'Choisissez où vos soldats se postent.' })} onclick={() => g()?.startRally()}>
          <span class="face hex neutral"><Ico k="flag" fb={ICON.flag} /></span><span class="kbd">{keyLabel(keys.rally)}</span>
        </button>
      {/if}
    {/if}
  {:else if sel.kind === 'prop' && sel.prop !== undefined && g()?.map.props[sel.prop]}
    {@const pi = sel.prop}
    {@const mp = g()!.map.props[pi]}
    {@const info = PROP_INFO[mp.kind]}
    {@const pp = ui.hud.prop}
    {@const ready = pp.cd <= 0 && pp.st === 0}
    {#if mp.kind === PropKind.Camp}
      {@const tp = { title: info.name, text: `${info.desc}${pp.cd > 0 ? ` Ils se reposent : encore ${pp.cd} s.` : ''}`, cost: info.cost }}
      <button class="opt" class:poor={!ready || gold < info.cost} class:armed={armed === 'hire'} style={at(-90)}
        onpointerenter={(e) => e.pointerType !== 'touch' && preview(tp)}
        onclick={() => act('hire', tp, () => g()?.useProp(pi))}>
        <span class="face hex" style="--fc:{FAMILY_COLOR[5]}"><Ico k="prop_merc" fb={ICON.helmet} /></span>
        <span class="cost" class:plabel={pp.cd > 0}>{pp.cd > 0 ? `${pp.cd} s` : info.cost}</span>
      </button>
      {@const rp = { title: 'Placement', text: 'Choisissez où se postent les mercenaires, dans la zone autour du camp. Ceux déjà engagés y vont aussi.' }}
      <button class="opt" style={at(90)} onpointerenter={(e) => e.pointerType !== 'touch' && preview(rp)} onclick={() => g()?.startCampRally()}>
        <span class="face hex neutral"><Ico k="flag" fb={ICON.flag} /></span><span class="kbd">{keyLabel(keys.rally)}</span>
      </button>
    {:else}
      {@const tp = { title: info.name, text: info.desc }}
      <button class="opt" class:poor={!ready} class:armed={armed === 'fire'} style={at(-90)}
        onpointerenter={(e) => e.pointerType !== 'touch' && preview(tp)}
        onclick={() => act('fire', tp, () => g()?.useProp(pi))}>
        <span class="face hex" style="--fc:#ff8a65"><Ico k="prop_poudre" fb={ICON.bomb} /></span>
        <span class="cost plabel">{info.act}</span>
      </button>
    {/if}
  {/if}
  {#if tip && !ui.touch}
    <div class="tip panel" class:flip style="--tx:{R + 40}px" use:fit>
      <b>{tip.title}</b>{#if tip.cost !== undefined} <span class="tc" class:poor={gold < tip.cost}><Ico k="coin" fb={ICON.coin} />{tip.cost}</span>{/if}
      <div>{tip.text}</div>
    </div>
  {/if}
</div>

<style>
  .radial { position: absolute; left: 0; top: 0; width: 0; height: 0; animation: radialIn 0.2s cubic-bezier(0.2, 1.5, 0.4, 1); }
  @keyframes radialIn { from { transform: scale(0.5) rotate(-20deg); opacity: 0; } }
  /* anneau en pointillés blancs cernés d'encre, comme une marque à la craie autour de l'emplacement */
  .ring { position: absolute; border-radius: 50%; border: 5px dashed #fff; box-shadow: 0 0 0 3px rgba(43, 26, 18, 0.55), inset 0 0 0 3px rgba(43, 26, 18, 0.35); pointer-events: none; }
  .opt { position: absolute; transform: translate(-50%, -50%); width: 66px; height: 66px; cursor: pointer; border: 0; padding: 0; background: none; display: grid; place-items: center; transition: transform 0.12s; touch-action: manipulation; }
  .opt:hover { transform: translate(-50%, -50%) scale(1.1); z-index: 2; }
  .face { width: 66px; height: 66px; display: grid; place-items: center; background: var(--fc); color: var(--ink); border: var(--bw) solid var(--ink);
    box-shadow: inset 0 4px 0 rgba(255, 255, 255, 0.45), inset 0 -6px 0 rgba(43, 26, 18, 0.25), 0 4px 0 var(--ink), 0 8px 14px rgba(43, 26, 18, 0.25); }
  .face :global(.icon) { width: 32px; height: 32px; }
  /* médaillon 3D : un disque cerné d'encre */
  .face:has(:global(.ico3d)) { background: var(--ink); box-shadow: 0 4px 0 var(--ink), 0 8px 14px rgba(43, 26, 18, 0.25); }
  .face :global(.ico3d) { width: 106%; height: 106%; max-width: none; }
  .sicon :global(.ico3d) { width: 46px; height: 46px; margin-top: -10px; }
  .face.neutral { background: var(--toon-cream); color: var(--ink); }
  .face.neutral:has(:global(.ico3d)) { background: var(--toon-cream); }
  .opt:hover .face { filter: brightness(1.08); }
  .opt.poor .face { filter: grayscale(0.9) brightness(0.85); }
  .opt.spec { width: 76px; height: 76px; }
  .opt.spec .face { width: 76px; height: 76px; overflow: hidden; background: linear-gradient(180deg, #a9d3f2 0 55%, #7cc242 55%); }
  .opt.spec img { width: 70px; height: 70px; }
  .opt.skill { width: 70px; height: 70px; color: var(--ink); font-size: 11px; font-weight: 900; line-height: 1.1; text-align: center; padding: 6px 6px 14px;
    background: var(--toon-cream); border: var(--bw) solid var(--ink); border-radius: 50%; box-shadow: var(--rim), 0 4px 0 var(--ink), 0 8px 14px rgba(43, 26, 18, 0.25); }
  .opt.skill.max { background: var(--toon-gold); }
  .sname { display: block; }
  .sicon :global(svg.icon) { width: 32px; height: 32px; margin-top: -6px; }
  .pips { position: absolute; bottom: 7px; display: flex; gap: 3px; }
  .pips i { width: 9px; height: 9px; border-radius: 50%; background: #d8bf8f; border: 1.5px solid var(--ink); }
  .pips i.on { background: var(--gold-fill); }
  /* prix : jeton doré sous l'option */
  .cost { position: absolute; z-index: 1; bottom: -16px; font-family: var(--font-display); font-size: 15px; line-height: 1.1; color: var(--ink); background: var(--gold-fill); border: 2.5px solid var(--ink); padding: 0 8px; border-radius: 99px; box-shadow: 0 2px 0 var(--ink); font-variant-numeric: tabular-nums; }
  .opt.poor .cost { background: #d9c5a0; color: var(--bad); }
  .opt .cost.plabel { background: var(--toon-cream); font-size: 13px; white-space: nowrap; }
  .opt .kbd { position: absolute; top: -8px; right: -6px; font-size: 11px; }
  .tip { position: absolute; left: var(--tx, 108px); top: -50px; width: min(270px, calc(100vw - 24px)); padding: 10px 14px 12px; font-size: 0.88em; z-index: 5; display: flex; flex-direction: column; gap: 4px; animation: pop 0.12s ease; }
  .tip.flip { left: auto; right: var(--tx, 108px); }
  .tip b { font-family: var(--font-display); font-weight: 400; font-size: 1.4em; line-height: 1.05; }
  .tip div { color: var(--muted); font-weight: 700; }
  .tc { display: inline-flex; align-items: center; gap: 3px; font-family: var(--font-display); font-size: 1.15em; color: #a05f00; font-variant-numeric: tabular-nums; }
  .tc :global(.icon) { width: 1.1em; height: 1.1em; }
  .tc.poor { color: var(--bad); }

  /* tactile : options plus grandes, l'option armée gonfle et pulse en attendant la confirmation */
  .touch .opt, .touch .face { width: 68px; height: 68px; }
  .touch.short .opt, .touch.short .face { width: 58px; height: 58px; }
  .touch.short .face :global(svg.icon) { width: 26px; height: 26px; }
  .touch .opt .kbd { display: none; }
  .touch .opt:hover { transform: translate(-50%, -50%); }
  .opt.armed { transform: translate(-50%, -50%) scale(1.16); z-index: 2; }
  .opt.armed .cost { bottom: -22px; }
  .touch .opt.armed:hover { transform: translate(-50%, -50%) scale(1.16); }
  .opt.armed .face, .opt.skill.armed { box-shadow: 0 0 0 4px var(--gold-fill), 0 0 0 7px var(--ink), 0 4px 0 7px var(--ink); }
  .opt.armed::after { content: ''; position: absolute; inset: -9px; border-radius: 50%; border: 4px solid #fff; animation: armed 1s ease-out infinite; pointer-events: none; }
  @keyframes armed { from { opacity: 1; transform: scale(0.95); } to { opacity: 0; transform: scale(1.3); } }
</style>
