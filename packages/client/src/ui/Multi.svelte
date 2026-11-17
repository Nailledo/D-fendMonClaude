<script lang="ts">
  import { ROOM_CODE_LEN } from '@dfend/shared';
  import { ICON } from './icons';
  import { audio } from '../audio/Audio';
  import { net } from '../net/Net';
  import { setName, ui } from '../state.svelte';

  let code = $state('');
  let name = $state(ui.name);
  function create() {
    audio.play('click');
    setName(name.trim() || 'Chevalier');
    net.name = ui.name;
    net.send({ t: 'create' });
  }
  function join() {
    const c = code.trim().toUpperCase();
    if (c.length !== ROOM_CODE_LEN) return;
    audio.play('click');
    setName(name.trim() || 'Chevalier');
    net.send({ t: 'join', code: c });
  }
</script>

<div class="wrap ui">
  <div class="panel box">
    <h2>Multijoueur</h2>
    <p class="status">
      Serveur :
      {#if ui.netStatus === 'open'}<b class="ok">connecté</b>{:else if ui.netStatus === 'connecting'}<b>connexion…</b>{:else}<b class="ko">hors ligne</b>{/if}
    </p>
    <label class="col">
      <span>Votre nom</span>
      <input type="text" maxlength="16" bind:value={name} />
    </label>
    <button class="btn gold big" onclick={create} disabled={ui.netStatus !== 'open'}>Créer un salon</button>
    <div class="sep"><span>ou rejoindre un salon</span></div>
    <div class="row">
      <input class="code" type="text" maxlength={ROOM_CODE_LEN} placeholder="CODE" bind:value={code} onkeydown={(e) => e.key === 'Enter' && join()} />
      <button class="btn" onclick={join} disabled={ui.netStatus !== 'open' || code.trim().length !== ROOM_CODE_LEN}>Rejoindre</button>
    </div>
    <p class="muted">Jusqu’à 4 joueurs en coopération. La difficulté s’adapte au nombre de joueurs.</p>
    <button class="btn ghost" onclick={() => (ui.screen = 'title')}>{@html ICON.back} Retour</button>
  </div>
</div>

<style>
  .wrap { position: fixed; inset: 0; display: grid; place-items: center; padding: 16px; background: rgba(12, 14, 16, 0.55); }
  .box { width: min(440px, 100%); display: flex; flex-direction: column; gap: 14px; padding: 22px; }
  h2 { margin: 0; font-size: 2.2em; }
  .status { margin: 0; color: var(--muted); }
  .ok { color: var(--good); }
  .ko { color: var(--bad); }
  .code { flex: 1; min-width: 0; text-transform: uppercase; letter-spacing: 0.3em; font-weight: 700; font-size: 1.3em; text-align: center; }
  .sep { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; }
  .sep::before, .sep::after { content: ''; flex: 1; height: 1px; background: rgba(243, 238, 226, 0.18); }
  .muted { color: var(--muted); font-size: 0.9em; margin: 0; }
  .col span { font-weight: 700; color: var(--muted); font-size: 0.9em; }
</style>
