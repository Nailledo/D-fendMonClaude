<script lang="ts">
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
    <button class="row main" onclick={() => go('story')}><b>{storyLabel}</b><span>{storySub}</span>{@html ICON.chev}</button>
    <div class="modes">
      <button class="row" onclick={() => go('survival')}><b>Survie</b><span>Vagues sans fin, classement en ligne</span>{@html ICON.horn}</button>
      <button class="row" onclick={() => go('multi')}><b>Multijoueur</b><span>De 1 à 4 joueurs avec un code de salon</span>{@html ICON.users}</button>
    </div>
    <div class="small">
      <button onclick={() => overlay('encyclo')}><i>{@html ICON.book}</i><span>Encyclopédie</span></button>
      <button onclick={() => overlay('leaderboard')}><i>{@html ICON.trophy}</i><span>Classement</span></button>
      <button onclick={() => overlay('help')}><i>{@html ICON.help}</i><span>Aide</span></button>
      <button onclick={() => overlay('settings')}><i>{@html ICON.gear}</i><span>Réglages</span></button>
    </div>
  </nav>

  <div class="profile panel">
    <div class="pp">{#if ui.portraits[ui.hero]}<img src={ui.portraits[ui.hero]} alt="" />{/if}</div>
    {#if editing}
      <form onsubmit={(e) => { e.preventDefault(); commit(); }}>
        <label class="sr" for="pname">Votre nom</label>
        <input id="pname" bind:this={input} type="text" maxlength="16" placeholder="Votre nom" bind:value={name} onblur={commit} onkeydown={(e) => e.key === 'Escape' && (editing = false)} />
      </form>
    {:else}
      <button class="who" onclick={edit} aria-label="Modifier votre nom">
        <span><b>{ui.name || 'Choisir un nom'}</b><small>{stars} ★ sur {LEVELS.length * 3}</small></span>
        {@html ICON.edit}
      </button>
    {/if}
  </div>
</div>

<style>
  .titlescreen { position: fixed; inset: 0; padding: clamp(24px, 6vh, 72px) clamp(20px, 6vw, 80px); display: flex; flex-direction: column; justify-content: center; gap: clamp(20px, 5vh, 44px); }
  .logo { animation: rise 0.5s ease; filter: drop-shadow(0 5px 0 rgba(8, 10, 12, 0.65)); }
  h1 { margin: 0; font-family: var(--font-logo); font-size: clamp(76px, 12vw, 144px); line-height: 0.88; color: var(--text); }
  .sub { margin: 6px 0 0 6px; font-family: var(--font-display); font-weight: 700; font-size: clamp(18px, 2.4vw, 27px); letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold); }
  .menu { display: flex; flex-direction: column; gap: 10px; width: min(430px, 100%); animation: rise 0.5s ease 0.05s both; filter: var(--drop); }
  .row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 3px 14px; padding: 13px 18px; border: 0; text-align: left; cursor: pointer; color: var(--text);
    background: var(--panel); border-radius: var(--r); }
  .row:hover { filter: brightness(1.15); }
  .row:active { transform: translateY(2px); }
  .row b { font-family: var(--font-display); font-size: 1.75em; line-height: 1; }
  .row span { grid-column: 1; font-size: 0.93em; color: var(--muted); }
  .row :global(.icon) { grid-row: 1 / span 2; grid-column: 2; width: 26px; height: 26px; color: var(--muted); }
  .row.main { color: var(--gold-ink);
    background: var(--gold); border-radius: var(--r); }
  .row.main span, .row.main :global(.icon) { color: #4a3510; }
  .small { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 4px; }
  .small button { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px 4px; border: 0; cursor: pointer; font-size: 0.86em; font-weight: 700; color: var(--text);
    background: var(--panel); border-radius: var(--r-sm); }
  .small button:hover { filter: brightness(1.18); }
  .small :global(.icon) { width: 22px; height: 22px; color: var(--muted); }
  .small i { display: contents; }
  .modes { display: flex; flex-direction: column; gap: 10px; }
  .profile { position: absolute; top: 16px; right: 16px; display: flex; align-items: center; gap: 10px; padding: 6px 12px 6px 6px; }
  .pp { width: 44px; height: 44px; background: #d9cfb8; overflow: hidden; flex: none; border-radius: var(--r-sm); }
  .pp img { width: 100%; height: 100%; display: block; }
  .who { display: flex; align-items: center; gap: 12px; border: 0; background: none; cursor: pointer; text-align: left; padding: 0; color: var(--text); }
  .who b { display: block; font-size: 1.05em; }
  .who small { display: block; font-size: 0.8em; color: var(--muted); }
  .who :global(.icon) { color: var(--muted); }
  .profile input { width: 170px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .profile { border-radius: 99px; }

  /* ================= téléphone en portrait : logo en haut, scène 3D visible, menu compact en bas ================= */
  @media (max-width: 640px) {
    .titlescreen { justify-content: space-between; gap: 12px; padding: calc(64px + var(--sat)) 16px calc(16px + var(--sab)); }
    .logo { text-align: center; filter: drop-shadow(0 2px 0 rgba(8, 10, 12, 0.7)) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35)); }
    h1 { font-size: clamp(54px, 17vw, 76px); }
    .sub { margin: 4px 0 0; font-size: 13px; letter-spacing: 0.2em; }
    .menu { width: 100%; gap: 8px; filter: none; }
    .row { padding: 10px 16px; box-shadow: var(--rim), var(--shadow-sm); }
    .row.main { padding: 14px 18px; box-shadow: 0 3px 0 #9c6c14, 0 8px 20px rgba(0, 0, 0, 0.3); }
    .row.main b { font-size: 1.55em; }
    .row.main span { font-size: 0.85em; }
    .modes { flex-direction: row; gap: 8px; }
    .modes .row { flex: 1; grid-template-columns: auto 1fr; padding: 10px 12px; gap: 8px; }
    .modes .row b { font-size: 1.2em; grid-column: 2; grid-row: 1; }
    .modes .row span { display: none; }
    .modes .row :global(.icon) { grid-column: 1; grid-row: 1; width: 22px; height: 22px; color: var(--gold); }
    .small { display: flex; justify-content: space-around; gap: 4px; margin-top: 2px; }
    .small button { background: none; padding: 2px; gap: 4px; font-size: 11px; font-weight: 700; color: var(--text); text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8); }
    .small i { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: var(--panel); box-shadow: var(--rim), var(--shadow-sm); }
    .small :global(.icon) { width: 22px; height: 22px; color: var(--text); }
    .profile { top: calc(10px + var(--sat)); right: 12px; padding: 4px 12px 4px 4px; gap: 8px; }
    .pp { width: 36px; height: 36px; border-radius: 50%; }
    .who b { font-size: 0.95em; }
    .who small { font-size: 0.75em; }
    .profile input { width: 140px; }
  }

  /* ================= téléphone en paysage : logo à gauche, menu en colonne à droite ================= */
  @media (max-height: 520px) and (min-width: 641px) {
    .titlescreen { flex-direction: row; justify-content: space-between; align-items: flex-end; padding: calc(12px + var(--sat)) calc(16px + var(--sar)) calc(12px + var(--sab)) calc(20px + var(--sal)); }
    .logo { align-self: flex-start; filter: drop-shadow(0 2px 0 rgba(8, 10, 12, 0.7)) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35)); }
    h1 { font-size: clamp(48px, 11vh, 72px); }
    .sub { font-size: 13px; letter-spacing: 0.18em; }
    .menu { width: min(330px, 42vw); gap: 6px; margin-top: 52px; }
    .row { padding: 8px 14px; }
    .row b { font-size: 1.3em; }
    .row span { font-size: 0.8em; }
    .row.main b { font-size: 1.45em; }
    .modes { flex-direction: row; gap: 6px; }
    .modes .row { flex: 1; grid-template-columns: auto 1fr; gap: 8px; padding: 8px 10px; }
    .modes .row b { font-size: 1.1em; grid-column: 2; grid-row: 1; }
    .modes .row span { display: none; }
    .modes .row :global(.icon) { grid-column: 1; grid-row: 1; width: 20px; height: 20px; color: var(--gold); }
    .small { display: flex; justify-content: space-between; gap: 4px; margin-top: 0; }
    .small button { flex: 1; padding: 6px 2px; font-size: 10.5px; gap: 3px; }
    .small :global(.icon) { width: 18px; height: 18px; }
    .profile { top: calc(10px + var(--sat)); right: calc(12px + var(--sar)); padding: 4px 12px 4px 4px; }
    .pp { width: 34px; height: 34px; border-radius: 50%; }
  }
</style>
