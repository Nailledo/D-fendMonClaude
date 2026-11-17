<script lang="ts">
  import Ico from './Ico.svelte';
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
  import { fit } from './fit';

  const h = $derived(ui.hud);
  const hero = $derived(HEROES[HERO_IDS[h.hero.type]]);
  const g = () => app.game;
  const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
  const multi = $derived(!!ui.game?.multi);
  // la partie est créée après l'affichage du HUD (chargement des modèles) : ui.gameId rend ces valeurs réactives
  const entries = $derived(ui.gameId >= 0 ? app.game?.world.entries.length ?? 0 : 0);
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
    const cfg = ui.gameId >= 0 ? app.game?.cfg : undefined;
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
  let portrait = $state(typeof innerHeight !== 'undefined' && innerHeight > innerWidth);
  $effect(() => {
    const f = () => (portrait = innerHeight > innerWidth);
    addEventListener('resize', f);
    return () => removeEventListener('resize', f);
  });
  const canFull = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  let isFull = $state(typeof document !== 'undefined' && !!document.fullscreenElement);
  $effect(() => {
    const f = () => (isFull = !!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  });
  function toggleFull() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  }
  /** part restante d'une recharge, pour l'anneau de recharge (0..1) */
  const frac = (left: number, total: number) => (total > 0 ? Math.min(1, Math.max(0, left / total)) : 0);
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

<div class="hud" class:touch={ui.touch}>
  <!-- barre du haut -->
  <div class="top ui">
    <span class="stat life" class:low={h.lives <= 5} title="Vies"><Ico k="heart" fb={ICON.heart} /><b>{h.lives}</b></span>
    <span class="stat gold" title="Votre or"><Ico k="coin" fb={ICON.coin} /><b>{h.gold}</b></span>
    <span class="stat wave" title="Vague"><Ico k="horn" fb={ICON.horn} /><b>{h.wave}</b>{#if h.totalWaves}<small>/{h.totalWaves}</small>{/if}
      {#if h.totalWaves}<span class="segs" aria-hidden="true"><i style="width:{Math.min(100, (h.wave / h.totalWaves) * 100)}%"></i></span>{/if}
    </span>
    {#if h.nextWave > 0}<span class="next">Prochaine vague : <b>{h.nextWave} s</b></span>{/if}
    {#if h.state === 0}<span class="next call">Préparation : construisez, puis lancez la vague avec le crâne{ui.touch ? '' : ` ou ${keyLabel(keys.wave)}`}</span>{/if}
  </div>

  {#if h.mutations.length}
    <div class="muts ui">
      {#each h.mutations as m}<span class="chip mut" title={MUTATIONS[m]?.desc}>{MUTATIONS[m]?.name}</span>{/each}
    </div>
  {/if}

  <div class="topright ui">
    <button class="btn small sysbtn" class:gold={me?.speed2} title="Vitesse ×2 ({keyLabel(keys.speed)}){multi ? ' — tous les joueurs doivent voter' : ''}" onclick={() => g()?.toggleSpeed()}>
      {@html ICON.fast}<span class="x2">×2</span>{#if multi}<span class="votes">{h.players.filter((p) => p.speed2 && p.active).length}/{h.players.filter((p) => p.active).length}</span>{/if}
    </button>
    <button class="btn small sysbtn" aria-label="Menu" title="Menu ({keyLabel(keys.menu)})" onclick={() => (app.game?.host.local ? app.game.setPaused(true) : (ui.paused = true))}>{@html ICON.pause}</button>
    {#if ui.touch && canFull && !portrait}
      <button class="btn small sysbtn" aria-label={isFull ? 'Quitter le plein écran' : 'Plein écran'} title="Plein écran" onclick={toggleFull}>{@html isFull ? ICON.close : ICON.full}</button>
    {/if}
    <button class="btn small sysbtn" aria-label="Paramètres" title="Paramètres" onclick={() => (ui.overlay = 'settings')}>{@html ICON.gear}</button>
  </div>

  {#if h.targeting}
    <div class="targeting ui">
      <span>{h.targeting}</span>
      {#if ui.touch}<button class="btn small" onclick={() => g()?.cancel()}>{@html ICON.close} Annuler</button>
      {:else}<span class="muted">— clic droit ou {keyLabel(keys.menu)} pour annuler</span>{/if}
    </div>
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
        <Ico k="skull" fb={LINE.skull} />
        {#if h.nextWave > 0}<span class="sec">{h.nextWave} s</span>{/if}
      </button>
      {#if openWave === i && preview}
        <div class="wavecard" class:flip={flipWave} role="tooltip" use:fit>
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
            {#if bonus > 0}Appeler maintenant : <b>+{bonus} or</b>{multi ? ' chacun' : ''}, sorts rechargés plus vite{:else}{ui.touch ? 'Touchez encore pour lancer la vague' : 'Appuyez pour lancer la vague'}{/if}
            {#if !ui.touch}<span class="kbd">{keyLabel(keys.wave)}</span>{:else}{#if bonus > 0}<span class="again">Touchez encore</span>{/if}{/if}
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
      <span class="phbar"><i style="width:{h.hero.hp * 100}%"></i></span>
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
              <Ico k="lock" fb={LINE.lock} /><span class="sn">Niv. {s.unlock}</span>
            {:else}
              <span class="si"><Ico k={`sk_${hero.id}_${i}`} fb={HERO_SKILL_ICON[hero.id]?.[i] ?? SKILL_ICON[s.icon] ?? ''} /></span><span class="sn">{s.short}</span>
              {#if cd > 0}<span class="cd" style="--p:{frac(cd, s.cd)}">{cd}</span>{/if}
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
      <button class="spell" class:ready={h.spells[i] <= 0} aria-label={sp.name} onclick={() => g()?.castSpell(i as 0 | 1)} title="{sp.name} — {sp.desc} (recharge {sp.cd} s)">
        <Ico k={i === 0 ? 'meteor' : 'reinforce'} fb={i === 0 ? ICON.meteor : ICON.helmet} />
        {#if h.spells[i] > 0}<span class="cd" style="--p:{frac(h.spells[i], sp.cd)}">{h.spells[i]}</span>{/if}
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
          <span class="pg"><Ico k="coin" fb={ICON.coin} />{p.gold}</span>
          {#if !p.active}<i>parti</i>{:else if !p.connected}<i>reconnexion…</i>{:else}<span class="ping">{p.ping} ms</span>{/if}
          {#if p.id !== ui.game?.you && p.active}
            <button class="btn small ghost" title="Donner 50 or" onclick={() => g()?.gift(p.id)}><Ico k="gift" fb={ICON.gift} /></button>
          {/if}
        </div>
      {/each}
    </div>
    <div class="chatwrap ui"><Chat /></div>
  {/if}

  <!-- infos sélection -->
  {#if ui.touch && ui.radialTip && (sel?.kind === 'build' || sel?.kind === 'tower')}
    {@const tp = ui.radialTip}
    <div class="info panel ui tipsheet sheet-{ui.sheet}">
      <div class="tsh"><b>{tp.title}</b>{#if tp.cost !== undefined}<span class="tc" class:poor={h.gold < tp.cost}><Ico k="coin" fb={ICON.coin} />{tp.cost}</span>{/if}</div>
      <div class="small">{tp.text}</div>
      <div class="again">Touchez encore l'icône pour confirmer</div>
    </div>
  {:else if sel?.kind === 'enemy' && sel.enemyType !== undefined}
    {@const d = ENEMIES[sel.enemyType]}
    <div class="info panel ui sheet-{ui.sheet}">
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
    {#if ui.touch}
      <div class="info panel ui hint sheet-{ui.sheet}">Touchez une tour : portée et prix. Touchez-la encore : construction.</div>
    {:else}
      <div class="info panel ui hint">Choisissez une tour : {#each FAMILY_NAME as n, i}<span class="nowrap"><span class="kbd">{keyLabel([keys.buildArcher, keys.buildBarracks, keys.buildMage, keys.buildArtillery][i])}</span> {n} </span>{/each}</div>
    {/if}
  {/if}

  <div class="dmg" bind:this={dmgLayer}>{#each Array(24) as _}<span class="dn"></span>{/each}</div>

  {#if ui.debug.on}
    <div class="debug">
      {ui.debug.fps} FPS · {ui.debug.calls} draw calls · {Math.round(ui.debug.tris / 1000)}k tris · {ui.debug.ents} entités · résolution {ui.debug.res} % · {ui.debug.kb} Ko/s{multi ? ` · ${ui.debug.ping} ms` : ''}
    </div>
  {/if}

  {#if ui.dialog}<Dialog />{/if}
  {#if ui.paused && !ui.end}<PauseMenu />{/if}
  {#if ui.end && !ui.dialog}<EndScreen />{/if}
</div>


<style>
  .hud { position: fixed; inset: 0; pointer-events: none; --bb: 0px; }

  /* ===== ressources : des jetons crème, l'icône 3D déborde à gauche ===== */
  .top { position: absolute; top: calc(12px + var(--sat)); left: calc(12px + var(--sal)); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; row-gap: 10px; max-width: calc(100vw - 260px); pointer-events: none; }
  .stat { position: relative; display: inline-flex; align-items: center; gap: 6px; height: 46px; padding: 0 16px 0 6px; border: var(--bw) solid var(--ink); border-radius: 99px;
    background: var(--toon-cream); box-shadow: var(--rim), var(--shadow-sm); font-family: var(--font-display); font-size: 1.75em; line-height: 1; font-variant-numeric: tabular-nums; pointer-events: auto; }
  .stat :global(.icon) { flex: none; width: 34px; height: 34px; margin: 0; vertical-align: 0; }
  .stat :global(svg.icon) { width: 26px; height: 26px; }
  .stat b { font-weight: 400; }
  .stat small { color: var(--muted); font-size: 0.66em; margin-left: -4px; }
  .stat.gold b { color: #a05f00; }
  .stat.life.low { background: var(--toon-red); color: #fff; animation: lowlife 0.9s ease-in-out infinite; }
  @keyframes lowlife { 50% { transform: scale(1.06); } }
  .segs { display: block; width: 110px; height: 14px; border: 2px solid var(--ink); border-radius: 99px; background: #d8bf8f; overflow: hidden; margin-left: 2px; }
  .segs i { display: block; height: 100%; background: var(--blue); border-right: 2px solid var(--ink); transition: width 0.3s; }
  .next { margin-left: 8px; font-family: var(--font-display); font-size: 1.3em; color: #fff; -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill; transform: rotate(-2deg); }
  .next b { font-weight: 400; color: var(--gold-fill); font-variant-numeric: tabular-nums; }
  .call { font-size: 1.12em; max-width: 440px; line-height: 1.15; }
  .muts { position: absolute; top: calc(74px + var(--sat)); left: calc(14px + var(--sal)); display: flex; gap: 6px; flex-wrap: wrap; }
  .mut { background: #e4d4ff; color: var(--magic); cursor: help; padding: 3px 10px; box-shadow: 0 2px 0 var(--ink); }

  /* ===== boutons système : boutons ronds ===== */
  .topright { position: absolute; top: calc(12px + var(--sat)); right: calc(14px + var(--sar)); display: flex; gap: 10px; }
  .sysbtn { min-width: 52px; height: 52px; padding: 0 14px; border-radius: 99px; font-size: 1em; }
  .sysbtn:not(:has(.votes)):not(:has(.x2)) { width: 52px; padding: 0; border-radius: 50%; }
  .sysbtn :global(.icon) { width: 24px; height: 24px; stroke-width: 2.6; }
  .x2 { margin-left: 1px; font-family: var(--font-display); font-weight: 400; font-size: 1.15em; }
  .votes { font-size: 0.8em; font-variant-numeric: tabular-nums; }

  /* ===== visée, bannière ===== */
  .targeting { position: absolute; bottom: 124px; left: 50%; transform: translateX(-50%); background: var(--toon-cream); border: var(--bw) solid var(--ink); padding: 8px 18px; font-weight: 900; white-space: nowrap; border-radius: 99px; box-shadow: var(--rim), var(--shadow-sm); display: flex; align-items: center; gap: 10px; }
  .banner { position: absolute; top: 22%; left: 50%; transform: translateX(-50%); text-align: center; animation: bannerIn 2.6s ease forwards; width: min(760px, 92vw); }
  .bt { font-family: var(--font-display); font-size: clamp(40px, 6vw, 68px); color: #fff; line-height: 1; -webkit-text-stroke: 9px var(--ink); paint-order: stroke fill; text-shadow: 0 6px 0 var(--ink), 0 11px 0 var(--hue-shadow); }
  .bs { display: inline-block; margin-top: 12px; padding: 2px 16px 4px; font-family: var(--font-display); font-size: 1.3em; color: var(--ink); background: var(--toon-gold); border: var(--bw) solid var(--ink); border-radius: 99px; box-shadow: 0 4px 0 var(--ink); }
  @keyframes bannerIn { 0% { opacity: 0; transform: translate(-50%, 10px) scale(0.7) rotate(-4deg); } 12% { opacity: 1; transform: translate(-50%, 0) scale(1.06) rotate(-2deg); } 18% { transform: translate(-50%, 0) scale(1) rotate(-2deg); } 80% { opacity: 1; transform: translate(-50%, 0) rotate(-2deg); } 100% { opacity: 0; transform: translate(-50%, -6px) rotate(-2deg); } }

  /* ===== appel de vague : le crâne à l'entrée du chemin, cerclé de blanc ===== */
  .waveanchor { position: absolute; left: 0; top: 0; width: 0; height: 0; visibility: hidden; }
  .wavebtn {
    position: absolute; left: -32px; top: -32px; width: 64px; height: 64px; cursor: pointer; border: var(--bw) solid var(--ink); padding: 0; border-radius: 50%;
    background: var(--toon-red); color: #fff; display: grid; place-items: center; touch-action: manipulation;
    box-shadow: 0 0 0 4px #fff, 0 0 0 7px var(--ink), 0 6px 12px 4px rgba(43, 26, 18, 0.25); transition: transform 0.1s;
  }
  .wavebtn :global(.icon) { width: 30px; height: 30px; }
  .wavebtn:has(:global(.ico3d)) { background: #e5493c; }
  .wavebtn :global(.ico3d) { position: absolute; inset: -4px; width: calc(100% + 8px) !important; height: calc(100% + 8px) !important; margin: 0 !important; }
  .wavebtn:hover { transform: scale(1.08); }
  .wavebtn:active { transform: scale(0.95); }
  .wavebtn.first { animation: beat 1.4s ease-in-out infinite; }
  .wavebtn.first::after { content: ''; position: absolute; inset: -14px; border-radius: 50%; border: 4px solid #fff; animation: ping 1.4s ease-out infinite; pointer-events: none; }
  @keyframes beat { 50% { transform: scale(1.1); } }
  @keyframes ping { from { opacity: 1; transform: scale(0.85); } to { opacity: 0; transform: scale(1.45); } }
  .wavebtn .sec { position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); z-index: 1; font-family: var(--font-display); font-size: 15px; color: var(--ink); white-space: nowrap; font-variant-numeric: tabular-nums;
    background: var(--gold-fill); border: 2.5px solid var(--ink); border-radius: 99px; padding: 0 8px; box-shadow: 0 2px 0 var(--ink); }
  .wavecard { position: absolute; left: 50px; top: -38px; width: min(290px, calc(100vw - 24px)); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; font-size: 14px; z-index: 6;
    background: var(--panel); border: var(--bw) solid var(--ink); border-radius: var(--r); box-shadow: var(--rim), var(--shadow); animation: pop 0.14s ease; }
  .wavecard.flip { left: auto; right: 50px; }
  .wh { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .wh b { font-family: var(--font-display); font-weight: 400; font-size: 1.55em; line-height: 1; }
  .wh span { color: var(--muted); font-size: 0.9em; font-weight: 800; }
  .wavecard ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
  .wavecard li { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; font-weight: 800; }
  .wavecard li b { font-family: var(--font-display); font-weight: 400; font-size: 1.15em; font-variant-numeric: tabular-nums; }
  .wavecard li.boss { color: var(--bad); }
  .wavecard em { font-style: normal; font-size: 10.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink); background: var(--gold-fill); border: 1.5px solid var(--ink); border-radius: 99px; padding: 0 6px; margin-left: 6px; }
  .wm { display: flex; flex-direction: column; gap: 3px; font-size: 12.5px; font-weight: 800; color: var(--magic); }
  .wf { display: flex; justify-content: space-between; align-items: center; gap: 8px; border-top: 2px dashed var(--ink-soft); padding-top: 8px; font-size: 13px; font-weight: 800; color: var(--muted); }
  .wf b { color: var(--gold); }
  .again { color: var(--blue); font-weight: 900; font-size: 12.5px; }

  .radialAnchor { position: absolute; left: 0; top: 0; visibility: hidden; }

  /* ===== héros et sorts ===== */
  /* bureau : héros, compétences et sorts dans une seule barre, tout centré verticalement */
  .bottomleft { position: absolute; left: calc(12px + var(--sal)); bottom: calc(12px + var(--sab)); display: flex; align-items: center; gap: 14px;
    padding: 10px 14px 10px 10px; background: var(--toon-cream); border: var(--bw) solid var(--ink); border-radius: 22px; box-shadow: var(--rim), var(--shadow); pointer-events: auto; }
  .heroCard { display: flex; gap: 12px; padding: 0; align-items: center; background: none; border: 0; box-shadow: none; border-radius: 0; }
  .portrait { position: relative; width: 84px; height: 84px; border: var(--bw) solid var(--ink); background: var(--toon-blue); cursor: pointer; padding: 0; overflow: visible; flex: none; border-radius: 50%; box-shadow: 0 4px 0 var(--ink); touch-action: manipulation; transition: transform 0.08s; }
  .portrait:hover { transform: translateY(-2px); }
  .portrait img { width: 100%; height: 100%; display: block; border-radius: 50%; }
  .portrait.dead img { filter: grayscale(1) brightness(0.5); }
  .lvl { position: absolute; left: -4px; bottom: -4px; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: var(--toon-gold); border: var(--bw) solid var(--ink); box-shadow: 0 2px 0 var(--ink);
    color: var(--ink); font-family: var(--font-display); font-size: 17px; font-variant-numeric: tabular-nums; }
  .phbar { display: none; }
  .resp { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--font-display); font-size: 34px; color: #fff; -webkit-text-stroke: 5px var(--ink); paint-order: stroke fill; }
  .hcol { display: flex; flex-direction: column; gap: 6px; min-width: 200px; }
  .hname { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-family: var(--font-display); font-size: 1.6em; line-height: 1; }
  .hname small { font-family: var(--font-ui); font-size: 0.5em; font-weight: 900; color: var(--muted); }
  .bar { height: 16px; border: var(--bw) solid var(--ink); background: #5a3f33; overflow: hidden; border-radius: 99px; }
  .bar i { display: block; height: 100%; border-radius: 99px; transition: width 0.15s; }
  .bar.hp i { background: linear-gradient(180deg, #ff8a7a 0 35%, #e5493c 35%); }
  .bar.xp { height: 10px; border-width: 2px; }
  .bar.xp i { background: var(--blue); }
  .skills { display: flex; gap: 12px; margin-top: 4px; }
  .skill { position: relative; width: 48px; height: 48px; border: var(--bw) solid var(--ink); color: var(--ink); cursor: pointer; padding: 0; display: grid; place-items: center; border-radius: 50%;
    background: var(--toon-cream); box-shadow: 0 3px 0 var(--ink); touch-action: manipulation; transition: transform 0.08s; }
  .skill:hover:not(:disabled) { transform: translateY(-2px); }
  .skill:active:not(:disabled) { transform: translateY(2px); box-shadow: none; }
  .skill .sn { display: none; }
  .skill .si { display: contents; }
  .skill .si :global(svg.icon) { width: 26px; height: 26px; }
  .skill:has(.si :global(.ico3d)) { background: var(--ink); }
  .skill .si :global(.ico3d) { width: 100%; height: 100%; margin: 0; vertical-align: 0; }
  .skill.ult:not(.locked) { border-color: var(--gold-lo); }
  .skill.locked { background: #d9c5a0; box-shadow: none; border-style: dashed; cursor: default; }
  .skill.locked :global(.icon) { width: 24px; height: 24px; opacity: 0.75; }
  .skill.locked .sn { display: block; position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%); font-size: 10.5px; font-weight: 900; white-space: nowrap; padding: 0 5px; border-radius: 99px; background: var(--ink); color: var(--on-dark); }
  .skill:disabled:not(.locked) { opacity: 0.55; cursor: default; }
  .skill .kbd, .spell .kbd { position: absolute; bottom: -6px; right: -6px; font-size: 11px; line-height: 14px; }
  /* recharge : voile circulaire qui se découvre */
  .cd { position: absolute; inset: 0; display: grid; place-items: center; border-radius: inherit; font-family: var(--font-display); font-size: 20px; color: #fff; font-variant-numeric: tabular-nums; -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill;
    background: conic-gradient(rgba(43, 26, 18, 0.72) calc(var(--p, 1) * 360deg), rgba(43, 26, 18, 0.18) 0); }
  .spells { display: flex; gap: 12px; align-items: center; padding-left: 14px; border-left: 2.5px dashed var(--ink-soft); align-self: stretch; }
  .spell { position: relative; width: 62px; height: 62px; padding: 0; cursor: pointer; display: grid; place-items: center; border: var(--bw) solid var(--ink); border-radius: 50%; color: var(--ink);
    background: var(--toon-cream); box-shadow: 0 3px 0 var(--ink); touch-action: manipulation; transition: transform 0.08s; overflow: visible; }
  .spell:has(:global(.ico3d)) { background: var(--ink); }
  /* prêt : le contour passe au doré et un halo discret pulse */
  .spell.ready { border-color: var(--gold-lo); }
  .spell.ready::after { content: ''; position: absolute; inset: -6px; border-radius: 50%; border: 3px solid var(--gold-fill); opacity: 0; animation: ready 2.4s ease-out infinite; pointer-events: none; }
  @keyframes ready { 0% { opacity: 0.9; transform: scale(0.96); } 60%, 100% { opacity: 0; transform: scale(1.18); } }
  .spell :global(.icon) { width: 32px; height: 32px; }
  .spell :global(.ico3d) { width: 100%; height: 100%; margin: 0; vertical-align: 0; }
  .spell .cd { inset: 0; }
  .spell:hover { transform: translateY(-2px); }
  .spell:active { transform: translateY(2px) scale(0.96); }

  /* ===== joueurs (coop) ===== */
  .players { position: absolute; right: calc(14px + var(--sar)); top: calc(76px + var(--sat)); display: flex; flex-direction: column; gap: 6px; }
  .pl { display: flex; gap: 8px; align-items: center; background: var(--toon-cream); border: 2.5px solid var(--ink); border-radius: 99px; box-shadow: inset 10px 0 0 var(--c), 0 3px 0 var(--ink); padding: 3px 10px 3px 18px; font-size: 0.88em; }
  .pl b { font-weight: 900; }
  .pl.off { opacity: 0.65; }
  .pl.gone { opacity: 0.4; }
  .pg { display: inline-flex; align-items: center; gap: 3px; color: #a05f00; font-weight: 900; font-variant-numeric: tabular-nums; }
  .ping { color: var(--muted); font-size: 0.85em; font-variant-numeric: tabular-nums; }
  .chatwrap { position: absolute; left: calc(14px + var(--sal)); bottom: 150px; width: min(380px, 60vw); }

  /* ===== infos de sélection ===== */
  .info { position: absolute; right: calc(14px + var(--sar)); bottom: calc(16px + var(--sab)); width: min(340px, 50vw); padding: 12px 14px; font-size: 0.92em; animation: pop 0.16s ease; }
  .info b { font-family: var(--font-display); font-weight: 400; font-size: 1.35em; }
  .info img { background: linear-gradient(180deg, #a9d3f2 0 55%, #7cc242 55%); border: 2.5px solid var(--ink); border-radius: 50%; }
  .info.hint { width: auto; max-width: 60vw; font-weight: 800; }
  .tsh { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 4px; }
  .tc { display: inline-flex; align-items: center; gap: 4px; font-family: var(--font-display); font-size: 1.15em; color: #a05f00; font-variant-numeric: tabular-nums; }
  .tc.poor { color: var(--bad); }
  .tipsheet .again { margin-top: 6px; }
  .nowrap { white-space: nowrap; margin-left: 8px; }
  .small { font-size: 0.9em; color: var(--muted); font-weight: 700; }
  .stats { display: flex; flex-wrap: wrap; gap: 4px 6px; margin-top: 8px; font-weight: 900; font-size: 0.82em; font-variant-numeric: tabular-nums; }
  .stats span { padding: 0 8px; border: 2px solid var(--ink); border-radius: 99px; background: var(--panel-hi); }
  .dmg { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .debug { position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%); background: rgba(43, 26, 18, 0.85); color: var(--on-dark); padding: 3px 10px; border-radius: 99px; font-family: monospace; font-size: 12px; }
  @media (max-width: 1100px) {
    .call { display: none; }
  }
  @media (max-width: 820px) {
    .hud:not(.touch) .spells { padding-left: 10px; }
    .hud:not(.touch) .chatwrap { bottom: 150px; }
    .top { gap: 8px; font-size: 0.88em; }
    .segs { display: none; }
  }

  /* =====================================================================
     Tactile : barre du bas pleine largeur (héros à gauche, sorts à droite),
     tiroir d'informations au-dessus, cibles d'au moins 44 px.
     ===================================================================== */
  .hud.touch { --bb: 80px; }
  .touch .top { top: calc(8px + var(--sat)); left: calc(8px + var(--sal)); gap: 8px; row-gap: 12px; flex-wrap: wrap; max-width: calc(100vw - 32px - 170px - var(--sal) - var(--sar)); font-size: 0.82em; }
  .touch .stat { height: 40px; padding: 0 12px 0 4px; }
  .touch .stat :global(.icon) { width: 30px; height: 30px; }
  .touch .stat :global(svg.icon) { width: 22px; height: 22px; }
  .touch .segs, .touch .next { display: none; }
  .touch .topright { top: calc(8px + var(--sat)); right: calc(8px + var(--sar)); gap: 8px; }
  .touch .sysbtn { min-width: 46px; width: 46px; height: 46px; padding: 0; border-radius: 50%; }
  .touch .sysbtn .x2 { display: none; }
  .touch .sysbtn:has(.votes) { width: auto; padding: 0 10px; border-radius: 99px; }
  .touch .muts { top: calc(62px + var(--sat)); left: calc(8px + var(--sal)); }
  .touch .players { top: calc(64px + var(--sat)); right: calc(8px + var(--sar)); }
  .touch .pl { font-size: 0.8em; padding: 2px 8px 2px 16px; }
  .touch .ping { display: none; }

  .touch .bottomleft { left: calc(8px + var(--sal)); right: calc(8px + var(--sar)); bottom: calc(8px + var(--sab)); justify-content: space-between; align-items: flex-end; gap: 8px; pointer-events: none;
    padding: 0; background: none; border: 0; box-shadow: none; border-radius: 0; }
  .touch .heroCard { gap: 10px; padding: 6px 10px 6px 6px; border-radius: 99px; align-items: center; background: var(--toon-cream); border: var(--bw) solid var(--ink); box-shadow: var(--rim), var(--shadow-sm); }
  .touch .portrait { width: 60px; height: 60px; box-shadow: 0 3px 0 var(--ink); }
  .touch .lvl { left: -5px; bottom: -5px; width: 26px; height: 26px; font-size: 14px; border-width: 2.5px; }
  .touch .phbar { display: block; position: absolute; left: 8px; right: 8px; bottom: -4px; height: 9px; border: 2px solid var(--ink); border-radius: 99px; background: #5a3f33; overflow: hidden; }
  .touch .phbar i { display: block; height: 100%; background: var(--life); transition: width 0.15s; }
  .touch .hcol { min-width: 0; gap: 0; }
  .touch .hname, .touch .bar { display: none; }
  .touch .skills { margin: 0; gap: 8px; }
  .touch .skill { width: 50px; height: 50px; }
  .touch .skill .si :global(.ico3d) { width: 52px; height: 52px; }
  .touch .cd { font-size: 17px; }
  .touch .spells { gap: 10px; pointer-events: auto; padding: 6px; border: var(--bw) solid var(--ink); border-radius: 99px; background: var(--toon-cream); box-shadow: var(--rim), var(--shadow-sm); align-self: auto; }
  .touch .spell { width: 56px; height: 56px; }
  .touch .heroCard, .touch .spells { pointer-events: auto; }

  .touch .targeting { bottom: calc(var(--bb) + 18px + var(--sab)); white-space: normal; text-align: center; max-width: calc(100vw - 24px); padding: 6px 6px 6px 16px; font-size: 0.92em; }
  .touch .chatwrap { bottom: calc(var(--bb) + 14px + var(--sab)); width: min(340px, calc(100vw - 16px)); left: calc(8px + var(--sal)); }
  .touch .banner { top: 18%; }

  /* tiroir d'informations : au-dessus de la barre du bas */
  .touch .info, .touch :global(.tp) {
    left: calc(8px + var(--sal)); right: calc(8px + var(--sar)); width: auto; max-width: none;
    bottom: calc(var(--bb) + 16px + var(--sab)); max-height: 36vh; overflow: auto; padding: 10px 14px; border-radius: 18px;
  }
  .touch .info.hint { text-align: center; font-size: 0.88em; color: var(--muted); padding: 8px 12px; }
  .touch .sheet-top, .touch :global(.tp.sheet-top) { top: calc(64px + var(--sat)); bottom: auto; }

  /* paysage sur téléphone : le tiroir passe à droite, entre le haut et la barre du bas */
  @media (orientation: landscape) and (max-height: 560px) {
    .hud.touch { --bb: 74px; }
    .touch .info, .touch :global(.tp) { left: auto; width: min(320px, 42vw); top: calc(62px + var(--sat)); bottom: calc(var(--bb) + 14px + var(--sab)); max-height: none; }
    .touch .info.hint, .touch .info.tipsheet { top: auto; }
    .touch :global(.tp:not(.open)) { bottom: auto; }
    .touch .sheet-left, .touch :global(.tp.sheet-left) { left: calc(8px + var(--sal)); right: auto; }
    .touch .info.sheet-left.hint, .touch .info.sheet-left.tipsheet { top: calc(62px + var(--sat)); bottom: auto; }
    .touch .players { top: calc(62px + var(--sat)); right: auto; left: calc(8px + var(--sal)); }
  }
  /* très petits écrans */
  @media (max-width: 430px) {
    .touch .heroCard { gap: 8px; padding-right: 8px; }
    .touch .skills { gap: 6px; }
    .touch .skill { width: 44px; height: 44px; }
    .touch .skill .si :global(.ico3d) { width: 46px; height: 46px; }
    .touch .portrait { width: 52px; height: 52px; }
    .touch .spells { gap: 6px; padding: 4px; }
    .touch .spell { width: 50px; height: 50px; }
  }
  @media (max-width: 370px) {
    .touch .skill { width: 40px; height: 40px; }
    .touch .portrait { width: 48px; height: 48px; }
    .touch .spell { width: 46px; height: 46px; }
    .touch .top { gap: 6px; font-size: 0.74em; }
  }
</style>
