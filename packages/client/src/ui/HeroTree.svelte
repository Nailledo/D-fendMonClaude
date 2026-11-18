<script lang="ts">
  import { onMount } from 'svelte';
  import {
    AVENTURIER, CLASSES, CORE, CORE_COST, CORE_RANKS, DmgType, HEROES, PATH_SKILL, SKILL_UNLOCK, STAT_LABEL, ULT_NODE,
    classNodes, classOf, heroSkills, nodeOpen, nodeReqs, type ClassSkill, type TreeNode,
  } from '@dfend/shared';
  import { setHero, ui } from '../state.svelte';
  import { buyCore, buyNode, canBuyCore, canBuyNode, heroBuild, heroPointsLeft, heroPointsTotal, loadout, resetHero } from '../meta';
  import { net } from '../net/Net';
  import HeroPicker from './HeroPicker.svelte';
  import Ico from './Ico.svelte';
  import { hex, nodeIcon, skillIcon } from './classIcons';
  import { ICON } from './icons';

  /**
   * Arbre du héros, en étoile : le cœur (nœuds communs) autour du portrait, puis six branches de classe.
   * Chaque branche part d'une racine (la vocation), se divise en deux voies, et se referme sur l'ultime.
   */
  const build = $derived(heroBuild());
  const left = $derived(heroPointsLeft());
  const total = $derived(heroPointsTotal());
  const active = $derived(classOf(build));
  const kit = $derived(heroSkills(build));

  type Sel = { t: 'core'; k: number } | { t: 'cls'; c: number; i: number };
  const b0 = heroBuild();
  let sel = $state<Sel>(b0.cls >= 0 ? { t: 'cls', c: b0.cls, i: 0 } : { t: 'core', k: 0 });
  let confirmReset = $state(false);
  let showSkins = $state(false);

  // ------------------------------------------------------------ géométrie
  const RAD = Math.PI / 180;
  const pol = (r: number, deg: number): [number, number] => [r * Math.cos(deg * RAD), r * Math.sin(deg * RAD)];
  const clsAngle = (c: number) => -90 + 60 * c;
  const PATH_R = [278, 334, 390, 446, 506];
  const PATH_OFF = [18, 15, 13, 13, 22];
  function nodePos(c: number, i: number): [number, number] {
    const a = clsAngle(c);
    if (i === 0) return pol(190, a);
    if (i === ULT_NODE) return pol(560, a);
    const side = i <= 5 ? -1 : 1;
    const k = (i - 1) % 5;
    return pol(PATH_R[k], a + side * PATH_OFF[k]);
  }
  /** pastille de rang : sur le côté extérieur de la voie (pas sur le nœud suivant) */
  function pillOff(c: number, i: number, s: number): [number, number] {
    const side = i <= 5 ? -1 : 1;
    const a = (clsAngle(c) + side * 90) * RAD;
    return [Math.cos(a) * (s + 24), Math.sin(a) * (s + 24)];
  }
  const corePos = (k: number) => pol(112, clsAngle(k) + 30);
  const nodeSize = (n: TreeNode) => (n.kind === 'root' ? 34 : n.kind === 'ult' ? 37 : n.kind === 'skill' ? 29 : n.kind === 'passive' ? 24 : 21);
  const EDGES: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [0, 6], [6, 7], [7, 8], [8, 9], [9, 10], [4, 11], [9, 11]];
  const ROOT_ICON = ['strike', 'bulwark', 'bow', 'orb', 'skull', 'bomb'];
  const TREES = CLASSES.map((c) => classNodes(c));

  /** courbe douce entre deux nœuds (tirée vers l'extérieur, comme une branche) */
  function curve(a: [number, number], b: [number, number]) {
    const ra = Math.hypot(a[0], a[1]), rb = Math.hypot(b[0], b[1]);
    const ab = Math.atan2(b[1], b[0]);
    const rm = (ra + rb) / 2;
    const cx = Math.cos(ab) * rm, cy = Math.sin(ab) * rm;
    return `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
  }
  /** corps d'une icône au trait (sans son <svg>), pour la dessiner dans le SVG de l'arbre */
  const body = (svg: string) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const nodeGlyph = (n: TreeNode, c: number) =>
    body(nodeIcon(n.kind === 'root' ? ROOT_ICON[c] : n.kind === 'skill' || n.kind === 'ult' ? n.skill.icon : n.icon));

  // ------------------------------------------------------------ état des nœuds
  const rankOf = (c: number, i: number) => (build.cls === c ? build.r[i] : 0);
  const lockedCls = (c: number) => build.cls >= 0 && build.cls !== c;
  /** compétence de voie fermée par l'autre */
  const excluded = (c: number, i: number) => {
    const o = PATH_SKILL.indexOf(i);
    return o >= 0 && rankOf(c, PATH_SKILL[1 - o]) > 0;
  };
  /** nœud derrière une compétence de voie fermée */
  const behindExcluded = (c: number, i: number) => {
    if (i === 0 || i === ULT_NODE) return false;
    const side = i <= 5 ? 0 : 1;
    return rankOf(c, PATH_SKILL[1 - side]) > 0 && i >= PATH_SKILL[side];
  };
  const edgeState = (c: number, a: number, b: number) =>
    rankOf(c, a) > 0 && rankOf(c, b) > 0 ? 'on' : rankOf(c, a) > 0 && nodeOpen(build, c, b) ? 'next' : 'off';
  function nodeTitle(n: TreeNode) {
    return n.kind === 'skill' || n.kind === 'ult' ? n.skill.name : n.name;
  }

  // ------------------------------------------------------------ détail du nœud sélectionné
  const fmt = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',');
  const skillMeta = (s: ClassSkill, slot: number) => `Emplacement ${slot + 1} · niveau ${SKILL_UNLOCK[slot]} du héros en partie · recharge ${s.cd} s`;
  const info = $derived.by(() => {
    if (sel.t === 'core') {
      const n = CORE[sel.k];
      const r = build.core[sel.k];
      return {
        color: '#e8b931', kind: 'Cœur · toutes classes', name: n.name, rank: r, ranks: CORE_RANKS, cost: CORE_COST,
        desc: `${STAT_LABEL[n.stat](n.per)} par rang.`, extra: r ? `Actuellement : ${STAT_LABEL[n.stat](n.per * r)}.` : '', path: '',
        owned: r >= CORE_RANKS, can: canBuyCore(sel.k), why: r >= CORE_RANKS ? '' : left < CORE_COST ? 'Pas assez de points' : '',
      };
    }
    const ci = sel.c, c = CLASSES[ci], n = TREES[ci][sel.i], i = sel.i;
    const r = rankOf(sel.c, i);
    const path = i > 0 && i < ULT_NODE ? c.paths[i <= 5 ? 0 : 1] : null;
    let kind = '', name = '', desc = '', extra = '';
    if (n.kind === 'root') {
      kind = 'Vocation'; name = n.name; desc = n.desc;
      extra = `PV ${c.hp} · dégâts ${c.dmg[0]}–${c.dmg[1]} · ${c.range ? `portée ${fmt(c.range)}` : 'mêlée'} · ${c.dmgType === DmgType.Magic ? 'magique' : 'physique'} · armure ${Math.round(c.armor * 100)} %`;
    } else if (n.kind === 'stat') {
      kind = 'Statistique'; name = n.name; desc = `${STAT_LABEL[n.stat](n.per)} par rang.`;
      if (r) extra = `Actuellement : ${STAT_LABEL[n.stat](n.per * r)}.`;
    } else if (n.kind === 'passive') {
      kind = 'Passif'; name = n.name; desc = n.desc;
    } else if (n.kind === 'skill') {
      kind = 'Compétence de voie'; name = n.skill.name; desc = n.skill.desc; extra = skillMeta(n.skill, 1);
    } else {
      kind = 'Ultime'; name = n.skill.name; desc = n.skill.desc; extra = skillMeta(n.skill, 2);
    }
    let why = '';
    if (r >= n.ranks) why = '';
    else if (lockedCls(sel.c)) why = `Votre héros est ${CLASSES[build.cls].name.toLowerCase()} : réinitialisez l’arbre pour changer de classe.`;
    else if (excluded(sel.c, i)) why = `Exclu : vous avez choisi « ${(TREES[sel.c][PATH_SKILL[1 - PATH_SKILL.indexOf(i)]] as { skill: ClassSkill }).skill.name} ».`;
    else if (behindExcluded(sel.c, i)) why = 'Cette voie est fermée par la compétence de l’autre voie.';
    else if (!nodeOpen(build, sel.c, i)) why = `Prérequis : ${nodeReqs(i).map((q) => nodeTitle(TREES[ci][q])).join(' ou ')}.`;
    else if (left < n.cost) why = 'Pas assez de points.';
    return {
      color: hex(c.color), kind: `${c.name} · ${kind}`, name, rank: r, ranks: n.ranks, cost: n.cost, desc, extra,
      path: path ? `Voie ${path.name} : ${path.desc}` : '', owned: r >= n.ranks, can: canBuyNode(sel.c, i), why,
    };
  });

  // ------------------------------------------------------------ actions
  function sync() {
    // dans un salon : le serveur doit connaître le nouvel arbre
    if (ui.room && !ui.room.inGame) net.send({ t: 'meta', ...loadout() });
  }
  function buy() {
    const ok = sel.t === 'core' ? buyCore(sel.k) : buyNode(sel.c, sel.i);
    if (ok) sync();
  }
  function reset() {
    if (!confirmReset) { confirmReset = true; setTimeout(() => (confirmReset = false), 2500); return; }
    confirmReset = false;
    resetHero();
    sync();
  }
  function pickSkin(h: typeof ui.hero) {
    setHero(h);
    if (ui.room && !ui.room.inGame) net.send({ t: 'hero', hero: h });
  }
  /** double-clic : sélection et achat */
  function quick(s: Sel) {
    sel = s;
    buy();
  }

  // ------------------------------------------------------------ zoom (écrans étroits)
  let view: HTMLDivElement;
  let zoom = $state(1);
  let narrow = $state(false);
  function setZoom(z: number) {
    const cx = (view.scrollLeft + view.clientWidth / 2) / view.scrollWidth, cy = (view.scrollTop + view.clientHeight / 2) / view.scrollHeight;
    zoom = Math.max(1, Math.min(3, z));
    requestAnimationFrame(() => {
      view.scrollLeft = cx * view.scrollWidth - view.clientWidth / 2;
      view.scrollTop = cy * view.scrollHeight - view.clientHeight / 2;
    });
  }
  onMount(() => {
    narrow = view.clientWidth < 620;
    if (narrow) {
      zoom = 2;
      requestAnimationFrame(() => {
        // centré sur la branche choisie, sinon sur le cœur
        const [x, y] = build.cls >= 0 ? nodePos(build.cls, 0) : [0, 0];
        view.scrollLeft = ((x + 610) / 1220) * view.scrollWidth - view.clientWidth / 2;
        view.scrollTop = ((y + 610) / 1220) * view.scrollHeight - view.clientHeight / 2;
      });
    }
  });
</script>

<div class="overlay-bg">
  <div class="panel box">
    <div class="head">
      <h2>Arbre du héros</h2>
      <div class="wallet" title="Points de héros disponibles (gagnés au total : {total})">
        <b>{left}</b><span>point{left > 1 ? 's' : ''} sur {total}</span>
      </div>
      <button class="btn small" onclick={() => (ui.overlay = null)}>Fermer</button>
    </div>

    <div class="main">
      <div class="view" bind:this={view}>
        <svg viewBox="-610 -610 1220 1220" style="--z:{zoom}" role="img" aria-label="Arbre de compétences du héros">
          <defs>
            <radialGradient id="ht-bg" cx="0" cy="0" r="640" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#26324a" />
              <stop offset="0.55" stop-color="#141b2b" />
              <stop offset="1" stop-color="#0b0f19" />
            </radialGradient>
            <filter id="ht-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <clipPath id="ht-hub"><circle r="58" /></clipPath>
          </defs>
          <rect x="-610" y="-610" width="1220" height="1220" fill="url(#ht-bg)" />
          {#each [112, 190, 382, 560] as r}<circle {r} class="ring" />{/each}

          <!-- liens : portrait → cœur et racines -->
          {#each CORE as _, k}
            {@const p = corePos(k)}
            <line x1="0" y1="0" x2={p[0]} y2={p[1]} class="edge" class:on={build.core[k] > 0} style="--ec:#e8b931" />
          {/each}
          {#each CLASSES as c, ci}
            {@const p = nodePos(ci, 0)}
            <line x1="0" y1="0" x2={p[0]} y2={p[1]} class="edge" class:on={rankOf(ci, 0) > 0} class:dim={lockedCls(ci)} style="--ec:{hex(c.color)}" />
          {/each}

          <!-- branches -->
          {#each CLASSES as c, ci}
            {@const col = hex(c.color)}
            {@const lp = pol(240, clsAngle(ci))}
            <g class="branch" class:locked={lockedCls(ci)} style="--cc:{col}">
              {#each EDGES as [a, b]}
                <path d={curve(nodePos(ci, a), nodePos(ci, b))} class="edge {edgeState(ci, a, b)}" class:dim={behindExcluded(ci, b) || excluded(ci, b)} style="--ec:{col}" />
              {/each}
              {#each TREES[ci] as n, i}
                {@const [x, y] = nodePos(ci, i)}
                {@const s = nodeSize(n)}
                {@const r = rankOf(ci, i)}
                {@const open = nodeOpen(build, ci, i)}
                {@const on = sel.t === 'cls' && sel.c === ci && sel.i === i}
                <g
                  class="node {n.kind}"
                  class:owned={r > 0}
                  class:full={r >= n.ranks}
                  class:open
                  class:afford={open && left >= n.cost}
                  class:shut={excluded(ci, i) || behindExcluded(ci, i)}
                  transform="translate({x.toFixed(1)},{y.toFixed(1)})"
                  role="button"
                  tabindex="0"
                  aria-label={nodeTitle(n)}
                  onclick={() => (sel = { t: 'cls', c: ci, i })}
                  ondblclick={() => quick({ t: 'cls', c: ci, i })}
                  onkeydown={(e) => e.key === 'Enter' && (sel = { t: 'cls', c: ci, i })}
                >
                  <title>{nodeTitle(n)}</title>
                  {#if on}<circle r={s + 10} class="halo" />{/if}
                  {#if n.kind === 'passive'}
                    <rect x={-s * 0.85} y={-s * 0.85} width={s * 1.7} height={s * 1.7} rx="5" transform="rotate(45)" class="disc" />
                  {:else}
                    <circle r={s} class="disc" />
                    {#if n.kind === 'skill' || n.kind === 'ult' || n.kind === 'root'}<circle r={s - 5} class="inner" />{/if}
                  {/if}
                  <g class="glyph" transform="translate({-s * 0.6},{-s * 0.6}) scale({(s * 1.2) / 24})">{@html nodeGlyph(n, ci)}</g>
                  {#if lockedCls(ci) && i === 0}
                    <g class="lock" transform="translate({s * 0.35},{-s * 1.25}) scale(0.9)">{@html body(ICON.lock)}</g>
                  {/if}
                  {#if n.ranks > 1}
                    {@const po = pillOff(ci, i, s)}
                    <g transform="translate({po[0].toFixed(1)},{po[1].toFixed(1)})"><rect x="-20" y="-11" width="40" height="21" rx="10.5" class="pill" /><text y="5" class="rk">{r}/{n.ranks}</text></g>
                  {/if}
                  {#if open && r < n.ranks}
                    <g transform="translate({s * 0.85},{-s * 0.85})"><circle r="12" class="cost" /><text y="5" class="ct">{n.cost}</text></g>
                  {/if}
                </g>
              {/each}
              <text x={lp[0]} y={lp[1] + 6} class="cname">{c.name}</text>
            </g>
          {/each}

          <!-- cœur -->
          {#each CORE as n, k}
            {@const [x, y] = corePos(k)}
            {@const r = build.core[k]}
            {@const on = sel.t === 'core' && sel.k === k}
            <g
              class="node core"
              class:owned={r > 0}
              class:full={r >= CORE_RANKS}
              class:open={r < CORE_RANKS}
              class:afford={r < CORE_RANKS && left >= CORE_COST}
              style="--cc:#e8b931"
              transform="translate({x.toFixed(1)},{y.toFixed(1)})"
              role="button"
              tabindex="0"
              aria-label={n.name}
              onclick={() => (sel = { t: 'core', k })}
              ondblclick={() => quick({ t: 'core', k })}
              onkeydown={(e) => e.key === 'Enter' && (sel = { t: 'core', k })}
            >
              <title>{n.name}</title>
              {#if on}<circle r="32" class="halo" />{/if}
              <circle r="22" class="disc" />
              <g class="glyph" transform="translate(-13,-13) scale(1.08)">{@html body(nodeIcon(n.icon))}</g>
              <g transform="translate(0,34)"><rect x="-17" y="-10" width="34" height="19" rx="9.5" class="pill" /><text y="4.5" class="rk">{r}/{CORE_RANKS}</text></g>
            </g>
          {/each}

          <!-- portrait -->
          <g class="hub" role="button" tabindex="0" aria-label="Changer d’apparence" onclick={() => (showSkins = !showSkins)} onkeydown={(e) => e.key === 'Enter' && (showSkins = !showSkins)}>
            <circle r="64" class="hubring" style="--cc:{active ? hex(active.color) : '#e8b931'}" />
            {#if ui.portraits[ui.hero]}<image href={ui.portraits[ui.hero]} x="-58" y="-58" width="116" height="116" clip-path="url(#ht-hub)" />{/if}
          </g>
        </svg>
        {#if narrow}
          <div class="zoom">
            <button class="btn small" onclick={() => setZoom(zoom + 0.5)} aria-label="Zoomer">+</button>
            <button class="btn small" onclick={() => setZoom(zoom - 0.5)} aria-label="Dézoomer">−</button>
          </div>
        {/if}
      </div>

      <aside class="side scroll">
        <section class="detail" style="--bc:{info.color}">
          <span class="kind">{info.kind}</span>
          <b class="nm">{info.name}</b>
          {#if info.ranks > 1}<span class="rank">Rang {info.rank}/{info.ranks}</span>{/if}
          <p>{info.desc}</p>
          {#if info.extra}<p class="extra">{info.extra}</p>{/if}
          {#if info.path}<p class="path">{info.path}</p>{/if}
          <div class="act">
            {#if info.owned}
              <span class="tag ok">Acquis</span>
            {:else}
              {#if info.why}<span class="tag">{info.why}</span>{/if}
              {#if info.can || info.why.startsWith('Pas assez')}<button class="btn gold" disabled={!info.can} onclick={buy}>Apprendre · {info.cost} pt{info.cost > 1 ? 's' : ''}</button>{/if}
            {/if}
          </div>
        </section>

        <section class="me" style="--bc:{hex(active ? active.color : AVENTURIER.color)}">
          <div class="who">
            {#if ui.portraits[ui.hero]}<img src={ui.portraits[ui.hero]} alt="" />{/if}
            <div>
              <b>{HEROES[ui.hero].name}</b>
              <span>{active ? `${active.name} · ${active.role}` : `${AVENTURIER.name} · ${AVENTURIER.role}`}</span>
            </div>
            <button class="btn small" onclick={() => (showSkins = !showSkins)}>Apparence</button>
          </div>
          {#if showSkins}<HeroPicker value={ui.hero} onpick={pickSkin} compact />{/if}
          <div class="sks">
            {#each kit as s}
              <span class="sk" class:empty={!s} title={s ? `${s.name} : ${s.desc}` : 'Ultime : au bout d’une branche de classe'}>
                {#if s}<Ico k={skillIcon(s).k} fb={skillIcon(s).fb} />{:else}{@html ICON.lock}{/if}
                <small>{s ? s.short : 'Ultime'}</small>
              </span>
            {/each}
          </div>
        </section>

        <p class="help">
          Tous les héros commencent en <b>Aventurier</b>. Le <b>cœur</b> profite à toutes les classes. Acheter la <b>vocation</b> d’une branche fixe la classe
          du héros (son arme, ses statistiques, ses compétences) ; les autres branches se verrouillent. Chaque branche se sépare en deux voies dont les
          compétences s’excluent. L’<b>ultime</b> s’ouvre depuis le 4e nœud de l’une ou l’autre voie.<br />
          Points : un par niveau réussi, un de plus en Vétéran, un en Cauchemar, un par difficulté terminée avec trois étoiles. Double-clic sur un nœud pour l’apprendre.
        </p>
        <button class="btn small" class:red={confirmReset} disabled={left === total} onclick={reset}>{confirmReset ? 'Confirmer ?' : 'Réinitialiser l’arbre (gratuit)'}</button>
      </aside>
    </div>
  </div>
</div>

<style>
  .box { width: min(1280px, 100%); height: min(94vh, 960px); display: flex; flex-direction: column; gap: 10px; }
  .head { display: flex; align-items: center; gap: 12px; }
  h2 { margin: 0; font-size: 2em; flex: 1; }
  .wallet { display: flex; align-items: baseline; gap: 6px; padding: 4px 14px; background: var(--panel-hi); border: 2.5px solid var(--ink); border-radius: 99px; box-shadow: 0 3px 0 var(--ink); }
  .wallet b { font-family: var(--font-display); font-weight: 400; font-size: 1.5em; line-height: 1; font-variant-numeric: tabular-nums; }
  .wallet span { font-weight: 800; color: var(--muted); font-size: 0.9em; }

  .main { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 12px; }
  .view { position: relative; min-height: 0; overflow: auto; container-type: size; border: 2.5px solid var(--ink); border-radius: var(--r-sm); background: #0b0f19; overscroll-behavior: contain; }
  svg { display: block; margin: auto; width: calc(var(--z) * min(100cqw, 100cqh)); height: calc(var(--z) * min(100cqw, 100cqh)); user-select: none; -webkit-user-select: none; }
  .zoom { position: sticky; left: 8px; bottom: 8px; display: flex; flex-direction: column; gap: 6px; width: max-content; }
  .zoom .btn { min-width: 40px; font-size: 1.2em; }

  .ring { fill: none; stroke: rgba(255, 255, 255, 0.06); stroke-width: 2; stroke-dasharray: 3 9; }
  .edge { fill: none; stroke: #2b3448; stroke-width: 5; stroke-linecap: round; }
  .edge.next { stroke: #9b8650; stroke-dasharray: 2 10; stroke-width: 4; }
  .edge.on { stroke: var(--ec); stroke-width: 6; filter: url(#ht-glow); }
  .edge.dim { opacity: 0.3; }
  .branch.locked { opacity: 0.38; }
  .cname { fill: #f3ead6; font-family: var(--font-display); font-size: 21px; text-anchor: middle; paint-order: stroke; stroke: #0b0f19; stroke-width: 5px; pointer-events: none; }

  .node { cursor: pointer; outline: none; }
  .disc { fill: #121827; stroke: #3a4560; stroke-width: 3; transition: stroke 0.15s; }
  .inner { fill: none; stroke: #3a4560; stroke-width: 1.5; }
  .glyph { color: #5d6a86; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
  .open .disc { stroke: #b8973a; }
  .open .glyph { color: #d8c8a4; }
  .afford .disc { stroke: #ffd24a; animation: pulse 1.8s ease-in-out infinite; }
  @keyframes pulse { 50% { stroke-width: 6; } }
  .owned .disc { fill: var(--cc); stroke: #fff; filter: url(#ht-glow); }
  .owned .inner { stroke: rgba(255, 255, 255, 0.6); }
  .owned .glyph { color: #fff; }
  .owned.afford .disc { stroke: #ffd24a; }
  .shut .disc { stroke: #252d3f; fill: #0e131f; }
  .shut .glyph { color: #2f374a; }
  .ult .disc { stroke-width: 4; }
  .ult.owned .disc { stroke: #ffd24a; }
  .node:hover .disc, .node:focus-visible .disc { stroke: #fff; }
  .halo { fill: none; stroke: #fff; stroke-width: 2.5; stroke-dasharray: 6 5; }
  .pill { fill: #0b0f19; stroke: #3a4560; stroke-width: 1.5; }
  .owned .pill { stroke: var(--cc); }
  .rk { fill: #f3ead6; font-size: 14px; font-weight: 900; text-anchor: middle; font-variant-numeric: tabular-nums; pointer-events: none; }
  .cost { fill: #ffd24a; stroke: #0b0f19; stroke-width: 2.5; }
  .ct { fill: #1b1b1b; font-size: 15px; font-weight: 900; text-anchor: middle; pointer-events: none; }
  .lock { color: #f3ead6; fill: none; stroke: currentColor; stroke-width: 2.4; pointer-events: none; }
  .hub { cursor: pointer; outline: none; }
  .hubring { fill: #1d2639; stroke: var(--cc); stroke-width: 6; filter: url(#ht-glow); }

  .side { min-height: 0; display: flex; flex-direction: column; gap: 10px; padding-right: 4px; }
  .detail, .me { padding: 10px 12px; background: var(--panel-hi); border: 2.5px solid var(--ink); border-left: 10px solid var(--bc); border-radius: var(--r-sm); box-shadow: 0 3px 0 var(--ink); display: flex; flex-direction: column; gap: 4px; }
  .kind { font-size: 0.78em; font-weight: 900; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .nm { font-family: var(--font-display); font-weight: 400; font-size: 1.45em; line-height: 1.05; }
  .rank { font-weight: 900; font-size: 0.85em; }
  .detail p { margin: 0; font-weight: 700; line-height: 1.35; }
  .detail .extra { font-size: 0.85em; color: var(--muted); }
  .detail .path { font-size: 0.85em; color: var(--muted); font-style: italic; }
  .act { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
  .tag { font-weight: 900; color: var(--muted); font-size: 0.88em; }
  .tag.ok { color: var(--good); }
  .who { display: flex; align-items: center; gap: 10px; }
  .who img { width: 46px; height: 46px; border-radius: 50%; border: 2px solid var(--ink); background: linear-gradient(180deg, #78acf7 0 50%, #3f7ee0 50%); }
  .who div { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .who b { font-family: var(--font-display); font-weight: 400; font-size: 1.2em; }
  .who span { font-size: 0.85em; font-weight: 800; color: var(--muted); }
  .sks { display: flex; gap: 10px; margin-top: 4px; }
  .sk { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 60px; }
  .sk :global(.icon) { width: 44px; height: 44px; margin: 0; border-radius: 50%; background: var(--ink); }
  .sk :global(svg.icon) { padding: 10px; color: #fff; box-sizing: border-box; }
  .sk.empty :global(svg.icon) { background: #d8c8a4; color: var(--muted); }
  .sk small { font-size: 0.72em; font-weight: 900; text-align: center; line-height: 1.1; }
  .help { margin: 0; font-size: 0.82em; font-weight: 700; color: var(--muted); line-height: 1.4; }

  @media (max-width: 860px) {
    .box { height: 100%; }
    .main { grid-template-columns: 1fr; grid-template-rows: minmax(260px, 1fr) auto; }
    .side { max-height: 44vh; }
  }
</style>
