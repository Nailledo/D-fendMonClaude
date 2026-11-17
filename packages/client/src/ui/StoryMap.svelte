<script lang="ts">
  import { DIFFICULTY_NAMES, ENEMIES, ENEMY_INDEX, HEROES, LEVELS, MAPS, type Difficulty } from '@dfend/shared';
  import { app } from '../app';
  import { audio } from '../audio/Audio';
  import { progress, setDifficulty, setHero, ui } from '../state.svelte';
  import { enemyTraits } from './enemyTraits';
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

  function play() {
    audio.play('click');
    app.startSolo('story', level.mapId, diff, ui.hero, sel);
  }
  function coop() {
    audio.play('click');
    ui.screen = 'multi';
    app.connect();
  }

  // ---- fond en facettes, dessiné en code (déterministe) ----
  const W = 160, H = 100, C = 8;
  function facets() {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const cols = Math.ceil(W / C), rows = Math.ceil(H / C);
    const pts: number[][][] = [];
    for (let y = 0; y <= rows; y++) {
      pts.push([]);
      for (let x = 0; x <= cols; x++) {
        const edge = x === 0 || y === 0 || x === cols || y === rows;
        pts[y].push([x * C + (edge ? 0 : (rnd() - 0.5) * 4.4), y * C + (edge ? 0 : (rnd() - 0.5) * 4.4)]);
      }
    }
    const PAL = [
      ['#6fa34a', '#7db356', '#629642'],
      ['#4e7a5e', '#5d8a6b', '#466e56'],
      ['#763e32', '#844838', '#68362c'],
      ['#422624', '#4e2c28', '#3a2020'],
    ];
    const out: { d: string; c: string }[] = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const a = pts[y][x], b = pts[y][x + 1], c = pts[y + 1][x + 1], d = pts[y + 1][x];
        for (const t of [[a, b, c], [a, c, d]]) {
          const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
          const f = (cx / W) * 0.62 + (1 - cy / H) * 0.38;
          const pal = PAL[f < 0.36 ? 0 : f < 0.56 ? 1 : f < 0.8 ? 2 : 3];
          out.push({ d: 'M' + t.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + 'Z', c: pal[Math.floor(rnd() * 3)] });
        }
      }
    return out;
  }
  const FACETS = facets();
  const route = POS.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * W) / 100} ${y}`).join(' ');
</script>

<div class="wrap ui">
  <div class="map">
    <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" class="bg" aria-hidden="true">
      {#each FACETS as f}<path d={f.d} fill={f.c} stroke={f.c} stroke-width="0.15" />{/each}
      <path d={route} fill="none" stroke="#0f1316" stroke-width="12" stroke-linejoin="bevel" vector-effect="non-scaling-stroke" />
      <path d={route} fill="none" stroke="#e9dcb8" stroke-width="6" stroke-linejoin="bevel" vector-effect="non-scaling-stroke" />
    </svg>
    <span class="blabel" style="left:5%;top:88%">Vallée d’Aubeclair</span>
    <span class="blabel" style="left:44%;top:78%">Marais de Brumenoire</span>
    <span class="blabel" style="left:60%;top:60%">Terres de Cendre</span>

    {#each LEVELS as l, i}
      {@const locked = i > progress.unlocked}
      {@const done = stars(i) > 0}
      <button class="node" class:locked class:done class:on={sel === i} disabled={locked}
        style="left:{POS[i][0]}%;top:{POS[i][1]}%" aria-label="Niveau {i + 1} : {l.name}{locked ? ' (verrouillé)' : ''}"
        onclick={() => { sel = i; audio.play('click'); }}>
        <span class="hx">{#if locked}{@html ICON.lock}{:else}{i + 1}{/if}</span>
        {#if l.boss}<span class="bossmark" title="Boss"></span>{/if}
        {#if done}<span class="stars">{#each [0, 1, 2] as k}{@html k < stars(i) ? ICON.star : ICON.starEmpty}{/each}</span>{/if}
      </button>
    {/each}

    <div class="top">
      <button class="btn" onclick={() => (ui.screen = 'title')}>{@html ICON.back} Menu</button>
      <span class="total panel">{@html ICON.star} {totalStars} / {LEVELS.length * 3}</span>
    </div>
  </div>

  <aside class="side panel">
    <div>
      <p class="eyebrow">{BIOME[sel]} · niveau {sel + 1}</p>
      <h2>{level.name}</h2>
    </div>
    <div class="meta">
      <span class="chip">{level.waves} vagues</span>
      <span class="chip">{paths} chemin{paths > 1 ? 's' : ''}</span>
      {#if boss}<span class="chip bosschip">Boss : {boss.name.split(',')[0]}</span>{/if}
    </div>

    <section>
      <h3 class="lbl">Ennemis</h3>
      <ul class="foes">
        {#each foes as f}
          {@const tr = enemyTraits(f)}
          <li><span>{f.name}</span>{#if tr[0]}<em>{tr[0]}</em>{/if}</li>
        {/each}
      </ul>
    </section>

    <section>
      <h3 class="lbl">Difficulté</h3>
      <div class="seg">
        {#each DIFFICULTY_NAMES as d, i}
          <button class:on={diff === i} disabled={i === 2 && !nightmareOk} onclick={() => setDifficulty(i as Difficulty)}>
            {#if i === 2 && !nightmareOk}{@html ICON.lock}{/if}{d}{#if (best[i] ?? 0) > 0}<small> · {best[i]} ★</small>{/if}
          </button>
        {/each}
      </div>
      <p class="hint">{DIFF_HINT[diff]}{#if !nightmareOk}<br /><span class="lock">Cauchemar : obtenez 3 étoiles en Vétéran sur ce niveau.</span>{/if}</p>
    </section>

    <section>
      <h3 class="lbl">Héros</h3>
      <HeroPicker value={ui.hero} onpick={setHero} compact />
      <p class="hint"><b>{HEROES[ui.hero].name}</b>, {HEROES[ui.hero].title.toLowerCase()}. {HEROES[ui.hero].passive.desc}</p>
    </section>

    <div class="cta">
      <button class="btn gold big" onclick={play}>Jouer</button>
      <button class="btn" onclick={coop}>{@html ICON.users} Jouer en coop</button>
      {#if sel === 0 && progress.seenPrologue}
        <button class="btn ghost" onclick={() => { ui.replayPrologue = true; play(); }}>{@html ICON.play} Revoir le prologue</button>
      {/if}
    </div>
  </aside>
</div>

<style>
  .wrap { position: fixed; inset: 0; display: grid; grid-template-columns: 1fr 360px; gap: 0; background: #1b2124; }
  .map { position: relative; overflow: hidden; min-height: 0; }
  .bg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .blabel { position: absolute; transform: translate(0, -50%); font-family: var(--font-display); font-weight: 700; font-size: clamp(13px, 1.4vw, 18px); letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255, 255, 255, 0.82); pointer-events: none; white-space: nowrap; }
  .node { position: absolute; transform: translate(-50%, -50%); width: 60px; height: 54px; padding: 0; border: 0; background: none; cursor: pointer; filter: var(--drop); }
  .hx { position: absolute; inset: 0; display: grid; place-items: center; background: #3a4349; color: var(--muted); font-family: var(--font-display); font-weight: 700; font-size: 24px;
    border-radius: 50%; }
  .node.done .hx { background: var(--gold); color: var(--gold-ink); }
  .node:not(.locked):not(.done) .hx { background: var(--text); color: var(--gold-ink); }
  .node.on::before { content: ''; position: absolute; inset: -9px; border-radius: 50%; border: 4px solid var(--gold); }
  .node:hover:not(:disabled) .hx { filter: brightness(1.1); }
  .node.locked { cursor: not-allowed; }
  .hx :global(.icon) { width: 22px; height: 22px; }
  .bossmark { position: absolute; right: -4px; top: -6px; width: 18px; height: 16px; background: var(--life); border-radius: 50%; }
  .stars { position: absolute; left: 50%; bottom: -20px; transform: translateX(-50%); display: flex; gap: 1px; }
  .stars :global(.icon) { width: 17px; height: 17px; }
  .top { position: absolute; left: 16px; top: 16px; display: flex; gap: 8px; align-items: stretch; }
  .total { display: flex; align-items: center; gap: 6px; padding: 8px 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .side { display: flex; flex-direction: column; gap: 16px; overflow: auto; padding: 22px 22px 18px; margin: 16px 16px 16px 0; }
  .eyebrow { margin: 0 0 6px; }
  h2 { margin: 0; font-size: 2.1em; }
  .meta { display: flex; gap: 6px; flex-wrap: wrap; }
  .bosschip { color: var(--bad); border-color: var(--bad); }
  section { display: flex; flex-direction: column; gap: 8px; }
  .lbl { margin: 0; font-family: var(--font-ui); font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
  .foes { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; font-size: 0.93em; }
  .foes li { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
  .foes em { font-style: normal; font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--gold); white-space: nowrap; }
  .seg :global(.icon) { width: 14px; height: 14px; margin-right: 4px; vertical-align: -2px; }
  .seg small { font-weight: 400; opacity: 0.8; }
  .hint { margin: 0; font-size: 0.9em; color: var(--muted); }
  .hint b { color: var(--text); }
  .lock { color: var(--gold); font-weight: 700; }
  .cta { display: flex; flex-direction: column; gap: 8px; margin-top: auto; }
  .cta .btn { width: 100%; }
  @media (max-width: 860px) {
    .wrap { grid-template-columns: 1fr; grid-template-rows: minmax(260px, 45vh) 1fr; }
    .side { margin: 0; }
  }
</style>
