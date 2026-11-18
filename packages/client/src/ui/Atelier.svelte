<script lang="ts">
  import Ico from './Ico.svelte';
  import { ITEMS, ITEM_MAX, RANK_COST, TREE, TREE_RANKS, treeCost } from '@dfend/shared';
  import { audio } from '../audio/Audio';
  import { availableStars, buyItem, buyRank, canBuyItem, earnedStars, rank, resetTree, stock } from '../meta';
  import { progress, toast, ui } from '../state.svelte';
  import { BRANCH_ICON, ICON, ITEM_ICON } from './icons';

  let tab = $state<'tree' | 'shop'>('tree');
  // nœud affiché dans le panneau de détail (branche, rang)
  let sel = $state<[number, number]>([0, Math.min(rank(0), TREE_RANKS - 1)]);
  const stars = $derived(availableStars());
  const earned = $derived(earnedStars());
  const invested = $derived(treeCost(progress.tree));
  const selRank = $derived(rank(sel[0]));
  const selNode = $derived(TREE[sel[0]].ranks[sel[1]]);
  const selState = $derived(sel[1] < selRank ? 'owned' : sel[1] === selRank ? 'next' : 'locked');
  let confirmReset = $state(false);

  function pick(b: number, k: number) {
    audio.play('click');
    sel = [b, k];
  }
  function buy() {
    const [b] = sel;
    if (!buyRank(b)) { audio.play('deny'); return; }
    audio.play('upgrade');
    // le rang suivant de la branche devient la sélection
    sel = [b, Math.min(rank(b), TREE_RANKS - 1)];
  }
  function reset() {
    if (!confirmReset) { confirmReset = true; setTimeout(() => (confirmReset = false), 3000); return; }
    confirmReset = false;
    resetTree();
    audio.play('sell');
    toast(`Arbre réinitialisé : ${invested} étoile${invested > 1 ? 's' : ''} rendue${invested > 1 ? 's' : ''}.`, 'good');
  }
  function shop(i: number) {
    if (!buyItem(i)) { audio.play('deny'); return; }
    audio.play('build');
  }
</script>

<div class="overlay-bg">
  <div class="panel box">
    <div class="head">
      <h2>{@html ICON.tree} Atelier</h2>
      <div class="wallet" title="Étoiles disponibles (gagnées au total : {earned})">
        <Ico k="star" fb={ICON.star} /><b>{stars}</b><span>disponible{stars > 1 ? 's' : ''}</span>
      </div>
      <button class="btn small" onclick={() => (ui.overlay = null)}>Fermer</button>
    </div>
    <div class="seg">
      <button class:on={tab === 'tree'} onclick={() => (tab = 'tree')}>Compétences</button>
      <button class:on={tab === 'shop'} onclick={() => (tab = 'shop')}>Boutique</button>
    </div>

    <div class="body scroll">
      {#if tab === 'tree'}
        <div class="tree">
          {#each TREE as br, b}
            {@const r = rank(b)}
            <section class="branch" style="--bc:{br.color}">
              <header><i>{@html BRANCH_ICON[b]}</i><b>{br.name}</b><span class="rk">{r}/{TREE_RANKS}</span></header>
              <ol>
                {#each br.ranks as node, k}
                  {@const owned = k < r}
                  {@const next = k === r}
                  <li>
                    <button class="node" class:owned class:next class:afford={next && stars >= RANK_COST[k]} class:on={sel[0] === b && sel[1] === k}
                      onclick={() => pick(b, k)} aria-label="{br.name}, rang {k + 1} : {node.name}">
                      <span class="dot">{owned ? '✓' : k + 1}</span>
                      <span class="nm">{node.name}</span>
                      {#if !owned}<span class="cost"><Ico k="star" fb={ICON.star} />{RANK_COST[k]}</span>{/if}
                    </button>
                  </li>
                {/each}
              </ol>
            </section>
          {/each}
        </div>
      {:else}
        <div class="shop">
          {#each ITEMS as it, i}
            {@const n = stock(i)}
            <div class="item">
              <span class="ii">{@html ITEM_ICON[i]}</span>
              <b>{it.name}</b>
              <p>{it.desc}</p>
              <span class="have">En réserve : <b>{n}</b> / {ITEM_MAX}</span>
              <button class="btn gold" disabled={!canBuyItem(i)} onclick={() => shop(i)}>
                Acheter · <Ico k="star" fb={ICON.star} />{it.price}
              </button>
            </div>
          {/each}
        </div>
        <p class="note">Les objets se lancent en partie depuis la barre des sorts ; un objet utilisé est consommé. Les étoiles dépensées en boutique ne sont pas rendues.</p>
      {/if}
    </div>

    {#if tab === 'tree'}
      <div class="detail" style="--bc:{TREE[sel[0]].color}">
        <div class="dt">
          <b>{selNode.name}</b><span class="where">{TREE[sel[0]].name} · rang {sel[1] + 1}</span>
          <p>{selNode.desc}</p>
        </div>
        {#if selState === 'owned'}
          <span class="tag ok">Acquis</span>
        {:else if selState === 'next'}
          <button class="btn gold" disabled={stars < RANK_COST[sel[1]]} onclick={buy}>Apprendre · <Ico k="star" fb={ICON.star} />{RANK_COST[sel[1]]}</button>
        {:else}
          <span class="tag">Apprenez d’abord le rang {selRank + 1}</span>
        {/if}
      </div>
      <div class="foot">
        <span>Étoiles investies : <b>{invested}</b> · gagnées au total : <b>{earned}</b></span>
        <button class="btn small" class:red={confirmReset} disabled={invested === 0} onclick={reset}>{confirmReset ? 'Confirmer ?' : 'Réinitialiser l’arbre'}</button>
      </div>
    {/if}
    <p class="how">Gagnez des étoiles en finissant les niveaux de l’histoire (jusqu’à 3 par niveau et par difficulté), en survie (1 toutes les 5 vagues) et en rejouant un niveau déjà parfait (+1 par victoire à 3 étoiles).</p>
  </div>
</div>

<style>
  .box { width: min(1080px, 100%); height: min(90vh, 860px); display: flex; flex-direction: column; gap: 12px; }
  .head { display: flex; align-items: center; gap: 12px; }
  h2 { margin: 0; font-size: 2em; display: flex; align-items: center; gap: 10px; flex: 1; }
  h2 :global(.icon) { width: 30px; height: 30px; }
  .wallet { display: flex; align-items: center; gap: 6px; padding: 4px 14px 4px 8px; background: var(--panel-hi); border: 2.5px solid var(--ink); border-radius: 99px; box-shadow: 0 3px 0 var(--ink); }
  .wallet :global(.icon) { width: 26px; height: 26px; }
  .wallet b { font-family: var(--font-display); font-weight: 400; font-size: 1.5em; line-height: 1; font-variant-numeric: tabular-nums; }
  .wallet span { font-weight: 800; color: var(--muted); font-size: 0.9em; }
  .body { flex: 1; min-height: 0; padding: 2px 6px 8px 2px; }

  /* ---- arbre : une colonne par branche, rangs reliés de haut en bas ---- */
  .tree { display: grid; grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); gap: 10px; }
  .branch { display: flex; flex-direction: column; gap: 8px; padding: 10px 8px 12px; background: var(--panel-hi); border: 2.5px solid var(--ink); border-radius: var(--r-sm); box-shadow: 0 3px 0 var(--ink); border-top: 8px solid var(--bc); }
  .branch header { display: flex; align-items: center; gap: 6px; }
  .branch header i { width: 30px; height: 30px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--bc); border: 2px solid var(--ink); color: #fff; }
  .branch header i :global(.icon) { width: 18px; height: 18px; }
  .branch header b { flex: 1; font-family: var(--font-display); font-weight: 400; font-size: 1.15em; }
  .rk { font-weight: 900; font-size: 0.82em; color: var(--muted); font-variant-numeric: tabular-nums; }
  ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; position: relative; }
  /* trait qui relie les rangs */
  ol::before { content: ''; position: absolute; left: 15px; top: 14px; bottom: 14px; width: 4px; background: var(--ink-soft); border-radius: 2px; }
  .node { position: relative; width: 100%; display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 6px; padding: 4px 6px 4px 1px; text-align: left; cursor: pointer;
    background: none; border: 2px solid transparent; border-radius: 10px; color: var(--text); font: inherit; }
  .node:hover { background: rgba(255, 255, 255, 0.7); }
  .node.on { border-color: var(--ink); background: #fff; }
  .dot { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; border: 2.5px solid var(--ink); background: #e8d9b8; font-weight: 900; font-size: 0.85em; color: var(--muted); position: relative; z-index: 1; }
  .owned .dot { background: var(--bc); color: #fff; }
  .next .dot { background: #fff; color: var(--ink); }
  .next.afford .dot { box-shadow: 0 0 0 3px var(--gold-fill); animation: glow 1.8s ease-in-out infinite; }
  @keyframes glow { 50% { box-shadow: 0 0 0 5px rgba(255, 197, 58, 0.45); } }
  .nm { font-weight: 800; font-size: 0.86em; line-height: 1.2; }
  .node:not(.owned):not(.next) .nm { color: var(--faint); }
  .cost { display: inline-flex; align-items: center; gap: 1px; font-weight: 900; font-size: 0.85em; color: var(--gold); font-variant-numeric: tabular-nums; }
  .cost :global(.icon) { width: 15px; height: 15px; }

  .detail { display: flex; align-items: center; gap: 14px; padding: 10px 14px; background: var(--panel-hi); border: 2.5px solid var(--ink); border-left: 10px solid var(--bc); border-radius: var(--r-sm); box-shadow: 0 3px 0 var(--ink); }
  .dt { flex: 1; min-width: 0; }
  .dt b { font-family: var(--font-display); font-weight: 400; font-size: 1.25em; }
  .where { margin-left: 8px; font-size: 0.8em; font-weight: 800; color: var(--muted); }
  .dt p { margin: 2px 0 0; font-weight: 700; }
  .detail .btn :global(.icon), .item .btn :global(.icon) { width: 1.1em; height: 1.1em; vertical-align: -0.15em; }
  .tag { font-weight: 900; color: var(--muted); font-size: 0.9em; text-align: right; }
  .tag.ok { color: var(--good); }
  .foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; font-weight: 700; color: var(--muted); font-size: 0.9em; }

  /* ---- boutique ---- */
  .shop { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
  .item { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; padding: 14px 12px; background: var(--panel-hi); border: 2.5px solid var(--ink); border-radius: var(--r-sm); box-shadow: 0 3px 0 var(--ink); }
  .ii { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 50%; border: 2.5px solid var(--ink); background: var(--raised); }
  .ii :global(.icon) { width: 36px; height: 36px; }
  .item > b { font-family: var(--font-display); font-weight: 400; font-size: 1.25em; }
  .item p { margin: 0; flex: 1; font-weight: 700; font-size: 0.88em; color: var(--muted); line-height: 1.35; }
  .have { font-weight: 800; font-size: 0.86em; }
  .note, .how { margin: 0; font-size: 0.84em; font-weight: 700; color: var(--muted); }
  .note { margin-top: 12px; }

  @media (max-width: 640px) {
    .box { height: auto; min-height: min(92vh, 100%); }
    h2 { font-size: 1.6em; }
    .tree { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .nm { font-size: 0.8em; }
    .detail { flex-direction: column; align-items: stretch; text-align: left; position: sticky; bottom: 0; z-index: 2; }
    .head { flex-wrap: nowrap; gap: 8px; }
    .wallet span { display: none; }
    .wallet b { font-size: 1.25em; }
    .where { display: block; margin: 0; }
  }
</style>
