<script lang="ts">
  import { audio } from '../audio/Audio';
  import { app } from '../app';
  import { progress, setName, ui } from '../state.svelte';
  import { ICON } from './icons';

  let name = $state(ui.name);
  function go(screen: typeof ui.screen) {
    audio.unlock();
    audio.play('click');
    if (name.trim()) setName(name.trim());
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
</script>

<div class="title ui">
  <div class="logo">
    <div class="crest">{@html ICON.shield}</div>
    <h1>D-Fend</h1>
    <p class="sub">La Quête de Samuel</p>
  </div>

  <div class="menu wood">
    <label class="name">
      <span>Votre nom</span>
      <input type="text" maxlength="16" placeholder="Samuel" bind:value={name} onchange={() => setName(name.trim())} />
    </label>
    <button class="btn gold big" onclick={() => go('story')}>
      Histoire {#if progress.unlocked > 0}<span class="tag">Niveau {progress.unlocked + 1}</span>{/if}
    </button>
    <button class="btn big" onclick={() => go('survival')}>Survie</button>
    <button class="btn big" onclick={() => go('multi')}>{@html ICON.users} Multijoueur</button>
    <div class="row small">
      <button class="btn ghost" onclick={() => overlay('encyclo')}>{@html ICON.book} Encyclopédie</button>
      <button class="btn ghost" onclick={() => overlay('leaderboard')}>{@html ICON.trophy} Classement</button>
    </div>
    <div class="row small">
      <button class="btn ghost" onclick={() => overlay('help')}>Comment jouer</button>
      <button class="btn ghost" onclick={() => overlay('settings')}>{@html ICON.gear} Paramètres</button>
    </div>
  </div>
  <p class="credit">Tout est modélisé, dessiné et composé en code. Aucune image générée.</p>
</div>

<style>
  .title {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 26px;
    padding: 16px;
    background: radial-gradient(ellipse at center, transparent 30%, rgba(10, 6, 3, 0.55));
  }
  .logo { text-align: center; animation: pop 0.6s ease; }
  .crest { font-size: 54px; filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.6)); }
  h1 {
    margin: 0;
    font-size: clamp(56px, 11vw, 120px);
    font-weight: 800;
    line-height: 0.95;
    background: linear-gradient(180deg, #fff3c4 0%, #f2c14e 45%, #b9770e 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 3px 0 #4a2a0a) drop-shadow(0 8px 16px rgba(0, 0, 0, 0.6));
  }
  .sub {
    margin: 6px 0 0;
    font-family: 'Cinzel', serif;
    font-size: clamp(18px, 3vw, 28px);
    color: #fff3d6;
    text-shadow: 0 2px 6px #000;
    letter-spacing: 0.08em;
  }
  .menu {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    width: min(360px, 100%);
    animation: rise 0.5s ease;
  }
  .menu .btn { width: 100%; display: flex; justify-content: center; gap: 8px; align-items: center; }
  .row.small .btn { font-size: 0.85em; padding: 8px 6px; }
  .name { display: flex; flex-direction: column; gap: 4px; font-weight: 700; color: var(--muted); }
  .tag { font-family: 'Nunito', sans-serif; font-size: 0.65em; background: rgba(0, 0, 0, 0.2); padding: 2px 8px; border-radius: 99px; }
  .credit { margin: 0; font-size: 0.8em; color: #f3e3bf; text-shadow: 0 1px 3px #000; opacity: 0.85; text-align: center; }
</style>
