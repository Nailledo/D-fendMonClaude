<script lang="ts">
  import { loadout } from '../meta';
  import { CLASSES, DIFFICULTY_NAMES, SPELLS, HEROES, LEVELS, MAPS, PLAYER_COLORS, SURVIVAL_MAPS, type Difficulty, type HeroId, type Mode } from '@dfend/shared';
  import { audio } from '../audio/Audio';
  import { net } from '../net/Net';
  import { progress, setHero, toast, ui } from '../state.svelte';
  import Chat from './Chat.svelte';
  import HeroPicker from './HeroPicker.svelte';
  import HeroBadge from './HeroBadge.svelte';
  import SpellPicker from './SpellPicker.svelte';
  import Ico from './Ico.svelte';
  import { spellFb, spellKey } from './spellIcon';

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
      // arbre de compétences et objets emportés dans la partie
      net.send({ t: 'meta', ...loadout() });
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
              <b>{p.name}</b>
              <div class="small">{HEROES[p.hero].title} · {CLASSES[p.cls ?? -1]?.name ?? 'Aventurier'}{#if !p.connected} · <i>déconnecté</i>{/if}</div>
            </div>
            <span class="sps" title="{SPELLS[p.spells[0]].name} · {SPELLS[p.spells[1]].name}">{#each p.spells as sp}<Ico k={spellKey(sp)} fb={spellFb(sp)} />{/each}</span>
            <span class="rdy" class:ok={p.ready || p.host}>{p.host ? 'Hôte' : p.ready ? 'Prêt' : 'Pas prêt'}</span>
          </div>
        {/each}
        {#each Array(4 - room.players.length) as _}
          <div class="pl empty">Place libre</div>
        {/each}
      </div>

      <h3>Partie</h3>
      <div class="settings">
        <div class="seg">
          {#each [['story', 'Histoire'], ['survival', 'Survie']] as [m, label]}
            <button class:on={room.settings.mode === m} disabled={!isHost}
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
        <div class="seg">
          {#each DIFFICULTY_NAMES as d, i}
            <button class:on={room.settings.difficulty === i} disabled={!isHost} onclick={() => setSettings(room.settings.mode, room.settings.mapId, i as Difficulty)}>{d}</button>
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
      <div class="panel"><h3>Votre héros</h3><HeroPicker value={me?.hero ?? ui.hero} onpick={pickHero} compact /><div class="hb"><HeroBadge /></div></div>
      <div class="panel"><h3>Vos sorts</h3><SpellPicker compact onchange={() => net.send({ t: 'meta', ...loadout() })} /></div>
      <div class="chatbox"><Chat inline /></div>
    </div>
  </div>
{/if}

<style>
  .wrap { position: fixed; inset: 0; display: grid; grid-template-columns: minmax(0, 580px) minmax(0, 420px); justify-content: center; align-content: start; gap: 16px; padding: 24px 16px; overflow: auto; background: rgba(43, 26, 18, 0.45); }
  .main { display: flex; flex-direction: column; gap: 12px; padding: 22px; }
  .side { display: flex; flex-direction: column; gap: 12px; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  h2 { margin: 0; font-size: 2.2em; }
  h3 { margin: 6px 0 0; font-size: 1.35em; }
  .code { cursor: pointer; font-family: var(--font-ui); font-weight: 700; font-size: 1.6em; letter-spacing: 0.22em; padding: 6px 12px 6px 16px; border: 3px dashed var(--ink); border-radius: var(--r-sm); background: var(--panel-hi); color: var(--gold); font-variant-numeric: tabular-nums; }
  .code:hover { background: var(--raised); }
  .muted { color: var(--muted); margin: 0; font-size: 0.9em; }
  .players { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .pl { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--toon-cream); border: 2.5px solid var(--ink); border-radius: var(--r-sm); box-shadow: inset 8px 0 0 var(--c), 0 3px 0 var(--ink); min-width: 0; }
  .pl img { width: 46px; height: 46px; background: #a9d3f2; border: 2px solid var(--ink); border-radius: 50%; flex: none; }
  .pl b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
  .pl.empty { justify-content: center; color: var(--faint); box-shadow: none; background: transparent; outline: 1px dashed rgba(43, 26, 18, 0.2); outline-offset: -1px; min-height: 62px; }
  .small { font-size: 0.82em; color: var(--muted); }
  .rdy { font-weight: 700; font-size: 0.82em; color: var(--faint); white-space: nowrap; }
  .rdy.ok { color: var(--good); }
  .settings { display: flex; flex-direction: column; gap: 8px; }
  .actions { margin-top: 8px; }
  .chatbox { min-height: 240px; display: flex; }
  @media (max-width: 960px) { .wrap { grid-template-columns: 1fr; } .players { grid-template-columns: 1fr; } }
  .hb { margin-top: 10px; }
  .sps { display: flex; gap: 2px; flex: none; }
  .sps :global(.ico3d) { width: 28px; height: 28px; margin: 0; vertical-align: 0; }
  .sps :global(.icon) { width: 20px; height: 20px; }
</style>
