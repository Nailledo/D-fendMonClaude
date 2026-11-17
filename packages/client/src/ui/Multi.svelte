<script lang="ts">
  import { ROOM_CODE_LEN } from '@dfend/shared';
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
    <div class="sep">ou</div>
    <div class="row">
      <input class="code" type="text" maxlength={ROOM_CODE_LEN} placeholder="CODE" bind:value={code} onkeydown={(e) => e.key === 'Enter' && join()} />
      <button class="btn" onclick={join} disabled={ui.netStatus !== 'open' || code.trim().length !== ROOM_CODE_LEN}>Rejoindre</button>
    </div>
    <p class="muted">Jusqu’à 4 joueurs en coopération. La difficulté s’adapte au nombre de joueurs.</p>
    <button class="btn ghost" onclick={() => (ui.screen = 'title')}>Retour</button>
  </div>
</div>

<style>
  .wrap { position: fixed; inset: 0; display: grid; place-items: center; padding: 16px; background: rgba(20, 12, 6, 0.45); }
  .box { width: min(420px, 100%); display: flex; flex-direction: column; gap: 12px; }
  h2 { margin: 0; }
  .status { margin: 0; }
  .ok { color: #2e7d32; }
  .ko { color: var(--red); }
  .code { flex: 1; text-transform: uppercase; letter-spacing: 0.3em; font-weight: 800; font-size: 1.2em; text-align: center; }
  .sep { text-align: center; font-weight: 800; color: #8a6a40; }
  .muted { color: #7a6040; font-size: 0.88em; margin: 0; }
  .col span { font-weight: 700; }
</style>
