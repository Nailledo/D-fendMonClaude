<script lang="ts">
  import Ico from './Ico.svelte';
  import { CLASSES, COMMON_COST, COMMON_DMG, COMMON_HP, COMMON_RANKS, NODE_COST, chainNodes, classOf, type ClassSkill } from '@dfend/shared';
  import { setHero, ui } from '../state.svelte';
  import { buyCommon, buyNode, canBuyCommon, canBuyNode, heroBuild, heroPointsLeft, heroPointsTotal, loadout, resetHero } from '../meta';
  import { net } from '../net/Net';
  import HeroPicker from './HeroPicker.svelte';
  import { hex, skillIcon } from './classIcons';
  import { ICON, SKILL_ICON } from './icons';

  /** Arbre du héros : apparence, puis une chaîne de cinq nœuds par classe et l'entraînement commun. */
  const build = $derived(heroBuild());
  const left = $derived(heroPointsLeft());
  const total = $derived(heroPointsTotal());
  const active = $derived(classOf(build));
  const STYLE_ICON = ['', SKILL_ICON.strike, ICON.bow, SKILL_ICON.hammer, ICON.orb];
  /** nœud sélectionné : [classe (0 = entraînement), rang] */
  const b0 = heroBuild();
  let sel = $state<[number, number]>([b0.cls || 1, Math.min(4, b0.nodes)]);
  let confirmReset = $state(false);

  const owned = (c: number, k: number) => (c === 0 ? build.common > k : build.cls === c && build.nodes > k);
  const isNext = (c: number, k: number) => (c === 0 ? build.common === k : (build.cls === c || build.nodes === 0) && (build.cls === c ? build.nodes : 0) === k);
  const locked = (c: number) => c !== 0 && build.nodes > 0 && build.cls !== c;

  const selInfo = $derived.by(() => {
    const [c, k] = sel;
    if (c === 0) return { name: `Entraînement ${k + 1}`, desc: `+${Math.round(COMMON_HP * 100)} % de PV et +${Math.round(COMMON_DMG * 100)} % de dégâts, quelle que soit la classe.`, cost: COMMON_COST, where: 'Commun' };
    const n = chainNodes(CLASSES[c])[k];
    return { name: n.name, desc: n.desc, cost: n.cost, where: `${CLASSES[c].name} · nœud ${k + 1}` };
  });

  function sync() {
    // dans un salon : le serveur doit connaître le nouvel arbre
    if (ui.room && !ui.room.inGame) net.send({ t: 'meta', ...loadout() });
  }
  function buy() {
    const [c] = sel;
    if (c === 0 ? buyCommon() : buyNode(c)) {
      sync();
      const b = heroBuild();
      sel = [c, Math.min(c === 0 ? COMMON_RANKS - 1 : 4, c === 0 ? b.common : b.nodes)];
    }
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
  const canBuySel = $derived(sel[0] === 0 ? canBuyCommon() : canBuyNode(sel[0]));
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
    <div class="body scroll">
      <div class="top">
        <section class="skin">
          <h3>Apparence</h3>
          <HeroPicker value={ui.hero} onpick={pickSkin} compact />
        </section>
        <section class="now" style="--cc:{hex(active.color)}">
          <h3>Classe actuelle</h3>
          <b class="cn">{active.name}</b>
          <span class="role">{active.role}</span>
          <div class="sks">
            {#each [0, 1, 2] as i}
              {@const s = (i < 2 ? (build.nodes >= [1, 3][i] && build.cls ? active.skills[i] : CLASSES[0].skills[i]) : build.nodes >= 5 ? active.skills[2] : null) as ClassSkill | null}
              <span class="sk" class:empty={!s} title={s ? `${s.name} : ${s.desc}` : 'Ultime : dernier nœud d’une classe'}>
                {#if s}<Ico k={skillIcon(s).k} fb={skillIcon(s).fb} />{:else}?{/if}
              </span>
            {/each}
          </div>
        </section>
      </div>

      <div class="tree">
        {#each CLASSES as c, ci}
          {#if ci > 0}
            {@const nodes = chainNodes(c)}
            <section class="branch" class:locked={locked(ci)} class:mine={build.cls === ci && build.nodes > 0} style="--bc:{hex(c.color)}">
              <header><i>{@html STYLE_ICON[c.style]}</i><b>{c.name}</b><span class="rk">{build.cls === ci ? build.nodes : 0}/5</span></header>
              <p class="cdesc">{c.role}</p>
              <ol>
                {#each nodes as n, k}
                  {@const o = owned(ci, k)}
                  {@const nx = isNext(ci, k) && !locked(ci)}
                  <li>
                    <button class="node {n.kind}" class:owned={o} class:next={nx} class:afford={nx && left >= n.cost} class:on={sel[0] === ci && sel[1] === k} onclick={() => (sel = [ci, k])}>
                      <span class="dot">{o ? '✓' : k + 1}</span>
                      <span class="nm">{n.kind === 'vocation' ? 'Vocation' : n.name}</span>
                      {#if !o}<span class="cost">{n.cost}</span>{/if}
                    </button>
                  </li>
                {/each}
              </ol>
            </section>
          {/if}
        {/each}
        <section class="branch common" style="--bc:#c9a227">
          <header><i>{@html ICON.star}</i><b>Entraînement</b><span class="rk">{build.common}/{COMMON_RANKS}</span></header>
          <p class="cdesc">Pour toutes les classes</p>
          <ol>
            {#each Array(COMMON_RANKS) as _, k}
              {@const o = owned(0, k)}
              {@const nx = isNext(0, k)}
              <li>
                <button class="node" class:owned={o} class:next={nx} class:afford={nx && left >= COMMON_COST} class:on={sel[0] === 0 && sel[1] === k} onclick={() => (sel = [0, k])}>
                  <span class="dot">{o ? '✓' : k + 1}</span>
                  <span class="nm">+{Math.round(COMMON_HP * 100)} % PV, +{Math.round(COMMON_DMG * 100)} % dégâts</span>
                  {#if !o}<span class="cost">{COMMON_COST}</span>{/if}
                </button>
              </li>
            {/each}
          </ol>
        </section>
      </div>
    </div>

    <div class="detail" style="--bc:{sel[0] ? hex(CLASSES[sel[0]].color) : '#c9a227'}">
      <div class="dt">
        <b>{selInfo.name}</b><span class="where">{selInfo.where}</span>
        <p>{selInfo.desc}</p>
      </div>
      {#if owned(sel[0], sel[1])}
        <span class="tag ok">Acquis</span>
      {:else if locked(sel[0])}
        <span class="tag">Une seule classe à la fois : réinitialisez l’arbre pour en changer</span>
      {:else if isNext(sel[0], sel[1])}
        <button class="btn gold" disabled={!canBuySel} onclick={buy}>Apprendre · {selInfo.cost} pt{selInfo.cost > 1 ? 's' : ''}</button>
      {:else}
        <span class="tag">Apprenez d’abord les nœuds précédents</span>
      {/if}
    </div>
    <div class="foot">
      <span>Un point par niveau de l’histoire réussi, un de plus s’il l’est en Vétéran ou en Cauchemar. Les compétences se débloquent en partie aux niveaux 1, 3 et 5 du héros.</span>
      <button class="btn small" class:red={confirmReset} disabled={build.nodes === 0 && build.common === 0} onclick={reset}>{confirmReset ? 'Confirmer ?' : 'Réinitialiser (gratuit)'}</button>
    </div>
  </div>
</div>

<style>
  .box { width: min(1120px, 100%); height: min(92vh, 900px); display: flex; flex-direction: column; gap: 12px; }
  .head { display: flex; align-items: center; gap: 12px; }
  h2 { margin: 0; font-size: 2em; flex: 1; }
  h3 { margin: 0 0 6px; font-size: 1.05em; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; font-family: inherit; font-weight: 900; }
  .wallet { display: flex; align-items: baseline; gap: 6px; padding: 4px 14px; background: var(--panel-hi); border: 2.5px solid var(--ink); border-radius: 99px; box-shadow: 0 3px 0 var(--ink); }
  .wallet b { font-family: var(--font-display); font-weight: 400; font-size: 1.5em; line-height: 1; font-variant-numeric: tabular-nums; }
  .wallet span { font-weight: 800; color: var(--muted); font-size: 0.9em; }
  .body { flex: 1; min-height: 0; padding: 2px 6px 8px 2px; display: flex; flex-direction: column; gap: 12px; }
  .top { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 12px; }
  .top section { padding: 10px 12px; background: var(--panel-hi); border: 2.5px solid var(--ink); border-radius: var(--r-sm); box-shadow: 0 3px 0 var(--ink); }
  .now { border-left: 10px solid var(--cc) !important; display: flex; flex-direction: column; }
  .cn { font-family: var(--font-display); font-weight: 400; font-size: 1.6em; line-height: 1; }
  .role { font-weight: 800; color: var(--muted); font-size: 0.9em; }
  .sks { display: flex; gap: 8px; margin-top: 8px; }
  .sk { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; background: var(--ink); overflow: hidden; color: #fff; font-weight: 900; }
  .sk.empty { background: #d8c8a4; color: var(--muted); border: 2px dashed var(--ink); }
  .sk :global(.icon) { width: 44px; height: 44px; margin: 0; }
  .sk :global(svg.icon) { width: 26px; height: 26px; }

  .tree { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 10px; }
  .branch { display: flex; flex-direction: column; gap: 6px; padding: 10px 8px 12px; background: var(--panel-hi); border: 2.5px solid var(--ink); border-radius: var(--r-sm); box-shadow: 0 3px 0 var(--ink); border-top: 8px solid var(--bc); }
  .branch.mine { background: #fff; box-shadow: 0 0 0 3px var(--bc), 0 3px 0 var(--ink); }
  .branch.locked { opacity: 0.55; }
  .branch header { display: flex; align-items: center; gap: 6px; }
  .branch header i { width: 30px; height: 30px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--bc); border: 2px solid var(--ink); color: #fff; }
  .branch header i :global(.icon) { width: 18px; height: 18px; }
  .branch header b { flex: 1; font-family: var(--font-display); font-weight: 400; font-size: 1.15em; }
  .cdesc { margin: -2px 0 2px; font-size: 0.8em; font-weight: 800; color: var(--muted); }
  .rk { font-weight: 900; font-size: 0.82em; color: var(--muted); font-variant-numeric: tabular-nums; }
  ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; position: relative; }
  ol::before { content: ''; position: absolute; left: 15px; top: 14px; bottom: 14px; width: 4px; background: var(--ink-soft); border-radius: 2px; }
  .node { position: relative; width: 100%; display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 6px; padding: 4px 6px 4px 1px; text-align: left; cursor: pointer;
    background: none; border: 2px solid transparent; border-radius: 10px; color: var(--text); font: inherit; }
  .node:hover { background: rgba(255, 255, 255, 0.7); }
  .node.on { border-color: var(--ink); background: #fff; }
  .dot { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; border: 2.5px solid var(--ink); background: #e8d9b8; font-weight: 900; font-size: 0.85em; color: var(--muted); position: relative; z-index: 1; }
  .node.ult .dot { border-radius: 8px; border-color: var(--gold-lo, var(--ink)); box-shadow: inset 0 0 0 2px var(--gold-fill); }
  .node.skill .dot, .node.vocation .dot { border-radius: 8px; }
  .owned .dot { background: var(--bc); color: #fff; }
  .next .dot { background: #fff; color: var(--ink); }
  .next.afford .dot { box-shadow: 0 0 0 3px var(--gold-fill); animation: glow 1.8s ease-in-out infinite; }
  @keyframes glow { 50% { box-shadow: 0 0 0 5px rgba(255, 197, 58, 0.45); } }
  .nm { font-weight: 800; font-size: 0.84em; line-height: 1.2; }
  .node:not(.owned):not(.next) .nm { color: var(--faint); }
  .cost { font-weight: 900; font-size: 0.85em; color: var(--gold); font-variant-numeric: tabular-nums; min-width: 22px; text-align: center; border: 2px solid var(--ink); border-radius: 99px; background: var(--gold-fill); color: var(--ink); }

  .detail { display: flex; align-items: center; gap: 14px; padding: 10px 14px; background: var(--panel-hi); border: 2.5px solid var(--ink); border-left: 10px solid var(--bc); border-radius: var(--r-sm); box-shadow: 0 3px 0 var(--ink); }
  .dt { flex: 1; min-width: 0; }
  .dt b { font-family: var(--font-display); font-weight: 400; font-size: 1.25em; }
  .where { margin-left: 8px; font-size: 0.8em; font-weight: 800; color: var(--muted); }
  .dt p { margin: 2px 0 0; font-weight: 700; }
  .tag { font-weight: 900; color: var(--muted); font-size: 0.9em; text-align: right; max-width: 260px; }
  .tag.ok { color: var(--good); }
  .foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-weight: 700; color: var(--muted); font-size: 0.86em; }
  @media (max-width: 640px) {
    .top { grid-template-columns: 1fr; }
    .detail { flex-direction: column; align-items: stretch; }
    .tag { text-align: left; max-width: none; }
    .foot { flex-direction: column; align-items: stretch; }
  }
</style>
