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
    <button class="row" onclick={() => go('survival')}><b>Survie</b><span>Vagues sans fin, classement en ligne</span>{@html ICON.chev}</button>
    <button class="row" onclick={() => go('multi')}><b>Multijoueur</b><span>De 1 à 4 joueurs avec un code de salon</span>{@html ICON.users}</button>
    <div class="small">
      <button onclick={() => overlay('encyclo')}>{@html ICON.book}Encyclopédie</button>
      <button onclick={() => overlay('leaderboard')}>{@html ICON.trophy}Classement</button>
      <button onclick={() => overlay('help')}>{@html ICON.help}Aide</button>
      <button onclick={() => overlay('settings')}>{@html ICON.gear}Réglages</button>
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
    background: linear-gradient(135deg, transparent var(--cut), var(--panel) 0) left / 50.5% 100% no-repeat, linear-gradient(-45deg, transparent var(--cut), var(--panel) 0) right / 50.5% 100% no-repeat; }
  .row:hover { filter: brightness(1.15); }
  .row:active { transform: translateY(2px); }
  .row b { font-family: var(--font-display); font-size: 1.75em; line-height: 1; }
  .row span { grid-column: 1; font-size: 0.93em; color: var(--muted); }
  .row :global(.icon) { grid-row: 1 / span 2; grid-column: 2; width: 26px; height: 26px; color: var(--muted); }
  .row.main { color: var(--gold-ink);
    background: linear-gradient(135deg, transparent var(--cut), var(--gold) 0) left / 50.5% 100% no-repeat, linear-gradient(-45deg, transparent var(--cut), var(--gold) 0) right / 50.5% 100% no-repeat; }
  .row.main span, .row.main :global(.icon) { color: #4a3510; }
  .small { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 4px; }
  .small button { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px 4px; border: 0; cursor: pointer; font-size: 0.86em; font-weight: 700; color: var(--text);
    background: linear-gradient(135deg, transparent var(--cut-sm), var(--panel) 0) left / 50.5% 100% no-repeat, linear-gradient(-45deg, transparent var(--cut-sm), var(--panel) 0) right / 50.5% 100% no-repeat; }
  .small button:hover { filter: brightness(1.18); }
  .small :global(.icon) { width: 22px; height: 22px; color: var(--muted); }
  .profile { position: absolute; top: 16px; right: 16px; display: flex; align-items: center; gap: 10px; padding: 6px 12px 6px 6px; }
  .pp { width: 44px; height: 44px; background: #d9cfb8; overflow: hidden; flex: none; }
  .pp img { width: 100%; height: 100%; display: block; }
  .who { display: flex; align-items: center; gap: 12px; border: 0; background: none; cursor: pointer; text-align: left; padding: 0; color: var(--text); }
  .who b { display: block; font-size: 1.05em; }
  .who small { display: block; font-size: 0.8em; color: var(--muted); }
  .who :global(.icon) { color: var(--muted); }
  .profile input { width: 170px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  @media (max-width: 640px) {
    .titlescreen { justify-content: flex-end; padding-bottom: 24px; }
    .small { grid-template-columns: repeat(2, 1fr); }
  }
</style>
