<script lang="ts">
  import { onMount } from 'svelte';
  import {
    AVENTURIER, CLASSES, CORE, CORE_COST, CORE_RANKS, DmgType, HEROES, ROUTE_COUNT, ROUTE_LEN, SKILL_UNLOCK, STAT_LABEL,
    chosenRoute, classNodes, classOf, coreOpen, heroSkills, nodeOpen, nodeReqs, nodeRoute, nodeStep, routeNode, type ClassSkill, type TreeNode,
  } from '@dfend/shared';
  import { setHero, ui } from '../state.svelte';
  import { buyCore, buyNode, canBuyCore, canBuyNode, heroBuild, heroPointsLeft, heroPointsTotal, loadout, resetHero } from '../meta';
  import { net } from '../net/Net';
  import HeroPicker from './HeroPicker.svelte';
  import Ico from './Ico.svelte';
  import { hex, nodeIcon, passiveIcon, skillIcon } from './classIcons';
  import { ICON } from './icons';

  /**
   * Arbre du héros. Sans classe : on choisit d'abord une classe parmi six fiches.
   * Ensuite, l'arbre de cette seule classe : la vocation au centre (le portrait), les fondamentaux autour,
   * et trois routes ; on n'en suit qu'une (compétence → statistique → passif → statistique → passif et ultime).
   */
  const build = $derived(heroBuild());
  const left = $derived(heroPointsLeft());
  const total = $derived(heroPointsTotal());
  const active = $derived(classOf(build));
  const kit = $derived(heroSkills(build));
  const route = $derived(chosenRoute(build));

  type Sel = { t: 'core'; k: number } | { t: 'node'; i: number };
  /** classe consultée avant d'être choisie (null : écran de choix) */
  let browse = $state<number | null>(null);
  const vc = $derived(build.cls >= 0 ? build.cls : browse);
  let sel = $state<Sel>({ t: 'node', i: 0 });
  let confirmReset = $state(false);
  let showSkins = $state(false);

  // ------------------------------------------------------------ géométrie (une seule classe)
  const RAD = Math.PI / 180;
  const pol = (r: number, deg: number): [number, number] => [r * Math.cos(deg * RAD), r * Math.sin(deg * RAD)];
  const routeAngle = (j: number) => -90 + 120 * j;
  const STEP_R = [218, 298, 376, 452];
  function nodePos(i: number): [number, number] {
    if (i === 0) return [0, 0];
    const j = nodeRoute(i), k = nodeStep(i), a = routeAngle(j);
    if (k < 4) return pol(STEP_R[k], a);
    return pol(522, a + (k === 4 ? -13 : 13));
  }
  /** pastille de rang : sur le côté de la route */
  function pillOff(i: number, s: number): [number, number] {
    const a = (routeAngle(nodeRoute(i)) + 90) * RAD;
    return [Math.cos(a) * (s + 26), Math.sin(a) * (s + 26)];
  }
  const corePos = (k: number) => pol(140, routeAngle(Math.floor(k / 2)) + 60 + (k % 2 ? 24 : -24));
  const nodeSize = (n: TreeNode) => (n.kind === 'ult' ? 46 : n.kind === 'skill' ? 37 : n.kind === 'passive' ? 30 : 27);
  const EDGES: [number, number][] = Array.from({ length: ROUTE_COUNT }, (_, j) => {
    const n = (k: number) => routeNode(j, k);
    return [[0, n(0)], [n(0), n(1)], [n(1), n(2)], [n(2), n(3)], [n(3), n(4)], [n(3), n(5)]] as [number, number][];
  }).flat();
  const ROOT_ICON = ['strike', 'bulwark', 'bow', 'orb', 'skull', 'bomb'];
  const TREES = CLASSES.map((c) => classNodes(c));

  /** corps d'une icône au trait (sans son <svg>), pour la dessiner dans le SVG de l'arbre */
  const body = (svg: string) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const nodeGlyph = (n: TreeNode, c: number) =>
    body(nodeIcon(n.kind === 'root' ? ROOT_ICON[c] : n.kind === 'skill' || n.kind === 'ult' ? n.skill.icon : n.icon));

  // ------------------------------------------------------------ état des nœuds
  const rankOf = (c: number, i: number) => (build.cls === c ? build.r[i] : 0);
  /** route fermée : une autre a été choisie */
  const shutRoute = (j: number) => route >= 0 && route !== j;
  const edgeState = (c: number, a: number, b: number) =>
    rankOf(c, a) > 0 && rankOf(c, b) > 0 ? 'on' : rankOf(c, a) > 0 && nodeOpen(build, c, b) ? 'next' : 'off';
  const nodeTitle = (n: TreeNode) => (n.kind === 'skill' || n.kind === 'ult' ? n.skill.name : n.name);
  const skillOf = (n: TreeNode) => (n as { skill: ClassSkill }).skill;

  // ------------------------------------------------------------ détail du nœud sélectionné
  const fmt = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',');
  const skillMeta = (s: ClassSkill, slot: number) => `Emplacement ${slot + 1} · niveau ${SKILL_UNLOCK[slot]} du héros en partie · recharge ${s.cd} s`;
  const statLine = (c: (typeof CLASSES)[number]) =>
    `PV ${c.hp} · dégâts ${c.dmg[0]}–${c.dmg[1]} · ${c.range ? `portée ${fmt(c.range)}` : 'mêlée'} · ${c.dmgType === DmgType.Magic ? 'magique' : 'physique'} · armure ${Math.round(c.armor * 100)} %`;
  const info = $derived.by(() => {
    const ci = vc ?? 0;
    const c = CLASSES[ci];
    if (sel.t === 'core') {
      const n = CORE[sel.k];
      const r = build.core[sel.k];
      return {
        color: '#e8b931', kind: 'Fondamental', name: n.name, rank: r, ranks: CORE_RANKS, cost: CORE_COST,
        desc: `${STAT_LABEL[n.stat](n.per)} par rang.`, extra: r ? `Actuellement : ${STAT_LABEL[n.stat](n.per * r)}.` : '', path: '',
        owned: r >= CORE_RANKS, can: canBuyCore(sel.k),
        why: r >= CORE_RANKS ? '' : !active ? 'Choisissez d’abord la classe (au centre de l’arbre).' : left < CORE_COST ? 'Pas assez de points.' : '',
      };
    }
    const i = sel.i, n = TREES[ci][i];
    const r = rankOf(ci, i);
    const j = nodeRoute(i);
    const rt = j >= 0 ? c.routes[j] : null;
    let kind = '', name = '', desc = '', extra = '';
    if (n.kind === 'root') {
      kind = 'Classe'; name = c.name; desc = n.desc; extra = statLine(c);
    } else if (n.kind === 'stat') {
      kind = 'Statistique'; name = n.name; desc = `${STAT_LABEL[n.stat](n.per)} par rang.`;
      if (r) extra = `Actuellement : ${STAT_LABEL[n.stat](n.per * r)}.`;
    } else if (n.kind === 'passive') {
      kind = 'Passif'; name = n.name; desc = n.desc;
    } else if (n.kind === 'skill') {
      kind = 'Compétence de route'; name = n.skill.name; desc = n.skill.desc; extra = skillMeta(n.skill, 1);
    } else {
      kind = 'Ultime'; name = n.skill.name; desc = n.skill.desc; extra = skillMeta(n.skill, 2);
    }
    let why = '';
    if (r >= n.ranks) why = '';
    else if (j >= 0 && shutRoute(j)) why = `Vous suivez la route « ${c.routes[route].name} » : changez de classe ou de route pour celle-ci (gratuit).`;
    else if (!nodeOpen(build, ci, i)) why = `Prérequis : ${nodeReqs(i).map((q) => (q === 0 ? `la classe ${c.name}` : `« ${nodeTitle(TREES[ci][q])} »`)).join(', ')}.`;
    else if (left < n.cost) why = 'Pas assez de points.';
    return {
      color: hex(c.color), kind: `${c.name} · ${kind}`, name, rank: r, ranks: n.ranks, cost: n.cost, desc, extra,
      path: rt ? `Route ${rt.name} : ${rt.desc}` : '', owned: r >= n.ranks, can: canBuyNode(ci, i), why,
    };
  });

  // ------------------------------------------------------------ actions
  function sync() {
    // dans un salon : le serveur doit connaître le nouvel arbre
    if (ui.room && !ui.room.inGame) net.send({ t: 'meta', ...loadout() });
  }
  function buy() {
    if (vc === null) return;
    const ok = sel.t === 'core' ? buyCore(sel.k) : buyNode(vc, sel.i);
    if (ok) sync();
  }
  function open(c: number) {
    browse = c;
    sel = { t: 'node', i: 0 };
  }
  /** changer de classe ou de route : tout est rendu (après confirmation) */
  function reset() {
    if (!confirmReset) { confirmReset = true; setTimeout(() => (confirmReset = false), 2500); return; }
    confirmReset = false;
    const was = build.cls;
    resetHero();
    sync();
    browse = was >= 0 ? was : null;
    sel = { t: 'node', i: 0 };
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
  const routeSkills = (c: (typeof CLASSES)[number]) => c.routes.map((r) => ({ name: r.name, skill: skillOf(r.nodes[0]), ult: skillOf(r.nodes[5]) }));

  // ------------------------------------------------------------ zoom (écrans étroits)
  let view = $state<HTMLDivElement>();
  let zoom = $state(1);
  let narrow = $state(false);
  function setZoom(z: number) {
    if (!view) return;
    const v = view;
    const cx = (v.scrollLeft + v.clientWidth / 2) / v.scrollWidth, cy = (v.scrollTop + v.clientHeight / 2) / v.scrollHeight;
    zoom = Math.max(1, Math.min(3, z));
    requestAnimationFrame(() => {
      v.scrollLeft = cx * v.scrollWidth - v.clientWidth / 2;
      v.scrollTop = cy * v.scrollHeight - v.clientHeight / 2;
    });
  }
  onMount(() => {
    narrow = window.innerWidth < 620;
  });
  $effect(() => {
    // à l'ouverture d'un arbre sur petit écran : zoomé, centré sur la vocation
    if (!view || !narrow) return;
    const v = view;
    zoom = 1.6;
    requestAnimationFrame(() => {
      v.scrollLeft = (v.scrollWidth - v.clientWidth) / 2;
      v.scrollTop = (v.scrollHeight - v.clientHeight) / 2;
    });
  });
</script>

<div class="overlay-bg">
  <div class="panel box">
    <div class="head">
      <h2>Arbre du héros</h2>
      {#if vc !== null && build.cls < 0}<button class="btn small" onclick={() => (browse = null)}>← Classes</button>{/if}
      <div class="wallet" title="Points de héros disponibles (gagnés au total : {total})">
        <b>{left}</b><span>point{left > 1 ? 's' : ''} sur {total}</span>
      </div>
      <button class="btn small" onclick={() => (ui.overlay = null)}>Fermer</button>
    </div>

    {#if vc === null}
      <!-- choix de la classe -->
      <div class="pick scroll">
        <p class="lead">
          Votre héros est encore un <b>Aventurier</b>. Choisissez <b>une classe</b> et spécialisez-le : chaque classe a sa propre arme, ses statistiques,
          sa compétence, et <b>trois routes</b> au choix (une compétence, des passifs et un ultime chacune). Touchez une classe pour voir son arbre.
        </p>
        <div class="cards">
          {#each CLASSES as c, ci}
            <button class="card" style="--cc:{hex(c.color)}" onclick={() => open(ci)}>
              <div class="ch">
                <span class="ci">{@html nodeIcon(ROOT_ICON[ci])}</span>
                <div><b>{c.name}</b><small>{c.role}</small></div>
              </div>
              <p class="cd">{c.desc}</p>
              <p class="cs">{statLine(c)}</p>
              <div class="cskill"><span class="ico"><Ico k={skillIcon(c.a).k} fb={skillIcon(c.a).fb} /></span><span><b>{c.a.name}</b> · compétence de classe</span></div>
              <ul class="croutes">
                {#each routeSkills(c) as r}
                  <li><b>{r.name}</b><span>{r.skill.name} · ultime {r.ult.name}</span></li>
                {/each}
              </ul>
            </button>
          {/each}
        </div>
      </div>
    {:else}
    {@const ci = vc}
    {@const c = CLASSES[ci]}
    {@const col = hex(c.color)}
    <div class="main">
      <div class="view" bind:this={view}>
        <svg viewBox="-610 -610 1220 1220" style="--z:{zoom}" role="img" aria-label="Arbre de compétences : {c.name}">
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
            <clipPath id="ht-hub"><circle r="70" /></clipPath>
          </defs>
          <rect x="-610" y="-610" width="1220" height="1220" fill="url(#ht-bg)" />
          {#each [140, ...STEP_R, 522] as r}<circle {r} class="ring" />{/each}

          <!-- liens : vocation → fondamentaux -->
          {#each CORE as _, k}
            {@const p = corePos(k)}
            <line x1="0" y1="0" x2={p[0]} y2={p[1]} class="edge" class:on={build.core[k] > 0} style="--ec:#e8b931" />
          {/each}

          <!-- routes -->
          {#each c.routes as rt, j}
            {@const lp = pol(585, routeAngle(j))}
            <g class="branch" class:locked={shutRoute(j)} class:chosen={route === j} style="--cc:{col}">
              {#each EDGES.filter(([, b]) => nodeRoute(b) === j) as [a, b]}
                {@const pa = nodePos(a)}
                {@const pb = nodePos(b)}
                <line x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} class="edge {edgeState(ci, a, b)}" style="--ec:{col}" />
              {/each}
              {#each Array.from({ length: ROUTE_LEN }, (_, k) => routeNode(j, k)) as i}
                {@const n = TREES[ci][i]}
                {@const [x, y] = nodePos(i)}
                {@const s = nodeSize(n)}
                {@const r = rankOf(ci, i)}
                {@const open = nodeOpen(build, ci, i)}
                {@const on = sel.t === 'node' && sel.i === i}
                <g
                  class="node {n.kind}"
                  class:owned={r > 0}
                  class:full={r >= n.ranks}
                  class:open={open && build.cls === ci}
                  class:afford={open && build.cls === ci && left >= n.cost}
                  class:shut={shutRoute(j)}
                  transform="translate({x.toFixed(1)},{y.toFixed(1)})"
                  role="button"
                  tabindex="0"
                  aria-label={nodeTitle(n)}
                  onclick={() => (sel = { t: 'node', i })}
                  ondblclick={() => quick({ t: 'node', i })}
                  onkeydown={(e) => e.key === 'Enter' && (sel = { t: 'node', i })}
                >
                  <title>{nodeTitle(n)}</title>
                  {#if on}<circle r={s + 10} class="halo" />{/if}
                  {#if n.kind === 'passive'}
                    <rect x={-s * 0.85} y={-s * 0.85} width={s * 1.7} height={s * 1.7} rx="5" transform="rotate(45)" class="disc" />
                  {:else}
                    <circle r={s} class="disc" />
                    {#if n.kind === 'skill' || n.kind === 'ult'}<circle r={s - 5} class="inner" />{/if}
                  {/if}
                  <g class="glyph" transform="translate({-s * 0.6},{-s * 0.6}) scale({(s * 1.2) / 24})">{@html nodeGlyph(n, ci)}</g>
                  {#if n.ranks > 1}
                    {@const po = pillOff(i, s)}
                    <g transform="translate({po[0].toFixed(1)},{po[1].toFixed(1)})"><rect x="-20" y="-11" width="40" height="21" rx="10.5" class="pill" /><text y="5" class="rk">{r}/{n.ranks}</text></g>
                  {/if}
                  {#if open && build.cls === ci && r < n.ranks}
                    <g transform="translate({s * 0.85},{-s * 0.85})"><circle r="12" class="cost" /><text y="5" class="ct">{n.cost}</text></g>
                  {/if}
                </g>
              {/each}
              <text x={lp[0]} y={lp[1] + 7} class="cname">{rt.name}</text>
            </g>
          {/each}

          <!-- fondamentaux -->
          {#each CORE as n, k}
            {@const [x, y] = corePos(k)}
            {@const r = build.core[k]}
            {@const on = sel.t === 'core' && sel.k === k}
            {@const can = coreOpen(build, k)}
            <g
              class="node core"
              class:owned={r > 0}
              class:full={r >= CORE_RANKS}
              class:open={can}
              class:afford={can && left >= CORE_COST}
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
              {#if on}<circle r="33" class="halo" />{/if}
              <circle r="23" class="disc" />
              <g class="glyph" transform="translate(-14,-14) scale(1.17)">{@html body(nodeIcon(n.icon))}</g>
              <g transform="translate(0,36)"><rect x="-17" y="-10" width="34" height="19" rx="9.5" class="pill" /><text y="4.5" class="rk">{r}/{CORE_RANKS}</text></g>
            </g>
          {/each}

          <!-- vocation : le portrait au centre -->
          <g
            class="hub node"
            class:owned={rankOf(ci, 0) > 0}
            class:afford={nodeOpen(build, ci, 0) && left >= 1}
            style="--cc:{col}"
            role="button"
            tabindex="0"
            aria-label="Classe {c.name}"
            onclick={() => (sel = { t: 'node', i: 0 })}
            ondblclick={() => quick({ t: 'node', i: 0 })}
            onkeydown={(e) => e.key === 'Enter' && (sel = { t: 'node', i: 0 })}
          >
            {#if sel.t === 'node' && sel.i === 0}<circle r="90" class="halo" />{/if}
            <circle r="76" class="hubring" />
            {#if ui.portraits[ui.hero]}<image href={ui.portraits[ui.hero]} x="-70" y="-70" width="140" height="140" clip-path="url(#ht-hub)" class:ghost={!rankOf(ci, 0)} />{/if}
            <g transform="translate(0,94)"><rect x="-70" y="-17" width="140" height="30" rx="15" class="pill hubname" /><text y="5" class="hn">{c.name}</text></g>
            {#if nodeOpen(build, ci, 0)}
              <g transform="translate(58,-58)"><circle r="14" class="cost" /><text y="5.5" class="ct">1</text></g>
            {/if}
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
              <span class="ok">Acquis</span>
            {:else}
              {#if info.why}<span class="why">{info.why}</span>{/if}
              {#if info.can || info.why.startsWith('Pas assez')}
                <button class="btn gold" disabled={!info.can} onclick={buy}>
                  {sel.t === 'node' && sel.i === 0 ? `Devenir ${c.name.toLowerCase()}` : 'Apprendre'} · {info.cost} pt{info.cost > 1 ? 's' : ''}
                </button>
              {/if}
            {/if}
          </div>
        </section>

        <section class="me" style="--bc:{hex(active ? active.color : AVENTURIER.color)}">
          <div class="who">
            {#if ui.portraits[ui.hero]}<img src={ui.portraits[ui.hero]} alt="" />{/if}
            <div>
              <b>{HEROES[ui.hero].name}</b>
              <span>{active ? `${active.name}${route >= 0 ? ` · ${active.routes[route].name}` : ''}` : `${AVENTURIER.name} · ${AVENTURIER.role}`}</span>
            </div>
            <button class="btn small" onclick={() => (showSkins = !showSkins)}>Apparence</button>
          </div>
          {#if showSkins}<HeroPicker value={ui.hero} onpick={pickSkin} compact />{/if}
          <div class="sks">
            {#each kit as s, k}
              <span class="sk" title="{s.name} : {s.desc}">
                <Ico k={skillIcon(s).k} fb={skillIcon(s).fb} />
                <small>{s.short}</small>
                <em>{k === 2 ? 'Ultime' : `Niv. ${SKILL_UNLOCK[k]}`}</em>
              </span>
            {/each}
          </div>
        </section>

        <p class="help">
          Une seule <b>route</b> par classe : la première compétence de route apprise la fixe. L’<b>ultime</b> et le dernier passif s’ouvrent après
          la 2e statistique. Les <b>fondamentaux</b> (autour du portrait) renforcent le héros quelle que soit la route.<br />
          En partie : la compétence de classe, celle de la route et l’ultime. Double-clic sur un nœud pour l’apprendre.
        </p>
        {#if build.cls >= 0}
          <button class="btn small" class:red={confirmReset} onclick={reset}>{confirmReset ? 'Confirmer ? Tous les points sont rendus' : 'Changer de classe ou de route (gratuit)'}</button>
        {:else}
          <button class="btn small" onclick={() => (browse = null)}>← Toutes les classes</button>
        {/if}
      </aside>
    </div>
    {/if}
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
  .branch.locked { opacity: 0.38; }
  .cname { fill: #f3ead6; font-family: var(--font-display); font-size: 26px; text-anchor: middle; paint-order: stroke; stroke: #0b0f19; stroke-width: 5px; pointer-events: none; }

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
  .hubring { fill: #1d2639; stroke: #3a4560; stroke-width: 6; }
  .hub.afford .hubring { stroke: #ffd24a; animation: pulse 1.8s ease-in-out infinite; }
  .hub.owned .hubring { stroke: var(--cc); filter: url(#ht-glow); }
  .hub image.ghost { opacity: 0.45; filter: grayscale(0.7); }
  .hubname { stroke: var(--cc); }
  .hn { fill: #f3ead6; font-family: var(--font-display); font-size: 21px; text-anchor: middle; pointer-events: none; }
  .branch.chosen .cname { fill: #ffd24a; }

  /* choix de la classe */
  .pick { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; padding-right: 4px; }
  .lead { margin: 0; font-weight: 700; line-height: 1.4; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 12px; }
  .card { all: unset; box-sizing: border-box; cursor: pointer; display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; background: var(--panel-hi); border: 2.5px solid var(--ink); border-top: 10px solid var(--cc); border-radius: var(--r-sm); box-shadow: 0 4px 0 var(--ink); transition: transform 0.12s; }
  .card:hover, .card:focus-visible { transform: translateY(-3px); }
  .card:focus-visible { outline: 3px solid var(--cc); outline-offset: 2px; }
  .ch { display: flex; align-items: center; gap: 10px; }
  .ch div { display: flex; flex-direction: column; }
  .ch b { font-family: var(--font-display); font-weight: 400; font-size: 1.5em; line-height: 1; color: var(--cc); -webkit-text-stroke: 0.5px var(--ink); }
  .ch small { font-weight: 800; color: var(--muted); }
  .ci { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--cc); border: 2px solid var(--ink); color: #fff; }
  .ci :global(svg) { width: 26px; height: 26px; }
  .cd { margin: 0; font-weight: 700; font-size: 0.9em; color: var(--muted); line-height: 1.3; }
  .cs { margin: 0; font-size: 0.78em; font-weight: 900; }
  .cskill { display: flex; align-items: center; gap: 8px; font-size: 0.86em; font-weight: 700; }
  .cskill .ico :global(.icon) { width: 32px; height: 32px; margin: 0; border-radius: 50%; background: var(--ink); }
  .cskill .ico :global(svg.icon) { padding: 7px; color: #fff; box-sizing: border-box; }
  .croutes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
  .croutes li { display: flex; flex-direction: column; padding: 3px 8px; border-left: 4px solid var(--cc); background: var(--panel); border-radius: 4px; font-size: 0.82em; font-weight: 700; }
  .croutes b { font-weight: 900; }
  .croutes span { color: var(--muted); }

  .side { min-height: 0; display: flex; flex-direction: column; gap: 10px; padding-right: 4px; }
  .detail, .me { padding: 10px 12px; background: var(--panel-hi); border: 2.5px solid var(--ink); border-left: 10px solid var(--bc); border-radius: var(--r-sm); box-shadow: 0 3px 0 var(--ink); display: flex; flex-direction: column; gap: 4px; }
  .kind { font-size: 0.78em; font-weight: 900; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .nm { font-family: var(--font-display); font-weight: 400; font-size: 1.45em; line-height: 1.05; }
  .rank { font-weight: 900; font-size: 0.85em; }
  .detail p { margin: 0; font-weight: 700; line-height: 1.35; }
  .detail .extra { font-size: 0.85em; color: var(--muted); }
  .detail .path { font-size: 0.85em; color: var(--muted); font-style: italic; }
  .act { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
  .why { font-weight: 800; color: var(--muted); font-size: 0.88em; line-height: 1.3; }
  .ok { font-weight: 900; color: var(--good); }
  .who { display: flex; align-items: center; gap: 10px; }
  .who img { width: 46px; height: 46px; border-radius: 50%; border: 2px solid var(--ink); background: linear-gradient(180deg, #78acf7 0 50%, #3f7ee0 50%); }
  .who div { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .who b { font-family: var(--font-display); font-weight: 400; font-size: 1.2em; }
  .who span { font-size: 0.85em; font-weight: 800; color: var(--muted); }
  .sks { display: flex; gap: 10px; margin-top: 4px; }
  .sk { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 60px; }
  .sk :global(.icon) { width: 44px; height: 44px; margin: 0; border-radius: 50%; background: var(--ink); }
  .sk :global(svg.icon) { padding: 10px; color: #fff; box-sizing: border-box; }
  .sk small { font-size: 0.72em; font-weight: 900; text-align: center; line-height: 1.1; }
  .sk em { font-style: normal; font-size: 0.66em; font-weight: 800; color: var(--muted); }
  .help { margin: 0; font-size: 0.82em; font-weight: 700; color: var(--muted); line-height: 1.4; }

  @media (max-width: 860px) {
    .box { height: 100%; }
    .main { grid-template-columns: 1fr; grid-template-rows: minmax(260px, 1fr) auto; }
    .side { max-height: 44vh; }
  }
</style>
