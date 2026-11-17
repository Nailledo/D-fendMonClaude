<script lang="ts">
  import { DIFFICULTY_NAMES, LEVELS, MAPS, type Difficulty } from '@dfend/shared';
  import { app } from '../app';
  import { audio } from '../audio/Audio';
  import { HEROES } from '@dfend/shared';
  import { progress, setDifficulty, setHero, ui } from '../state.svelte';
  import HeroPicker from './HeroPicker.svelte';
  import { ICON } from './icons';

  // positions des niveaux sur la carte (en %)
  const POS = [[12, 74], [24, 56], [17, 34], [38, 40], [50, 62], [64, 44], [74, 26], [88, 16]];
  const BIOME = ['Vallée d’Aubeclair', 'Vallée d’Aubeclair', 'Vallée d’Aubeclair', 'Marais de Brumenoire', 'Marais de Brumenoire', 'Terres de Cendre', 'Terres de Cendre', 'Citadelle de Kessin'];
  let sel = $state(Math.min(progress.unlocked, LEVELS.length - 1));
  const nightmareFor = (i: number) => (progress.stars[i]?.[1] ?? 0) >= 3 || (progress.stars[i]?.[2] ?? 0) > 0;
  // Cauchemar mémorisé mais pas encore débloqué sur ce niveau : on retombe sur Vétéran
  const diff = $derived<Difficulty>(ui.difficulty === 2 && !nightmareFor(sel) ? 1 : ui.difficulty);
  const stars = (i: number) => Math.max(0, ...(progress.stars[i] ?? [0]));
  const nightmareOk = $derived(nightmareFor(sel));
  const totalStars = $derived(LEVELS.reduce((s, _, i) => s + stars(i), 0));

  function play() {
    audio.play('click');
    app.startSolo('story', LEVELS[sel].mapId, diff, ui.hero, sel);
  }
  function coop() {
    audio.play('click');
    ui.screen = 'multi';
    app.connect();
  }
  const path = POS.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
</script>

<div class="wrap ui">
  <div class="map panel">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="bg">
      <defs>
        <radialGradient id="v" cx="20%" cy="65%" r="40%"><stop offset="0" stop-color="#9ccc65" stop-opacity="0.55" /><stop offset="1" stop-color="#9ccc65" stop-opacity="0" /></radialGradient>
        <radialGradient id="m" cx="45%" cy="52%" r="25%"><stop offset="0" stop-color="#5e7d4a" stop-opacity="0.55" /><stop offset="1" stop-color="#5e7d4a" stop-opacity="0" /></radialGradient>
        <radialGradient id="c" cx="80%" cy="25%" r="35%"><stop offset="0" stop-color="#bf360c" stop-opacity="0.55" /><stop offset="1" stop-color="#bf360c" stop-opacity="0" /></radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#v)" />
      <rect width="100" height="100" fill="url(#m)" />
      <rect width="100" height="100" fill="url(#c)" />
      <path d="M6 90 Q 20 70 10 50 T 30 20" stroke="#7aa6c2" stroke-width="1.2" fill="none" opacity="0.6" />
      {#each [[8, 20], [30, 80], [42, 16], [70, 70], [90, 60]] as [x, y]}
        <g opacity="0.45"><path d="M{x} {y} l2 -5 l2 5z M{x + 3} {y + 1} l2 -4 l2 4z" fill="#5d4037" /></g>
      {/each}
      <path d={path} stroke="#7a4a1e" stroke-width="0.8" stroke-dasharray="1.6 1.2" fill="none" />
    </svg>
    {#each LEVELS as l, i}
      {@const locked = i > progress.unlocked}
      <button
        class="node"
        class:locked
        class:on={sel === i}
        class:boss={!!l.boss}
        style="left:{POS[i][0]}%;top:{POS[i][1]}%"
        disabled={locked}
        onclick={() => { sel = i; audio.play('click'); }}
      >
        <span class="num">{#if locked}{@html ICON.lock}{:else}{i + 1}{/if}</span>
        {#if !locked}
          <span class="stars">{#each [0, 1, 2] as k}{@html k < stars(i) ? ICON.star : ICON.starEmpty}{/each}</span>
        {/if}
      </button>
    {/each}
    <div class="compass">{@html ICON.star} {totalStars} / {LEVELS.length * 3}</div>
  </div>

  <div class="side panel">
    <p class="biome">{BIOME[sel]}</p>
    <h2>{sel + 1}. {LEVELS[sel].name}</h2>
    <p class="desc">
      {LEVELS[sel].waves} vagues · {MAPS[LEVELS[sel].mapId].paths.length} chemin{MAPS[LEVELS[sel].mapId].paths.length > 1 ? 's' : ''}
      {#if LEVELS[sel].boss}· <b class="bossTxt">Boss</b>{/if}
    </p>
    <div class="diffs">
      {#each DIFFICULTY_NAMES as d, i}
        <button class="btn small" class:gold={diff === i} disabled={i === 2 && !nightmareOk} onclick={() => setDifficulty(i as Difficulty)}>
          {d}
        </button>
      {/each}
    </div>
    <p class="hint">
      {#if diff === 0}Pour découvrir l’histoire tranquillement.{:else if diff === 1}La difficulté prévue : exigeante.{:else}Une seule vie. Aucune erreur permise.{/if}
      {#if !nightmareOk}<br /><span class="lock">Cauchemar : obtenez 3 étoiles en Vétéran sur ce niveau.</span>{/if}
    </p>
    <div class="heroes">
      <HeroPicker value={ui.hero} onpick={setHero} compact />
      <p class="hint"><b>{HEROES[ui.hero].name}</b>, {HEROES[ui.hero].title.toLowerCase()}. {HEROES[ui.hero].passive.desc}</p>
    </div>
    <div class="col">
      <button class="btn gold big" onclick={play}>Jouer seul</button>
      <button class="btn" onclick={coop}>{@html ICON.users} Jouer en coop</button>
      <button class="btn ghost" onclick={() => (ui.screen = 'title')}>Retour</button>
    </div>
  </div>
</div>

<style>
  .wrap {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 16px;
    padding: 16px;
    background: rgba(20, 12, 6, 0.45);
  }
  .map { position: relative; overflow: hidden; padding: 0; }
  .bg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .node {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 3px solid var(--wood-dark);
    background: radial-gradient(circle at 35% 30%, #fff4cf, #e0b75a);
    cursor: pointer;
    display: grid;
    place-items: center;
    font-family: 'Cinzel', serif;
    font-weight: 800;
    font-size: 20px;
    color: var(--ink);
    box-shadow: 0 4px 0 var(--wood-dark), 0 6px 14px rgba(0, 0, 0, 0.35);
    transition: transform 0.15s;
  }
  .node:hover:not(:disabled) { transform: translate(-50%, -50%) scale(1.1); }
  .node.on { outline: 4px solid rgba(242, 193, 78, 0.8); outline-offset: 3px; }
  .node.boss { background: radial-gradient(circle at 35% 30%, #ffd1c4, #c2410c); color: #fff; }
  .node.locked { filter: grayscale(1) brightness(0.8); cursor: not-allowed; }
  .stars { position: absolute; bottom: -18px; display: flex; font-size: 13px; }
  .compass { position: absolute; right: 14px; bottom: 10px; font-weight: 800; }
  .side { display: flex; flex-direction: column; gap: 10px; overflow: auto; }
  .side h2 { margin: 0; font-size: 1.4em; }
  .biome { margin: 0; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.75em; font-weight: 800; color: #8a5a2b; }
  .desc, .hint { margin: 0; font-size: 0.9em; }
  .bossTxt { color: var(--red); }
  .lock { color: #7a4d06; font-weight: 700; }
  .heroes { display: flex; flex-direction: column; gap: 6px; }
  .diffs { display: flex; gap: 6px; flex-wrap: wrap; }
  .col .btn { width: 100%; }
  @media (max-width: 760px) {
    .wrap { grid-template-columns: 1fr; grid-template-rows: 1fr auto; }
  }
</style>
