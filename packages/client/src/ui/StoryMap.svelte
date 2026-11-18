<script lang="ts">
  import Ico from './Ico.svelte';
  import { DIFFICULTY_NAMES, ENEMIES, ENEMY_INDEX, HEROES, LEVELS, MAPS, type Difficulty } from '@dfend/shared';
  import { app } from '../app';
  import { audio } from '../audio/Audio';
  import { progress, setDifficulty, setHero, ui } from '../state.svelte';
  import { availableStars } from '../meta';
  import { TRAIT_ICON, enemyTraits } from './enemyTraits';
  import HeroPicker from './HeroPicker.svelte';
  import { ICON } from './icons';

  // positions des niveaux sur la carte (en %)
  const POS = [[12, 74], [24, 56], [17, 34], [38, 40], [50, 62], [64, 44], [74, 26], [88, 16]];
  const BIOME = ['Vallée d’Aubeclair', 'Vallée d’Aubeclair', 'Vallée d’Aubeclair', 'Marais de Brumenoire', 'Marais de Brumenoire', 'Terres de Cendre', 'Terres de Cendre', 'Citadelle de Kessin'];
  const DIFF_HINT = ['20 vies, ennemis affaiblis : pour découvrir l’histoire.', '20 vies : la difficulté prévue, exigeante.', 'Une seule vie. Aucune erreur permise.'];
  let sel = $state(Math.min(progress.unlocked, LEVELS.length - 1));
  const nightmareFor = (i: number) => (progress.stars[i]?.[1] ?? 0) >= 3 || (progress.stars[i]?.[2] ?? 0) > 0;
  // Cauchemar mémorisé mais pas encore débloqué sur ce niveau : on retombe sur Vétéran
  const diff = $derived<Difficulty>(ui.difficulty === 2 && !nightmareFor(sel) ? 1 : ui.difficulty);
  const stars = (i: number) => Math.max(0, ...(progress.stars[i] ?? [0]));
  const nightmareOk = $derived(nightmareFor(sel));
  const totalStars = $derived(LEVELS.reduce((s, _, i) => s + stars(i), 0));
  const level = $derived(LEVELS[sel]);
  const paths = $derived(MAPS[level.mapId].paths.length);
  const foes = $derived(level.roster.map((r) => ENEMIES[ENEMY_INDEX[r.type]]));
  const boss = $derived(level.boss ? ENEMIES[ENEMY_INDEX[level.boss.type]] : null);
  const best = $derived(progress.stars[sel] ?? []);
  /** ennemis du niveau, le boss en dernier */
  const roster = $derived(boss ? [...foes.filter((f) => f.id !== boss.id), boss] : foes);
  /** traits affichés en pastille, expliqués une fois sous la liste */
  const legend = $derived([...new Set(roster.map((f) => enemyTraits(f)[0]).filter((t): t is string => !!t && !!TRAIT_ICON[t]))]);
  const ROUTE = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1 4.5" aria-hidden="true"><path d="M4 20c4-1 4-7 8-8s4-7 8-8"/></svg>';
  const LOCK = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

  function play() {
    audio.play('click');
    app.startSolo('story', level.mapId, diff, ui.hero, sel);
  }
  function coop() {
    audio.play('click');
    ui.screen = 'multi';
    app.connect();
  }

  // ---- carte peinte à l'aquarelle sur le papier du conteur (SVG, déterministe) ----
  const W = 160, H = 100;
  const route = POS.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * W) / 100} ${y}`).join(' ');
</script>

<div class="wrap ui paper">
  <div class="map">
    <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" class="bg" aria-hidden="true">
      <defs>
        <filter id="wc" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="9" />
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
        <filter id="edge" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves="2" seed="9" />
          <feDisplacementMap in="SourceGraphic" scale="1.2" />
        </filter>
        <radialGradient id="vig" cx="50%" cy="50%" r="75%"><stop offset="60%" stop-color="#e8d6ac" stop-opacity="0" /><stop offset="100%" stop-color="#b9955a" stop-opacity="0.55" /></radialGradient>
      </defs>
      <rect width={W} height={H} fill="#f3e7c9" />
      <!-- lavis des trois contrées -->
      <g filter="url(#wc)" opacity="0.62">
        <ellipse cx="30" cy="62" rx="40" ry="44" fill="#8cc06a" />
        <ellipse cx="22" cy="80" rx="26" ry="20" fill="#6fae4c" />
        <ellipse cx="74" cy="56" rx="26" ry="32" fill="#7a8fb0" />
        <ellipse cx="78" cy="66" rx="16" ry="14" fill="#8a6fae" />
        <ellipse cx="124" cy="32" rx="42" ry="34" fill="#c76b4c" />
        <ellipse cx="140" cy="16" rx="22" ry="18" fill="#8f3a2c" />
      </g>
      <!-- quelques arbres et montagnes à l'encre -->
      <g fill="none" stroke="#2d2416" stroke-width="0.35" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" filter="url(#edge)">
        <path d="M6 52 l2 -5 l2 5 z M9 46 l2 -5 l2 5 z M34 70 l2 -5 l2 5 z M42 82 l2 -5 l2 5 z M30 24 l2 -5 l2 5 z" />
        <path d="M58 30 q2 -3 4 0 q2 -3 4 0 M92 44 q2 -3 4 0 q2 -3 4 0" />
        <path d="M100 18 l5 -9 l5 9 M108 18 l6 -11 l6 11 M126 54 l5 -8 l5 8 M148 40 l4 -7 l4 7" />
      </g>
      <rect width={W} height={H} fill="url(#vig)" />
      <!-- la route du chevalier : pointillés à l'encre -->
      <path d={route} fill="none" stroke="#f6ecd2" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" opacity="0.8" />
      <path d={route} fill="none" stroke="#2d2416" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    </svg>
    <!-- rose des vents -->
    <svg class="rose" viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="#2d2416" stroke-width="1"><circle cx="20" cy="20" r="11" /><path d="M20 2 L23 20 L20 38 L17 20 Z M2 20 L20 17 L38 20 L20 23 Z" fill="rgba(246,236,210,.8)" /><path d="M20 2 L23 20 L20 20 Z M38 20 L20 23 L20 20 Z" fill="#2d2416" /></g><text x="20" y="1" text-anchor="middle" font-size="5" fill="#2d2416" font-family="IM Fell English SC, serif">N</text></svg>
    <span class="blabel" style="left:5%;top:88%">Vallée d’Aubeclair</span>
    <span class="blabel" style="left:44%;top:78%">Marais de Brumenoire</span>
    <span class="blabel" style="left:60%;top:60%">Terres de Cendre</span>

    {#each LEVELS as l, i}
      {@const locked = i > progress.unlocked}
      {@const done = stars(i) > 0}
      <button class="node" class:locked class:done class:on={sel === i} disabled={locked}
        style="left:{POS[i][0]}%;top:{POS[i][1]}%" aria-label="Niveau {i + 1} : {l.name}{locked ? ' (verrouillé)' : ''}"
        onclick={() => { sel = i; audio.play('click'); }}>
        <span class="hx">{#if locked}<Ico k="lock" fb={ICON.lock} />{:else}{i + 1}{/if}</span>
        {#if l.boss}<span class="bossmark" title="Boss"><Ico k="skull" fb="" /></span>{/if}
        {#if done}<span class="stars">{#each [0, 1, 2] as k}<Ico k={k < stars(i) ? 'star' : 'starEmpty'} fb={k < stars(i) ? ICON.star : ICON.starEmpty} />{/each}</span>{/if}
      </button>
    {/each}

    <div class="top">
      <button class="btn" onclick={() => (ui.screen = 'title')}>{@html ICON.back} Menu</button>
      <button class="btn" onclick={() => (ui.overlay = 'atelier')}>{@html ICON.tree} Atelier{#if availableStars() > 0}<span class="avail">{availableStars()}</span>{/if}</button>
      <span class="total"><Ico k="star" fb={ICON.star} /> {totalStars} / {LEVELS.length * 3}</span>
    </div>
  </div>

  <aside class="side panel">
    <div class="info scroll">
    <header>
      <p class="eyebrow">{BIOME[sel]} · chapitre {sel + 1}</p>
      <h2>{level.name}</h2>
      <p class="facts">
        <span><Ico k="horn" fb={ICON.horn} />{level.waves} vagues</span>
        <span>{@html ROUTE}{paths} chemin{paths > 1 ? 's' : ''}</span>
        {#if best.some((b) => b > 0)}<span><Ico k="star" fb={ICON.star} />{Math.max(...best.map((b) => b ?? 0))} / 3</span>{/if}
      </p>
    </header>

    <section>
      <h3 class="lbl">Ennemis</h3>
      <ul class="foes">
        {#each roster as f}
          {@const tr = enemyTraits(f)}
          <li class:boss={f.boss} title="{f.name}{tr.length ? ' : ' + tr.join(', ') : ''}">
            <span class="fp">
              {#if ui.portraits['e_' + f.id]}<img src={ui.portraits['e_' + f.id]} alt="" />{/if}
              {#if tr[0] && TRAIT_ICON[tr[0]]}<span class="tb" title={tr[0]}>{@html TRAIT_ICON[tr[0]]}</span>{/if}
            </span>
            <span class="fn">{f.boss ? f.name.split(',')[0] : f.name}</span>
          </li>
        {/each}
      </ul>
      {#if legend.length}
        <p class="legend">{#each legend as t}<span><i>{@html TRAIT_ICON[t]}</i>{t}</span>{/each}</p>
      {/if}
    </section>

    <section>
      <h3 class="lbl">Difficulté</h3>
      <div class="seg diff">
        {#each DIFFICULTY_NAMES as d, i}
          <button class:on={diff === i} disabled={i === 2 && !nightmareOk} onclick={() => setDifficulty(i as Difficulty)}
            title={i === 2 && !nightmareOk ? 'Obtenez 3 étoiles en Vétéran sur ce niveau' : DIFF_HINT[i]}>
            {#if i === 2 && !nightmareOk}{@html LOCK}{/if}<span>{d}</span>
          </button>
        {/each}
      </div>
      <p class="hint">{DIFF_HINT[diff]}</p>
    </section>

    <section>
      <h3 class="lbl">Héros</h3>
      <div class="hp"><HeroPicker value={ui.hero} onpick={setHero} compact /></div>
      <p class="hint"><b>{HEROES[ui.hero].name}</b> · {HEROES[ui.hero].title}</p>
    </section>
    </div>

    <div class="cta">
      <button class="btn gold big" onclick={play}>Jouer</button>
      <div class="sub">
        <button class="btn" onclick={coop}>{@html ICON.users} En coop</button>
        {#if sel === 0 && progress.seenPrologue}
          <button class="btn" onclick={() => { ui.replayPrologue = true; play(); }}>{@html ICON.play} Prologue</button>
        {/if}
      </div>
    </div>
  </aside>
</div>

<style>
  .avail { margin-left: 6px; min-width: 22px; padding: 0 6px; border-radius: 99px; border: 2px solid var(--ink); background: var(--gold-fill); font-weight: 900; font-size: 0.85em; }
  .wrap { position: fixed; inset: 0; display: grid; grid-template-columns: 1fr 370px; gap: 0; background: #3a2a1c; }
  .map { position: relative; overflow: hidden; min-height: 0; margin: 14px 0 14px 14px; border: 2px solid var(--ink); box-shadow: inset 0 0 0 6px #f3e7c9, inset 0 0 0 7px rgba(45, 36, 22, 0.5), 0 12px 30px rgba(0, 0, 0, 0.4); }
  .bg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .rose { position: absolute; right: 22px; bottom: 18px; width: 70px; height: 70px; opacity: 0.8; pointer-events: none; }
  .blabel { position: absolute; transform: translate(0, -50%) rotate(-4deg); font-family: var(--font-story-sc); font-size: clamp(15px, 1.7vw, 23px); letter-spacing: 0.08em; color: var(--ink); pointer-events: none; white-space: nowrap; opacity: 0.85; }
  /* sceaux de cire : rouge = à jouer, or = terminé, encre = verrouillé */
  .node { position: absolute; transform: translate(-50%, -50%); width: 58px; height: 58px; padding: 0; border: 0; background: none; cursor: pointer; transition: transform 0.12s; }
  .node:hover:not(:disabled) { transform: translate(-50%, -50%) scale(1.08) rotate(-4deg); }
  .hx { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--font-story); font-size: 26px; color: #f6d77a;
    border-radius: 47% 53% 50% 50% / 52% 48% 52% 48%; background: radial-gradient(circle at 35% 30%, #d9534a, #a8322b 58%, #6f1c17); box-shadow: inset 0 0 0 4px rgba(111, 28, 23, 0.65), inset 0 0 0 6px rgba(246, 215, 122, 0.55), 0 3px 4px rgba(40, 20, 5, 0.45); }
  .node.done .hx { background: radial-gradient(circle at 35% 30%, #ffe07a, #e0a92e 58%, #9a6a12); color: #5a3a06; box-shadow: inset 0 0 0 4px rgba(120, 80, 10, 0.55), inset 0 0 0 6px rgba(255, 245, 200, 0.6), 0 3px 4px rgba(40, 20, 5, 0.45); }
  .node.locked .hx { background: rgba(246, 236, 210, 0.85); color: var(--ink); border: 2px dashed var(--ink); box-shadow: none; }
  .node.on::before { content: ''; position: absolute; inset: -10px; border-radius: 50%; border: 2px solid var(--ink); box-shadow: 0 0 0 4px rgba(246, 236, 210, 0.85), 0 0 0 5px var(--ink); }
  .node.locked { cursor: not-allowed; }
  .hx :global(.icon) { width: 22px; height: 22px; opacity: 0.8; }
  .bossmark { position: absolute; right: -12px; top: -12px; width: 28px; height: 28px; border-radius: 50%; background: #2d2416; border: 2px solid #f6ecd2; display: grid; place-items: center; }
  .bossmark :global(.ico3d) { width: 32px; height: 32px; margin: 0; vertical-align: 0; }
  .stars { position: absolute; left: 50%; bottom: -22px; transform: translateX(-50%); display: flex; gap: 1px; }
  .stars :global(.icon) { width: 18px; height: 18px; }
  .top { position: absolute; left: 22px; top: 22px; display: flex; gap: 10px; align-items: stretch; }
  .total { display: flex; align-items: center; gap: 6px; padding: 6px 14px; font-family: var(--font-story); font-size: 1.25em; font-variant-numeric: lining-nums tabular-nums; background: rgba(246, 236, 210, 0.9); border: 2px solid var(--ink); border-radius: 99px; }
  .total :global(.icon) { width: 22px; height: 22px; }
  /* page de droite : le contenu défile, les boutons restent dessous (hors du défilement, sans fond propre) */
  .side { display: flex; flex-direction: column; gap: 12px; min-height: 0; overflow: hidden; padding: 20px 20px 18px; margin: 14px; }
  .info { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 14px; margin: 0 -8px; padding: 0 8px 4px; }
  header { display: flex; flex-direction: column; gap: 6px; }
  .eyebrow { margin: 0; }
  h2 { margin: 0; font-size: 2.2em; line-height: 1.05; }
  .facts { margin: 2px 0 0; display: flex; flex-wrap: wrap; gap: 4px 16px; font-weight: 900; font-size: 0.92em; color: var(--muted); }
  .facts span { display: inline-flex; align-items: center; gap: 5px; }
  .facts :global(.icon) { width: 22px; height: 22px; margin: 0; vertical-align: 0; }
  section { display: flex; flex-direction: column; gap: 10px; }
  .lbl { margin: 0; font-family: var(--font-story-sc); font-weight: 400; font-size: 17px; letter-spacing: 0.06em; color: var(--muted); display: flex; align-items: center; gap: 10px; }
  .lbl::after { content: ''; flex: 1; height: 1px; background: rgba(45, 36, 22, 0.35); }
  /* ennemis : portraits ronds, nom dessous, pastille du trait principal */
  .foes { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(66px, 1fr)); gap: 8px 6px; }
  .foes li { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; min-width: 0; cursor: help; }
  .fp { position: relative; width: 48px; height: 48px; }
  .fp img { width: 48px; height: 48px; border-radius: 50%; border: 2px solid var(--ink); background: radial-gradient(circle at 50% 60%, #fbf4e2, #e6d3a8); display: block; }
  .boss .fp img { border-color: var(--bad); box-shadow: 0 0 0 2px var(--bad); }
  .tb { position: absolute; right: -4px; bottom: -2px; width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%; background: var(--ink); color: #f6ecd2; border: 1.5px solid #f6ecd2; }
  .boss .tb { background: var(--bad); }
  .tb :global(.icon) { width: 13px; height: 13px; margin: 0; vertical-align: 0; }
  .fn { font-size: 11.5px; font-weight: 800; line-height: 1.15; max-width: 100%; }
  .boss .fn { color: var(--bad); }
  .legend { margin: 0; display: flex; flex-wrap: wrap; gap: 4px 12px; font-family: var(--font-story); font-style: italic; font-size: 14px; color: var(--muted); }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .legend i { width: 18px; height: 18px; display: grid; place-items: center; border-radius: 50%; background: var(--ink); color: #f6ecd2; }
  .legend :global(.icon) { width: 11px; height: 11px; margin: 0; vertical-align: 0; }
  /* difficulté : trois touches de même hauteur, cadenas sur la ligne */
  .diff { flex-wrap: nowrap; }
  .diff { gap: 6px; }
  .diff > button { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 0; padding: 7px 4px; font-size: 0.86em; }
  .diff :global(.icon) { width: 14px; height: 14px; margin: 0; vertical-align: 0; flex: none; }
  .hp :global(.hero img) { max-width: 46px; }
  .hint { margin: 0; font-size: 0.9em; color: var(--muted); font-weight: 700; }
  .hint b { color: var(--text); font-weight: 900; }
  .cta { flex: none; display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid rgba(45, 36, 22, 0.25); }
  .cta .btn { width: 100%; }
  .sub { display: flex; gap: 8px; }
  .sub .btn { flex: 1; padding: 7px 10px; }
  @media (max-width: 860px) {
    .wrap { grid-template-columns: 1fr; grid-template-rows: minmax(260px, 45vh) 1fr; }
    .map { margin: 10px 10px 0; }
    .side { margin: 10px; }
    .rose { width: 48px; height: 48px; right: 14px; bottom: 12px; }
  }
  /* téléphone en paysage : carte à gauche, page à droite */
  @media (max-height: 520px) and (orientation: landscape) {
    .wrap { grid-template-columns: 1fr minmax(280px, 40vw); grid-template-rows: 1fr; }
    .map { margin: 8px 0 8px calc(8px + var(--sal)); }
    .side { margin: 8px calc(8px + var(--sar)) 8px 8px; padding: 14px 14px 12px; gap: 8px; }
    .info { gap: 10px; }
    h2 { font-size: 1.7em; }
    .top { left: 14px; top: 14px; }
  }
</style>
