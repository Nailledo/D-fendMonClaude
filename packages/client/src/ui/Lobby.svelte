<script lang="ts">
  import { DIFFICULTY_NAMES, HEROES, LEVELS, MAPS, PLAYER_COLORS, SURVIVAL_MAPS, type Difficulty, type HeroId, type Mode } from '@dfend/shared';
  import { audio } from '../audio/Audio';
  import { net } from '../net/Net';
  import { progress, setHero, toast, ui } from '../state.svelte';
  import Chat from './Chat.svelte';
  import HeroPicker from './HeroPicker.svelte';

  const room = $derived(ui.room);
  const me = $derived(room?.players.find((p) => p.id === room.you));
  const isHost = $derived(!!me?.host);
  const allReady = $derived(!!room && room.players.every((p) => p.ready || p.host));
  const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

  function setSettings(mode: Mode, mapId: string, difficulty: Difficulty) {
    net.send({ t: 'settings', settings: { mode, mapId, difficulty } });
  }
  function pickHero(h: HeroId) {
    setHero(h);
    net.send({ t: 'hero', hero: h });
  }
  function copy() {
    if (!room) return;
    navigator.clipboard?.writeText(room.code).then(() => toast('Code copié !', 'good', 1200)).catch(() => {});
  }
  // le héros choisi localement est envoyé à l'arrivée dans le salon
  let sent = false;
  $effect(() => {
    if (room && !sent) {
      sent = true;
      net.send({ t: 'hero', hero: ui.hero });
    }
  });
</script>

{#if room}
  <div class="wrap ui">
    <div class="panel main">
      <div class="head">
        <h2>Salon</h2>
        <button class="code" onclick={copy} title="Copier le code">{room.code}</button>
      </div>
      <p class="muted">Partagez ce code avec vos amis (jusqu’à 4 joueurs).</p>
      <div class="players">
        {#each room.players as p}
          <div class="pl" style="--c:{hex(PLAYER_COLORS[p.id] ?? 0xffffff)}">
            {#if ui.portraits[p.hero]}<img src={ui.portraits[p.hero]} alt="" />{/if}
            <div class="grow">
              <b>{p.name}</b> {#if p.host}<span class="tag">Hôte</span>{/if}
              <div class="small">{HEROES[p.hero].name}{#if !p.connected} · <i>déconnecté</i>{/if}</div>
            </div>
            <span class="rdy" class:ok={p.ready || p.host}>{p.host ? '★' : p.ready ? 'Prêt' : '…'}</span>
          </div>
        {/each}
        {#each Array(4 - room.players.length) as _}
          <div class="pl empty">Place libre</div>
        {/each}
      </div>

      <h3>Partie</h3>
      <div class="settings">
        <div class="row">
          {#each [['story', 'Histoire'], ['survival', 'Survie']] as [m, label]}
            <button class="btn small" class:gold={room.settings.mode === m} disabled={!isHost}
              onclick={() => setSettings(m as Mode, m === 'story' ? LEVELS[0].mapId : SURVIVAL_MAPS[0], room.settings.difficulty)}>{label}</button>
          {/each}
        </div>
        <select disabled={!isHost} value={room.settings.mapId} onchange={(e) => setSettings(room.settings.mode, (e.target as HTMLSelectElement).value, room.settings.difficulty)}>
          {#if room.settings.mode === 'story'}
            {#each LEVELS as l, i}
              <option value={l.mapId} disabled={isHost && i > progress.unlocked}>{i + 1}. {l.name}{isHost && i > progress.unlocked ? ' (verrouillé)' : ''}</option>
            {/each}
          {:else}
            {#each SURVIVAL_MAPS as m}<option value={m}>{MAPS[m].name}</option>{/each}
          {/if}
        </select>
        <div class="row">
          {#each DIFFICULTY_NAMES as d, i}
            <button class="btn small" class:gold={room.settings.difficulty === i} disabled={!isHost} onclick={() => setSettings(room.settings.mode, room.settings.mapId, i as Difficulty)}>{d}</button>
          {/each}
        </div>
      </div>

      <div class="row actions">
        {#if isHost}
          <button class="btn gold big grow" disabled={!allReady} onclick={() => { audio.play('click'); net.send({ t: 'start' }); }}>
            {allReady ? 'Lancer la partie' : 'En attente des joueurs…'}
          </button>
        {:else}
          <button class="btn big grow" class:green={me?.ready} onclick={() => net.send({ t: 'ready', ready: !me?.ready })}>
            {me?.ready ? 'Prêt !' : 'Je suis prêt'}
          </button>
        {/if}
        <button class="btn red" onclick={() => { net.send({ t: 'leave' }); ui.room = null; ui.screen = 'multi'; }}>Quitter</button>
      </div>
    </div>
    <div class="side">
      <div class="panel"><h3>Votre héros</h3><HeroPicker value={me?.hero ?? ui.hero} onpick={pickHero} /></div>
      <div class="chatbox"><Chat inline /></div>
    </div>
  </div>
{/if}

<style>
  .wrap { position: fixed; inset: 0; display: grid; grid-template-columns: minmax(0, 560px) minmax(0, 420px); justify-content: center; gap: 16px; padding: 20px 16px; overflow: auto; background: rgba(20, 12, 6, 0.5); }
  .main { display: flex; flex-direction: column; gap: 10px; }
  .side { display: flex; flex-direction: column; gap: 12px; }
  .head { display: flex; align-items: center; justify-content: space-between; }
  h2, h3 { margin: 0; }
  .code { cursor: pointer; font-family: 'Cinzel', serif; font-weight: 800; font-size: 1.8em; letter-spacing: 0.25em; padding: 4px 14px; border-radius: 10px; border: 3px dashed var(--wood); background: #fffaf0; color: var(--ink); }
  .muted { color: #7a6040; margin: 0; font-size: 0.88em; }
  .players { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .pl { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 10px; background: rgba(0, 0, 0, 0.08); border-left: 6px solid var(--c); }
  .pl img { width: 44px; height: 44px; }
  .pl.empty { justify-content: center; color: #9a8060; border-left-color: transparent; border: 2px dashed rgba(90, 58, 34, 0.3); min-height: 56px; }
  .small { font-size: 0.8em; color: #7a6040; }
  .tag { font-size: 0.7em; background: var(--gold-2); color: #3a2208; padding: 1px 6px; border-radius: 99px; font-weight: 800; }
  .rdy { font-weight: 800; color: #9a8060; }
  .rdy.ok { color: #2e7d32; }
  .settings { display: flex; flex-direction: column; gap: 8px; }
  .actions { margin-top: 6px; }
  .chatbox { min-height: 220px; display: flex; }
  @media (max-width: 960px) { .wrap { grid-template-columns: 1fr; } .players { grid-template-columns: 1fr; } }
</style>
