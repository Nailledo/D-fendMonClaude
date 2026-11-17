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
  <div class="top wood ui">
    <span class="stat" title="Vies">{@html ICON.heart}<b class:low={h.lives <= 5}>{h.lives}</b></span>
    <span class="stat" title="Votre or">{@html ICON.coin}<b class="gold-text">{h.gold}</b></span>
    <span class="stat" title="Vague">{@html ICON.horn}<b>{h.wave}{h.totalWaves ? ' / ' + h.totalWaves : ''}</b></span>
    {#if h.nextWave > 0}<span class="stat muted">Prochaine : {h.nextWave} s</span>{/if}
    {#if h.state === 0}<span class="stat call">Appelez la première vague quand vous êtes prêts</span>{/if}
  </div>

  {#if h.mutations.length}
    <div class="muts ui">
      {#each h.mutations as m}<span class="chip" title={MUTATIONS[m]?.desc}>☠ {MUTATIONS[m]?.name}</span>{/each}
    </div>
  {/if}

  <div class="topright ui">
    <button class="btn small" class:gold={me?.speed2} title="Vitesse ×2 ({keyLabel(keys.speed)}){multi ? ' — tous les joueurs doivent voter' : ''}" onclick={() => g()?.toggleSpeed()}>
      {@html ICON.fast} ×2 {#if multi}<span class="votes">{h.players.filter((p) => p.speed2 && p.active).length}/{h.players.filter((p) => p.active).length}</span>{/if}
    </button>
    <button class="btn small" title="Menu ({keyLabel(keys.menu)})" onclick={() => (app.game?.host.local ? app.game.setPaused(true) : (ui.paused = true))}>{@html ICON.pause}</button>
    <button class="btn small" title="Paramètres" onclick={() => (ui.overlay = 'settings')}>{@html ICON.gear}</button>
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
  <div class="heroCard wood ui">
    <button class="portrait" class:dead={h.hero.dead} onclick={() => { g()?.selectHero(); g()?.focusHero(); }} title="Sélectionner ({keyLabel(keys.hero)})">
      {#if ui.portraits[hero.id]}<img src={ui.portraits[hero.id]} alt={hero.name} />{/if}
      <span class="lvl">{h.hero.level}</span>
      {#if h.hero.dead}<span class="resp">{h.hero.respawn}</span>{/if}
    </button>
    <div class="hcol">
      <div class="hname">{hero.name}</div>
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
              {@html SKILL_ICON[s.icon] ?? ''}<span class="sn">{s.short}</span>
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
      <button class="spell wood" onclick={() => g()?.castSpell(i as 0 | 1)} title="{sp.name} — {sp.desc} (recharge {sp.cd} s)">
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
  {:else if sel?.kind === 'tower' && sel.fam !== undefined && sel.mine}
    <TowerPanel />
  {:else if sel?.kind === 'tower' && sel.fam !== undefined && !sel.mine}
    {@const t = TOWERS[FAMILIES[sel.fam]][sel.level ?? 0]}
    <div class="info panel ui">
      <b>{t.name}</b> <span class="small">— à {h.players.find((p) => p.id === sel.owner)?.name ?? '?'}</span>
      <div class="small">{t.desc}</div>
    </div>
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
  .top { position: absolute; top: 10px; left: 10px; display: flex; gap: 16px; align-items: center; padding: 6px 14px; flex-wrap: wrap; max-width: calc(100vw - 200px); }
  .stat { display: inline-flex; align-items: center; gap: 6px; font-size: 1.15em; }
  .stat b { font-weight: 800; }
  .stat .low { color: #ff8a80; }
  .stat.muted, .muted { color: var(--muted); font-size: 0.9em; }
  .call { font-size: 0.85em; color: #ffe08a; }
  .muts { position: absolute; top: 62px; left: 10px; display: flex; gap: 6px; }
  .muts .chip { background: rgba(80, 20, 60, 0.85); border: 1px solid #c084fc; cursor: help; }
  .topright { position: absolute; top: 10px; right: 10px; display: flex; gap: 6px; }
  .votes { font-size: 0.75em; opacity: 0.85; }
  .targeting { position: absolute; bottom: 120px; left: 50%; transform: translateX(-50%); background: rgba(20, 12, 6, 0.85); padding: 6px 16px; border-radius: 10px; border: 1px solid var(--gold-2); font-weight: 800; white-space: nowrap; }
  .banner { position: absolute; top: 24%; left: 50%; transform: translateX(-50%); text-align: center; animation: bannerIn 2.6s ease forwards; width: min(700px, 92vw); }
  .bt { font-family: 'Cinzel', serif; font-size: clamp(30px, 5vw, 52px); font-weight: 800; color: #fff3c4; text-shadow: 0 3px 0 #4a2a0a, 0 6px 18px #000; }
  .bs { margin-top: 4px; font-weight: 800; color: #e9d5ff; text-shadow: 0 2px 4px #000; }
  @keyframes bannerIn { 0% { opacity: 0; transform: translate(-50%, 10px) scale(0.95); } 12% { opacity: 1; transform: translate(-50%, 0) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; } }
  .waveanchor { position: absolute; left: 0; top: 0; width: 0; height: 0; visibility: hidden; }
  .wavebtn {
    position: absolute; left: -26px; top: -26px; width: 52px; height: 52px; border-radius: 50%; cursor: pointer;
    border: 3px solid #4a1410; background: radial-gradient(circle at 35% 30%, #ff8a65, #b71c1c); color: #fff; font-size: 26px; display: grid; place-items: center;
    box-shadow: 0 0 0 4px rgba(255, 138, 101, 0.35), 0 6px 14px rgba(0, 0, 0, 0.5);
  }
  .wavebtn.first { animation: pulse 1.2s ease-in-out infinite; }
  .wavebtn:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
  .wavebtn .sec { position: absolute; bottom: -11px; font-size: 12px; font-weight: 800; background: #2b1d12; padding: 0 6px; border-radius: 99px; white-space: nowrap; }
  .wavecard { position: absolute; left: 40px; top: -30px; width: 270px; padding: 10px 12px; background: rgba(28, 20, 12, 0.95); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 8px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45); display: flex; flex-direction: column; gap: 8px; font-size: 14px; z-index: 6; }
  .wavecard.flip { left: auto; right: 40px; }
  .wh { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .wh b { font-family: 'Cinzel', serif; font-size: 1.1em; }
  .wh span { color: var(--muted); font-size: 0.9em; }
  .wavecard ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .wavecard li { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
  .wavecard li b { font-variant-numeric: tabular-nums; }
  .wavecard li.boss { color: #ffb4a8; font-weight: 800; }
  .wavecard em { font-style: normal; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--gold); margin-left: 6px; }
  .wm { display: flex; flex-direction: column; gap: 2px; font-size: 12.5px; color: #e9d5ff; }
  .wf { display: flex; justify-content: space-between; align-items: center; gap: 8px; border-top: 1px solid rgba(255, 255, 255, 0.15); padding-top: 7px; font-size: 13px; color: var(--muted); }
  .wf b { color: var(--gold); }
  @keyframes pulse { 50% { box-shadow: 0 0 0 10px rgba(255, 138, 101, 0.08), 0 6px 14px rgba(0, 0, 0, 0.5); } }
  .radialAnchor { position: absolute; left: 0; top: 0; visibility: hidden; }
  .bottomleft { position: absolute; left: 10px; bottom: 10px; display: flex; align-items: flex-end; gap: 10px; }
  .heroCard { display: flex; gap: 10px; padding: 8px 10px; align-items: center; }
  .portrait { position: relative; width: 74px; height: 74px; border-radius: 12px; border: 3px solid var(--gold-2); background: radial-gradient(circle at 50% 30%, #fff4cf, #a07040); cursor: pointer; padding: 0; overflow: hidden; }
  .portrait img { width: 100%; height: 100%; }
  .portrait.dead img { filter: grayscale(1) brightness(0.5); }
  .lvl { position: absolute; left: 2px; bottom: 2px; background: #1e3a8a; color: #fff; font-weight: 800; font-size: 13px; border-radius: 6px; padding: 0 5px; }
  .resp { position: absolute; inset: 0; display: grid; place-items: center; font-size: 26px; font-weight: 800; text-shadow: 0 2px 4px #000; }
  .hcol { display: flex; flex-direction: column; gap: 4px; min-width: 190px; }
  .hname { font-family: 'Cinzel', serif; font-weight: 800; }
  .bar { height: 7px; background: rgba(0, 0, 0, 0.45); border-radius: 4px; overflow: hidden; }
  .bar i { display: block; height: 100%; transition: width 0.15s; }
  .bar.hp i { background: linear-gradient(90deg, #ef4444, #84cc16); }
  .bar.xp { height: 5px; }
  .bar.xp i { background: #60a5fa; }
  .skills { display: flex; gap: 5px; margin-top: 2px; }
  .skill { position: relative; width: 68px; height: 52px; border-radius: 9px; border: 2px solid var(--wood-dark); background: linear-gradient(180deg, #4a6fa5, #243b63); color: #fff; cursor: pointer; font-size: 11.5px; font-weight: 800; padding: 3px 2px; display: flex; flex-direction: column; gap: 2px; align-items: center; justify-content: center; text-align: center; line-height: 1.05; }
  .skill :global(.icon) { width: 20px; height: 20px; }
  .skill.locked, .skill.ult.locked { background: rgba(0, 0, 0, 0.25); border-style: dashed; border-color: rgba(255, 255, 255, 0.3); color: var(--muted); filter: none; }
  .skill.ult { background: linear-gradient(180deg, #c58b16, #7a4d06); }
  .skill:disabled:not(.locked) { filter: grayscale(0.7) brightness(0.75); cursor: default; }
  .skill:disabled { cursor: default; }
  .skill .kbd, .spell .kbd { position: absolute; top: -7px; right: -6px; font-size: 11px; line-height: 16px; }
  .cd { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0, 0, 0, 0.6); border-radius: 7px; font-size: 17px; font-weight: 800; }
  .spells { display: flex; gap: 8px; }
  .spell { position: relative; width: 62px; height: 62px; font-size: 34px; cursor: pointer; display: grid; place-items: center; padding: 0; }
  .players { position: absolute; right: 10px; top: 58px; display: flex; flex-direction: column; gap: 4px; }
  .pl { display: flex; gap: 8px; align-items: center; background: rgba(20, 12, 6, 0.8); border-left: 5px solid var(--c); border-radius: 8px; padding: 3px 8px; font-size: 0.85em; }
  .pl.off { opacity: 0.6; }
  .pl.gone { opacity: 0.35; }
  .pg { display: inline-flex; align-items: center; gap: 3px; color: var(--gold); font-weight: 800; }
  .ping { color: var(--muted); font-size: 0.85em; }
  .chatwrap { position: absolute; left: 10px; bottom: 112px; width: min(380px, 60vw); }
  .info { position: absolute; right: 10px; bottom: 10px; width: min(340px, 50vw); padding: 10px 12px; font-size: 0.9em; }
  .info.hint { width: auto; max-width: 60vw; }
  .nowrap { white-space: nowrap; margin-left: 6px; }
  .small { font-size: 0.85em; color: #6b5030; }
  .stats { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 6px; font-weight: 700; font-size: 0.85em; }
  .dmg { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .debug { position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%); background: rgba(0, 0, 0, 0.7); padding: 3px 10px; border-radius: 6px; font-family: monospace; font-size: 12px; }
  @media (max-width: 820px) {
    .bottomleft { flex-direction: column; align-items: flex-start; }
    .chatwrap { bottom: 190px; }
    .top { gap: 10px; font-size: 0.9em; }
  }
</style>
