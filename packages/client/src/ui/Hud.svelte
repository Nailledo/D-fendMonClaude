<script lang="ts">
  import { ENEMIES, FAMILIES, HEROES, HERO_IDS, MUTATIONS, PLAYER_COLORS, SPELLS, TOWERS, earlyCallBonus, previewWave } from '@dfend/shared';
  import { app } from '../app';
  import { dom } from '../game/GameClient';
  import { keyLabel, keys } from '../settings';
  import { ui } from '../state.svelte';
  import Chat from './Chat.svelte';
  import Dialog from './Dialog.svelte';
  import EndScreen from './EndScreen.svelte';
  import PauseMenu from './PauseMenu.svelte';
  import Radial from './Radial.svelte';
  import TowerPanel from './TowerPanel.svelte';
  import { enemyTraits } from './enemyTraits';
  import { FAMILY_NAME, ICON, LINE, SKILL_ICON } from './icons';
  import { SKILL_ICON as HERO_SKILL_ICON } from './skillIcons';

  const h = $derived(ui.hud);
  const hero = $derived(HEROES[HERO_IDS[h.hero.type]]);
  const g = () => app.game;
  const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
  const multi = $derived(!!ui.game?.multi);
  const entries = $derived(app.game?.world.entries.length ?? 0);
  const me = $derived(h.players.find((p) => p.id === ui.game?.you));
  let waveEls: HTMLElement[] = $state([]);
  let dmgLayer: HTMLElement | undefined = $state();
  let radialEl: HTMLElement | undefined = $state();
  $effect(() => {
    dom.waves = waveEls;
    dom.dmg = dmgLayer ?? null;
    dom.radial = radialEl ?? null;
  });
  const sel = $derived(ui.sel);

  // ---- aperçu de la vague suivante ----
  const activePlayers = $derived(Math.max(1, h.players.filter((p) => p.active).length));
  const preview = $derived.by(() => {
    const cfg = app.game?.cfg;
    if (!cfg || (h.totalWaves && h.wave >= h.totalWaves)) return null;
    return previewWave(cfg, h.wave + 1, activePlayers);
  });
  const bonus = $derived(h.nextWave > 0 ? earlyCallBonus(h.nextWave, activePlayers) : 0);
  /** bouton dont l'aperçu est ouvert (survol, focus ou premier appui tactile) */
  let openWave = $state(-1);
  let flipWave = $state(false);
  function showPreview(i: number, el: HTMLElement) {
    openWave = i;
    flipWave = el.getBoundingClientRect().left > window.innerWidth * 0.6;
  }
  function waveTap(i: number, e: PointerEvent | MouseEvent) {
    // au tactile, un premier appui montre l'aperçu, le second appelle la vague
    if ((e as PointerEvent).pointerType === 'touch' && openWave !== i) {
      showPreview(i, e.currentTarget as HTMLElement);
      return;
    }
    openWave = -1;
    g()?.callWave();
  }
</script>

<div class="hud">
  <!-- barre du haut -->
  <div class="top panel ui">
    <span class="stat life" class:low={h.lives <= 5} title="Vies">{@html ICON.heart}<b>{h.lives}</b></span>
    <span class="stat gold" title="Votre or">{@html ICON.coin}<b>{h.gold}</b></span>
    <span class="stat" title="Vague">{@html ICON.horn}<b>{h.wave}</b>{#if h.totalWaves}<small>/{h.totalWaves}</small>{/if}</span>
    {#if h.totalWaves && h.totalWaves <= 20}
      <span class="segs" aria-hidden="true">{#each Array(h.totalWaves) as _, k}<i class:on={k < h.wave}></i>{/each}</span>
    {/if}
    {#if h.nextWave > 0}<span class="next">Vague suivante dans <b>{h.nextWave} s</b></span>{/if}
    {#if h.state === 0}<span class="next call">Appelez la première vague quand vous êtes prêts</span>{/if}
  </div>

  {#if h.mutations.length}
    <div class="muts ui">
      {#each h.mutations as m}<span class="chip mut" title={MUTATIONS[m]?.desc}>{MUTATIONS[m]?.name}</span>{/each}
    </div>
  {/if}

  <div class="topright ui">
    <button class="btn small sysbtn" class:gold={me?.speed2} title="Vitesse ×2 ({keyLabel(keys.speed)}){multi ? ' — tous les joueurs doivent voter' : ''}" onclick={() => g()?.toggleSpeed()}>
      {@html ICON.fast} ×2 {#if multi}<span class="votes">{h.players.filter((p) => p.speed2 && p.active).length}/{h.players.filter((p) => p.active).length}</span>{/if}
    </button>
    <button class="btn small sysbtn" aria-label="Menu" title="Menu ({keyLabel(keys.menu)})" onclick={() => (app.game?.host.local ? app.game.setPaused(true) : (ui.paused = true))}>{@html ICON.pause}</button>
    <button class="btn small sysbtn" aria-label="Paramètres" title="Paramètres" onclick={() => (ui.overlay = 'settings')}>{@html ICON.gear}</button>
  </div>

  {#if h.targeting}
    <div class="targeting">{h.targeting} <span class="muted">— clic droit ou {keyLabel(keys.menu)} pour annuler</span></div>
  {/if}

  {#if ui.banner}
    {#key ui.banner.id}
      <div class="banner">
        <div class="bt">{ui.banner.title}</div>
        {#if ui.banner.sub}<div class="bs">{ui.banner.sub}</div>{/if}
      </div>
    {/key}
  {/if}

  <!-- boutons d'appel de vague -->
  {#each Array(entries) as _, i}
    <div class="waveanchor" bind:this={waveEls[i]}>
      <button class="wavebtn ui" class:first={h.state === 0} aria-label="Appeler la vague {h.wave + 1} ({keyLabel(keys.wave)})"
        onpointerenter={(e) => e.pointerType !== 'touch' && showPreview(i, e.currentTarget)} onpointerleave={() => (openWave = -1)}
        onfocus={(e) => showPreview(i, e.currentTarget)} onblur={() => (openWave = -1)}
        onclick={(e) => waveTap(i, e)}>
        {@html LINE.skull}
        {#if h.nextWave > 0}<span class="sec">{h.nextWave} s</span>{/if}
      </button>
      {#if openWave === i && preview}
        <div class="wavecard" class:flip={flipWave} role="tooltip">
          <div class="wh"><b>Vague {preview.wave}{h.totalWaves ? ' / ' + h.totalWaves : ''}</b><span>{h.nextWave > 0 ? `dans ${h.nextWave} s` : 'quand vous voulez'}</span></div>
          <ul>
            {#each preview.entries as en}
              {@const d = ENEMIES[en.type]}
              {@const tr = enemyTraits(d)}
              <li class:boss={d.boss}><span>{d.name}{#each tr.slice(0, 2) as t}<em>{t}</em>{/each}</span><b>×{en.count}</b></li>
            {/each}
          </ul>
          {#if preview.mutations.length}<div class="wm">{#each preview.mutations as m}<span>{MUTATIONS[m].name} : {MUTATIONS[m].desc}</span>{/each}</div>{/if}
          <div class="wf">
            {#if bonus > 0}Appeler maintenant : <b>+{bonus} or</b>{multi ? ' chacun' : ''}, sorts rechargés plus vite{:else}Appuyez pour lancer la vague{/if}
            <span class="kbd">{keyLabel(keys.wave)}</span>
          </div>
        </div>
      {/if}
    </div>
  {/each}

  <!-- menu radial -->
  <div class="radialAnchor" bind:this={radialEl}>
    {#if sel && (sel.kind === 'build' || sel.kind === 'tower')}<Radial />{/if}
  </div>

  <div class="bottomleft">
  <!-- héros -->
  <div class="heroCard panel ui">
    <button class="portrait" class:dead={h.hero.dead} onclick={() => { g()?.selectHero(); g()?.focusHero(); }} title="Sélectionner ({keyLabel(keys.hero)})">
      {#if ui.portraits[hero.id]}<img src={ui.portraits[hero.id]} alt={hero.name} />{/if}
      <span class="lvl">{h.hero.level}</span>
      {#if h.hero.dead}<span class="resp">{h.hero.respawn}</span>{/if}
    </button>
    <div class="hcol">
      <div class="hname">{hero.name}<small>niveau {h.hero.level}</small></div>
      <div class="bar hp"><i style="width:{h.hero.hp * 100}%"></i></div>
      <div class="bar xp"><i style="width:{h.hero.xp * 100}%"></i></div>
      <div class="skills">
        {#each hero.skills as s, i}
          {@const locked = h.hero.level < s.unlock}
          {@const cd = h.hero.cds[i]}
          <button class="skill" class:ult={i === 2} class:locked disabled={locked || h.hero.dead} onclick={() => g()?.heroSkill(i as 0 | 1 | 2)}
            title="{s.name} — {s.desc} (recharge {s.cd} s){locked ? ` — niveau ${s.unlock} requis` : ''}">
            {#if locked}
              {@html LINE.lock}<span class="sn">Niv. {s.unlock}</span>
            {:else}
              <span class="si">{@html HERO_SKILL_ICON[hero.id]?.[i] ?? SKILL_ICON[s.icon] ?? ''}</span><span class="sn">{s.short}</span>
              {#if cd > 0}<span class="cd">{cd}</span>{/if}
            {/if}
            <span class="kbd">{keyLabel(i === 0 ? keys.skill1 : i === 1 ? keys.skill2 : keys.ult)}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- sorts -->
  <div class="spells ui">
    {#each SPELLS as sp, i}
      <button class="spell panel" aria-label={sp.name} onclick={() => g()?.castSpell(i as 0 | 1)} title="{sp.name} — {sp.desc} (recharge {sp.cd} s)">
        {@html i === 0 ? ICON.meteor : ICON.helmet}
        {#if h.spells[i] > 0}<span class="cd">{h.spells[i]}</span>{/if}
        <span class="kbd">{keyLabel(i === 0 ? keys.spell1 : keys.spell2)}</span>
      </button>
    {/each}
  </div>
  </div>

  <!-- joueurs (multi) -->
  {#if multi}
    <div class="players ui">
      {#each h.players as p}
        <div class="pl" class:off={!p.connected} class:gone={!p.active} style="--c:{hex(PLAYER_COLORS[p.id] ?? 0xffffff)}">
          <b>{p.name}</b>
          <span class="pg">{@html ICON.coin}{p.gold}</span>
          {#if !p.active}<i>parti</i>{:else if !p.connected}<i>reconnexion…</i>{:else}<span class="ping">{p.ping} ms</span>{/if}
          {#if p.id !== ui.game?.you && p.active}
            <button class="btn small ghost" title="Donner 50 or" onclick={() => g()?.gift(p.id)}>{@html ICON.gift}</button>
          {/if}
        </div>
      {/each}
    </div>
    <div class="chatwrap ui"><Chat /></div>
  {/if}

  <!-- infos sélection -->
  {#if sel?.kind === 'enemy' && sel.enemyType !== undefined}
    {@const d = ENEMIES[sel.enemyType]}
    <div class="info panel ui">
      <div class="row">
        {#if ui.portraits['e_' + d.id]}<img src={ui.portraits['e_' + d.id]} alt="" width="56" height="56" />{/if}
        <div><b>{d.name}</b><div class="small">{d.desc}</div></div>
      </div>
      <div class="stats">
        <span>PV {Math.round(d.hp)}</span><span>Armure {Math.round(d.armor * 100)} %</span><span>Rés. magie {Math.round(d.mres * 100)} %</span>
        <span>Vitesse {d.speed}</span><span>Vies {d.lives}</span>{#if d.flying}<span>Volant</span>{/if}
      </div>
    </div>
  {:else if sel?.kind === 'tower' && sel.fam !== undefined}
    <TowerPanel />
  {:else if sel?.kind === 'build'}
    <div class="info panel ui hint">Choisissez une tour : {#each FAMILY_NAME as n, i}<span class="nowrap"><span class="kbd">{keyLabel([keys.buildArcher, keys.buildBarracks, keys.buildMage, keys.buildArtillery][i])}</span> {n} </span>{/each}</div>
  {/if}

  <div class="dmg" bind:this={dmgLayer}>{#each Array(24) as _}<span class="dn"></span>{/each}</div>

  {#if ui.debug.on}
    <div class="debug">
      {ui.debug.fps} FPS · {ui.debug.calls} draw calls · {Math.round(ui.debug.tris / 1000)}k tris · {ui.debug.ents} entités · {ui.debug.kb} Ko/s{multi ? ` · ${ui.debug.ping} ms` : ''}
    </div>
  {/if}

  {#if ui.dialog}<Dialog />{/if}
  {#if ui.paused && !ui.end}<PauseMenu />{/if}
  {#if ui.end && !ui.dialog}<EndScreen />{/if}
</div>

<style>
  .hud { position: fixed; inset: 0; pointer-events: none; }

  /* ressources */
  .top { position: absolute; top: 10px; left: 10px; display: flex; gap: 18px; align-items: center; padding: 8px 18px; flex-wrap: wrap; max-width: calc(100vw - 220px); }
  .stat { display: inline-flex; align-items: center; gap: 7px; font-size: 1.3em; font-variant-numeric: tabular-nums; }
  .stat b { font-weight: 700; }
  .stat small { color: var(--muted); font-size: 0.75em; margin-left: -3px; }
  .stat.gold b { color: var(--gold); }
  .stat.life.low b { color: var(--bad); }
  .segs { display: flex; gap: 3px; }
  .segs i { width: 8px; height: 14px; background: rgba(243, 238, 226, 0.16); }
  .segs i.on { background: var(--text); }
  .next { color: var(--muted); font-size: 0.92em; }
  .next b { color: var(--text); font-variant-numeric: tabular-nums; }
  .call { color: var(--gold); }
  .muts { position: absolute; top: 68px; left: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
  .mut { background: #3b2346; border-color: var(--magic); color: #eadcff; cursor: help; padding: 4px 9px; }

  /* boutons système */
  .topright { position: absolute; top: 10px; right: 10px; display: flex; gap: 8px; }
  .sysbtn { min-width: 46px; height: 46px; padding: 0 12px; font-size: 1em; }
  .sysbtn :global(.icon) { width: 20px; height: 20px; }
  .votes { font-size: 0.8em; opacity: 0.85; font-variant-numeric: tabular-nums; }

  /* visée, bannière */
  .targeting { position: absolute; bottom: 124px; left: 50%; transform: translateX(-50%); background: var(--panel); padding: 8px 18px; font-weight: 700; white-space: nowrap; box-shadow: inset 0 -3px 0 var(--gold); filter: var(--drop); }
  .banner { position: absolute; top: 24%; left: 50%; transform: translateX(-50%); text-align: center; animation: bannerIn 2.6s ease forwards; width: min(760px, 92vw); filter: drop-shadow(0 4px 0 rgba(8, 10, 12, 0.75)); }
  .bt { font-family: var(--font-display); font-size: clamp(34px, 5.5vw, 60px); font-weight: 700; color: var(--text); line-height: 1; }
  .bs { margin-top: 6px; font-weight: 700; font-size: 1.1em; color: var(--gold); }
  @keyframes bannerIn { 0% { opacity: 0; transform: translate(-50%, 10px); } 12% { opacity: 1; transform: translate(-50%, 0); } 80% { opacity: 1; } 100% { opacity: 0; } }

  /* appel de vague (hexagone) + aperçu */
  .waveanchor { position: absolute; left: 0; top: 0; width: 0; height: 0; visibility: hidden; filter: var(--drop); }
  .wavebtn {
    position: absolute; left: -31px; top: -28px; width: 62px; height: 56px; cursor: pointer; border: 0; padding: 0;
    background: var(--life); color: #fff; display: grid; place-items: center;
    clip-path: polygon(25% 2%, 75% 2%, 100% 50%, 75% 98%, 25% 98%, 0 50%);
    box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.22);
  }
  .wavebtn :global(.icon) { width: 28px; height: 28px; }
  .wavebtn:hover { background: #f46663; }
  .wavebtn.first { animation: beat 1.4s ease-in-out infinite; }
  @keyframes beat { 50% { transform: scale(1.08); } }
  .wavebtn .sec { position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%); font-size: 11px; font-weight: 700; color: #fff; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .wavebtn:has(.sec) :global(.icon) { margin-top: -10px; width: 24px; height: 24px; }
  .wavecard { position: absolute; left: 42px; top: -34px; width: 280px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; font-size: 14px; z-index: 6;
    background: linear-gradient(135deg, transparent var(--cut), var(--panel) 0) left / 50.5% 100% no-repeat, linear-gradient(-45deg, transparent var(--cut), var(--panel) 0) right / 50.5% 100% no-repeat; }
  .wavecard.flip { left: auto; right: 42px; }
  .wh { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .wh b { font-family: var(--font-display); font-size: 1.45em; line-height: 1; }
  .wh span { color: var(--muted); font-size: 0.9em; }
  .wavecard ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
  .wavecard li { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
  .wavecard li b { font-variant-numeric: tabular-nums; }
  .wavecard li.boss { color: var(--bad); font-weight: 700; }
  .wavecard em { font-style: normal; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gold); margin-left: 7px; }
  .wm { display: flex; flex-direction: column; gap: 3px; font-size: 12.5px; color: var(--magic); }
  .wf { display: flex; justify-content: space-between; align-items: center; gap: 8px; border-top: 1px solid rgba(243, 238, 226, 0.15); padding-top: 8px; font-size: 13px; color: var(--muted); }
  .wf b { color: var(--gold); }

  .radialAnchor { position: absolute; left: 0; top: 0; visibility: hidden; }

  /* héros et sorts */
  .bottomleft { position: absolute; left: 10px; bottom: 10px; display: flex; align-items: flex-end; gap: 10px; }
  .heroCard { display: flex; gap: 12px; padding: 10px 12px; align-items: stretch; }
  .portrait { position: relative; width: 84px; height: 84px; border: 0; background: #d9cfb8; cursor: pointer; padding: 0; overflow: hidden; flex: none;
    clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); }
  .portrait img { width: 100%; height: 100%; display: block; }
  .portrait.dead img { filter: grayscale(1) brightness(0.45); }
  .lvl { position: absolute; left: 0; bottom: 0; background: var(--line); color: var(--text); font-weight: 700; font-size: 13px; padding: 1px 7px; font-variant-numeric: tabular-nums; }
  .resp { position: absolute; inset: 0; display: grid; place-items: center; font-size: 28px; font-weight: 700; color: #fff; text-shadow: 0 2px 0 #000; }
  .hcol { display: flex; flex-direction: column; gap: 6px; min-width: 214px; }
  .hname { display: flex; justify-content: space-between; align-items: baseline; font-family: var(--font-display); font-weight: 700; font-size: 1.35em; line-height: 1; }
  .hname small { font-family: var(--font-ui); font-size: 0.55em; font-weight: 400; color: var(--muted); }
  .bar { height: 8px; background: var(--line); overflow: hidden; }
  .bar i { display: block; height: 100%; transition: width 0.15s; }
  .bar.hp i { background: var(--good); }
  .bar.xp { height: 4px; }
  .bar.xp i { background: var(--xp); }
  .skills { display: flex; gap: 6px; margin-top: 2px; }
  .skill { position: relative; width: 68px; height: 54px; border: 0; color: var(--text); cursor: pointer; font-size: 11.5px; font-weight: 700; padding: 4px 2px 3px; display: flex; flex-direction: column; gap: 3px; align-items: center; justify-content: center; text-align: center; line-height: 1.05;
    background: linear-gradient(135deg, transparent var(--cut-sm), var(--raised) 0) left / 50.5% 100% no-repeat, linear-gradient(-45deg, transparent var(--cut-sm), var(--raised) 0) right / 50.5% 100% no-repeat; }
  .skill:hover:not(:disabled) { filter: brightness(1.18); }
  .skill :global(.icon) { width: 21px; height: 21px; }
  .skill .si { display: contents; }
  .skill .si :global(svg.icon) { width: 28px; height: 28px; filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.45)); }
  .skill.ult { color: var(--gold); }
  .skill.locked, .skill.ult.locked { background: transparent; outline: 1px dashed rgba(243, 238, 226, 0.25); outline-offset: -1px; color: var(--faint); }
  .skill:disabled { cursor: default; }
  .skill:disabled:not(.locked) { opacity: 0.5; }
  .skill .kbd, .spell .kbd { position: absolute; top: -8px; right: -6px; font-size: 11px; line-height: 16px; }
  .cd { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(15, 19, 22, 0.72); font-size: 18px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
  .spells { display: flex; gap: 8px; }
  .spell { position: relative; width: 66px; height: 66px; padding: 0; cursor: pointer; display: grid; place-items: center; }
  .spell :global(.icon) { width: 32px; height: 32px; }
  .spell:hover { --pbg: var(--raised); }

  /* joueurs (coop) */
  .players { position: absolute; right: 10px; top: 66px; display: flex; flex-direction: column; gap: 4px; }
  .pl { display: flex; gap: 8px; align-items: center; background: var(--panel); box-shadow: inset 4px 0 0 var(--c); padding: 4px 10px 4px 12px; font-size: 0.88em; }
  .pl.off { opacity: 0.6; }
  .pl.gone { opacity: 0.35; }
  .pg { display: inline-flex; align-items: center; gap: 3px; color: var(--gold); font-weight: 700; font-variant-numeric: tabular-nums; }
  .ping { color: var(--muted); font-size: 0.85em; font-variant-numeric: tabular-nums; }
  .chatwrap { position: absolute; left: 10px; bottom: 124px; width: min(380px, 60vw); }

  /* infos de sélection */
  .info { position: absolute; right: 10px; bottom: 10px; width: min(340px, 50vw); padding: 12px 14px; font-size: 0.92em; }
  .info b { font-family: var(--font-display); font-size: 1.25em; }
  .info img { background: #d9cfb8; }
  .info.hint { width: auto; max-width: 60vw; }
  .nowrap { white-space: nowrap; margin-left: 8px; }
  .small { font-size: 0.88em; color: var(--muted); }
  .stats { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; font-weight: 700; font-size: 0.86em; font-variant-numeric: tabular-nums; }
  .dmg { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .debug { position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%); background: rgba(0, 0, 0, 0.75); padding: 3px 10px; font-family: monospace; font-size: 12px; }
  @media (max-width: 820px) {
    .bottomleft { flex-direction: column; align-items: flex-start; }
    .chatwrap { bottom: 200px; }
    .top { gap: 10px; font-size: 0.9em; }
    .segs { display: none; }
  }
</style>
