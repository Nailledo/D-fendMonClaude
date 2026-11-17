<script lang="ts">
  import Ico from './Ico.svelte';
  import { LEVELS } from '@dfend/shared';
  import { audio } from '../audio/Audio';
  import { app } from '../app';
  import { progress, setName, ui } from '../state.svelte';
  import { ICON } from './icons';

  let editing = $state(false);
  let name = $state(ui.name);
  let input: HTMLInputElement | undefined = $state();
  const stars = $derived(progress.stars.reduce((s, l) => s + Math.max(0, ...(l ?? [0])), 0));
  const next = $derived(Math.min(progress.unlocked, LEVELS.length - 1));
  const storyLabel = $derived(progress.unlocked === 0 ? 'Commencer l’histoire' : progress.finished ? 'Histoire' : 'Continuer l’histoire');
  const storySub = $derived(
    progress.finished ? `Campagne terminée · ${stars} ★ sur ${LEVELS.length * 3}` : `Niveau ${next + 1} · ${LEVELS[next].name}`,
  );

  function go(screen: typeof ui.screen) {
    audio.unlock();
    audio.play('click');
    if (screen === 'multi') {
      if (!ui.name) setName('Chevalier' + Math.floor(Math.random() * 100));
      app.connect();
    }
    ui.screen = screen;
  }
  function overlay(o: typeof ui.overlay) {
    audio.unlock();
    audio.play('click');
    ui.overlay = o;
  }
  function edit() {
    name = ui.name;
    editing = true;
    queueMicrotask(() => input?.focus());
  }
  function commit() {
    setName(name.trim());
    editing = false;
  }
</script>

<div class="titlescreen ui">
  <div class="logo">
    <h1>D-Fend</h1>
    <p class="sub">La Quête de Samuel</p>
  </div>

  <nav class="menu" aria-label="Menu principal">
    <button class="row main" onclick={() => go('story')}>
      <span class="go">{@html ICON.play}</span>
      <span class="lbl"><b>{storyLabel}</b><span>{storySub}</span></span>
    </button>
    <div class="modes">
      <button class="row surv" onclick={() => go('survival')}><span class="pop"><Ico k="horn" fb={ICON.horn} /></span><span class="lbl"><b>Survie</b><span>Vagues sans fin</span></span></button>
      <button class="row coop" onclick={() => go('multi')}><span class="pop"><Ico k="reinforce" fb={ICON.users} /></span><span class="lbl"><b>Multijoueur</b><span>De 1 à 4 joueurs</span></span></button>
    </div>
    <div class="small">
      <button onclick={() => overlay('encyclo')}><i>{@html ICON.book}</i><span>Encyclopédie</span></button>
      <button onclick={() => overlay('leaderboard')}><i><Ico k="trophy" fb={ICON.trophy} /></i><span>Classement</span></button>
      <button onclick={() => overlay('help')}><i>{@html ICON.help}</i><span>Aide</span></button>
      <button onclick={() => overlay('settings')}><i>{@html ICON.gear}</i><span>Réglages</span></button>
    </div>
  </nav>

  <div class="profile">
    <div class="pp">{#if ui.portraits[ui.hero]}<img src={ui.portraits[ui.hero]} alt="" />{/if}</div>
    {#if editing}
      <form onsubmit={(e) => { e.preventDefault(); commit(); }}>
        <label class="sr" for="pname">Votre nom</label>
        <input id="pname" bind:this={input} type="text" maxlength="16" placeholder="Votre nom" bind:value={name} onblur={commit} onkeydown={(e) => e.key === 'Escape' && (editing = false)} />
      </form>
    {:else}
      <button class="who" onclick={edit} aria-label="Modifier votre nom">
        <span><b>{ui.name || 'Choisir un nom'}</b><small><Ico k="star" fb={ICON.star} />{stars} / {LEVELS.length * 3}</small></span>
        {@html ICON.edit}
      </button>
    {/if}
  </div>
</div>

<style>
  .titlescreen { position: fixed; inset: 0; padding: clamp(24px, 5vh, 64px) clamp(20px, 5vw, 72px); display: flex; flex-direction: column; justify-content: center; gap: clamp(24px, 5vh, 46px); }

  /* logo : lettres de bois peint, cernées d'encre, légèrement penchées */
  .logo { animation: rise 0.5s ease; transform: rotate(-3deg); transform-origin: left center; width: fit-content; }
  h1 { margin: 0; font-family: var(--font-logo); font-size: clamp(84px, 11vw, 138px); line-height: 0.92; text-transform: uppercase; color: var(--gold-fill);
    -webkit-text-stroke: 12px var(--ink); paint-order: stroke fill; text-shadow: 0 9px 0 var(--ink), 0 16px 0 var(--hue-shadow); }
  .sub { display: inline-block; margin: 10px 0 0 12px; padding: 5px 18px 7px; font-family: var(--font-display); font-size: clamp(18px, 2vw, 25px); color: #fff; transform: rotate(1.5deg);
    background: var(--toon-blue); border: var(--bw) solid var(--ink); border-radius: 12px; box-shadow: 0 5px 0 var(--ink); -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill; }

  .menu { display: flex; flex-direction: column; gap: 22px; width: min(450px, 100%); animation: rise 0.5s ease 0.05s both; }
  .row { position: relative; display: flex; align-items: center; gap: 14px; border: var(--bw) solid var(--ink); text-align: left; cursor: pointer; color: var(--ink);
    border-radius: var(--r); background: var(--toon-cream); box-shadow: var(--rim), var(--shadow); transition: transform 0.08s, box-shadow 0.08s, filter 0.12s; padding: 0; }
  .row:hover { filter: brightness(1.06) saturate(1.1); }
  .row:active { transform: translateY(4px); box-shadow: var(--rim), 0 0 0 var(--ink), 0 4px 0 var(--hue-shadow); }
  .lbl { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .lbl b { font-family: var(--font-display); font-weight: 400; font-size: 1.6em; line-height: 1; }
  .lbl span { font-size: 0.86em; font-weight: 900; }

  .row.main { min-height: 100px; padding: 0 20px 0 16px; background: var(--toon-gold); }
  .row.main .lbl b { font-size: 2.25em; }
  .row.main .lbl span { align-self: flex-start; background: var(--panel-hi); border: 2px solid var(--ink); border-radius: 99px; padding: 1px 10px; font-size: 0.93em; }
  .go { flex: none; width: 64px; height: 64px; display: grid; place-items: center; border-radius: 50%; border: var(--bw) solid var(--ink); background: var(--toon-red); box-shadow: 0 3px 0 var(--ink); color: #fff; }
  .go :global(.icon) { width: 28px; height: 28px; margin-left: 4px; fill: #fff; }

  .modes { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .modes .row { min-height: 76px; padding: 0 12px 0 82px; color: #fff; text-shadow: none; }
  .modes .row.surv { background: var(--toon-red); }
  .modes .row.coop { background: var(--toon-blue); }
  .modes .lbl b { -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill; font-size: 1.75em; }
  .modes .lbl span { color: rgba(255, 255, 255, 0.92); text-shadow: 0 2px 0 rgba(43, 26, 18, 0.5); }
  /* l'icône 3D déborde du bouton, comme un jouet posé dessus */
  .pop { position: absolute; left: 2px; top: -22px; width: 78px; height: 78px; display: grid; place-items: center; transform: rotate(-10deg); }
  .coop .pop { transform: rotate(8deg); }
  .pop :global(.ico3d) { width: 78px; height: 78px; filter: drop-shadow(0 3px 0 rgba(43, 26, 18, 0.5)); }
  .pop :global(svg.icon) { width: 40px; height: 40px; color: #fff; }

  .small { display: flex; justify-content: space-between; padding: 0 6px 22px; }
  .small button { position: relative; display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 0; border: 0; background: none; cursor: pointer; }
  .small i { display: grid; place-items: center; width: 74px; height: 74px; border-radius: 50%; border: var(--bw) solid var(--ink); background: var(--toon-cream); box-shadow: var(--rim), var(--shadow-sm); color: var(--ink); transition: transform 0.08s; }
  .small button:hover i { filter: brightness(1.06); transform: translateY(-2px); }
  .small button:active i { transform: translateY(3px); box-shadow: var(--rim); }
  .small span { font-family: var(--font-display); font-size: 15px; color: #fff; -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill; white-space: nowrap; }
  .small :global(svg.icon) { width: 32px; height: 32px; stroke-width: 2.4; }
  .small :global(.ico3d) { width: 48px; height: 48px; }

  /* profil : pastille crème, portrait qui déborde */
  .profile { position: absolute; top: calc(24px + var(--sat)); right: calc(26px + var(--sar)); display: flex; align-items: center; height: 62px; padding: 0 16px 0 74px;
    background: var(--toon-cream); border: var(--bw) solid var(--ink); border-radius: 99px; box-shadow: var(--rim), var(--shadow-sm); }
  .pp { position: absolute; left: -10px; top: -12px; width: 80px; height: 80px; border-radius: 50%; overflow: hidden; border: var(--bw) solid var(--ink); background: var(--toon-blue); box-shadow: 0 4px 0 var(--ink); }
  .pp img { width: 100%; height: 100%; display: block; }
  .who { display: flex; align-items: center; gap: 12px; border: 0; background: none; cursor: pointer; text-align: left; padding: 0; color: var(--ink); }
  .who b { display: block; font-family: var(--font-display); font-weight: 400; font-size: 1.4em; line-height: 1; }
  .who small { display: flex; align-items: center; gap: 3px; font-size: 0.9em; font-weight: 900; }
  .who small :global(.icon) { width: 20px; height: 20px; }
  .who > :global(.icon) { width: 20px; height: 20px; stroke-width: 2.6; }
  .profile input { width: 170px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

  /* ================= téléphone en portrait : logo en haut, scène 3D visible, menu compact en bas ================= */
  @media (max-width: 640px) {
    .titlescreen { justify-content: space-between; gap: 12px; padding: calc(78px + var(--sat)) 16px calc(14px + var(--sab)); }
    .logo { align-self: center; text-align: center; transform: rotate(-3deg); transform-origin: center; }
    h1 { font-size: clamp(60px, 19vw, 86px); -webkit-text-stroke-width: 9px; text-shadow: 0 6px 0 var(--ink), 0 11px 0 var(--hue-shadow); }
    .sub { margin: 6px 0 0; font-size: 15px; padding: 3px 12px 5px; }
    .menu { width: 100%; gap: 14px; }
    .row.main { min-height: 78px; padding: 0 14px 0 12px; gap: 12px; }
    .row.main .lbl b { font-size: 1.7em; }
    .row.main .lbl span { font-size: 0.82em; }
    .go { width: 50px; height: 50px; }
    .go :global(.icon) { width: 22px; height: 22px; }
    .modes { gap: 10px; }
    .modes .row { min-height: 58px; padding: 0 8px 0 56px; }
    .modes .lbl b { font-size: 1.3em; }
    .modes .lbl span { display: none; }
    .pop { width: 58px; height: 58px; top: -14px; left: 0; }
    .pop :global(.ico3d) { width: 58px; height: 58px; }
    .small { padding: 0 2px 20px; }
    .small i { width: 54px; height: 54px; }
    .small :global(svg.icon) { width: 26px; height: 26px; }
    .small :global(.ico3d) { width: 38px; height: 38px; }
    .small span { font-size: 12.5px; -webkit-text-stroke-width: 3.5px; }
    .profile { top: calc(12px + var(--sat)); right: 12px; height: 48px; padding: 0 12px 0 56px; }
    .pp { width: 60px; height: 60px; left: -6px; top: -9px; }
    .who b { font-size: 1.15em; }
    .who small { font-size: 0.8em; }
    .profile input { width: 140px; }
  }

  /* ================= téléphone en paysage : logo à gauche, menu en colonne à droite ================= */
  @media (max-height: 520px) and (min-width: 641px) {
    .titlescreen { flex-direction: row; justify-content: space-between; align-items: flex-end; padding: calc(12px + var(--sat)) calc(16px + var(--sar)) calc(10px + var(--sab)) calc(20px + var(--sal)); }
    .logo { align-self: flex-start; margin-top: 6px; }
    h1 { font-size: clamp(52px, 13vh, 78px); -webkit-text-stroke-width: 8px; text-shadow: 0 5px 0 var(--ink), 0 9px 0 var(--hue-shadow); }
    .sub { font-size: 14px; padding: 2px 12px 4px; margin-top: 6px; }
    .menu { width: min(350px, 44vw); gap: 10px; margin-top: 64px; }
    .row.main { min-height: 64px; padding: 0 12px 0 10px; gap: 10px; }
    .row.main .lbl b { font-size: 1.45em; }
    .row.main .lbl span { font-size: 0.78em; }
    .go { width: 42px; height: 42px; }
    .go :global(.icon) { width: 18px; height: 18px; }
    .modes { gap: 8px; }
    .modes .row { min-height: 48px; padding: 0 8px 0 48px; }
    .modes .lbl b { font-size: 1.15em; }
    .modes .lbl span { display: none; }
    .pop { width: 48px; height: 48px; top: -10px; left: 0; }
    .pop :global(.ico3d) { width: 48px; height: 48px; }
    .small { padding: 0 0 18px; }
    .small i { width: 44px; height: 44px; }
    .small :global(svg.icon) { width: 22px; height: 22px; }
    .small :global(.ico3d) { width: 32px; height: 32px; }
    .small span { font-size: 11px; -webkit-text-stroke-width: 3px; }
    .profile { top: calc(10px + var(--sat)); right: calc(12px + var(--sar)); height: 44px; padding: 0 12px 0 52px; }
    .pp { width: 54px; height: 54px; left: -6px; top: -8px; }
    .who b { font-size: 1.1em; }
  }
</style>
