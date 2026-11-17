<script lang="ts">
  import { ENEMIES, FAMILIES, HEROES, HERO_IDS, TOWERS } from '@dfend/shared';
  import { progress, ui } from '../state.svelte';
  import { FAMILY_COLOR, FAMILY_NAME, ICON } from './icons';

  let tab = $state<'towers' | 'enemies' | 'heroes'>('towers');
  const enemies = ENEMIES.filter((e) => !e.spawnOnly || e.boss);
</script>

<div class="overlay-bg">
  <div class="panel box">
    <div class="head">
      <h2>{@html ICON.book} Encyclopédie</h2>
      <button class="btn small" onclick={() => (ui.overlay = null)}>Fermer</button>
    </div>
    <div class="seg">
      <button class:on={tab === 'towers'} onclick={() => (tab = 'towers')}>Tours</button>
      <button class:on={tab === 'enemies'} onclick={() => (tab = 'enemies')}>Ennemis ({progress.seen.length})</button>
      <button class:on={tab === 'heroes'} onclick={() => (tab = 'heroes')}>Héros</button>
    </div>
    <div class="body scroll">
      {#if tab === 'towers'}
        {#each FAMILIES as f, fi}
          <h3 style="--fc:{FAMILY_COLOR[fi]}">{FAMILY_NAME[fi]}</h3>
          <div class="grid">
            {#each TOWERS[f] as t, l}
              <div class="card">
                {#if ui.portraits[`t_${fi}_${l}`]}<img src={ui.portraits[`t_${fi}_${l}`]} alt="" />{/if}
                <b>{t.name}</b>
                <span class="small">{t.desc}</span>
                <span class="cost">{@html ICON.coin} {t.cost}</span>
                {#if t.skills}<span class="small"><i>Compétences : {t.skills.map((s) => s.name).join(', ')}</i></span>{/if}
              </div>
            {/each}
          </div>
        {/each}
      {:else if tab === 'enemies'}
        <div class="grid">
          {#each enemies as e}
            {@const known = progress.seen.includes(e.id)}
            <div class="card" class:unknown={!known}>
              {#if ui.portraits['e_' + e.id]}<img src={ui.portraits['e_' + e.id]} alt="" />{/if}
              <b>{known ? e.name : '???'}</b>
              <span class="small">{known ? e.desc : 'Pas encore rencontré.'}</span>
              {#if known}
                <span class="small">PV {e.hp} · Armure {Math.round(e.armor * 100)} % · Magie {Math.round(e.mres * 100)} %{e.flying ? ' · Volant' : ''}</span>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="grid">
          {#each HERO_IDS as h}
            {@const d = HEROES[h]}
            <div class="card">
              {#if ui.portraits['full_' + h]}<img src={ui.portraits['full_' + h]} alt="" />{/if}
              <b>{d.name}</b><span class="small"><i>{d.title}</i></span>
              <span class="small">{d.desc}</span>
              <span class="small"><b>{d.passive.name}</b> : {d.passive.desc}</span>
              {#each d.skills as s}<span class="small"><b>{s.name}</b> : {s.desc}</span>{/each}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .box { width: min(1000px, 100%); height: min(88vh, 900px); display: flex; flex-direction: column; gap: 14px; }
  .head { display: flex; justify-content: space-between; align-items: center; }
  h2 { margin: 0; font-size: 2em; display: flex; align-items: center; gap: 10px; }
  h3 { margin: 14px 0 8px; font-size: 1.45em; display: flex; align-items: center; gap: 10px; }
  h3::before { content: ''; width: 14px; height: 14px; background: var(--fc, var(--gold)); }
  .body { flex: 1; padding-right: 6px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(176px, 1fr)); gap: 8px; }
  .card { display: flex; flex-direction: column; gap: 4px; align-items: center; text-align: center; padding: 10px; background: var(--raised); }
  .card img { width: 96px; height: 96px; background: #d9cfb8; clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px); }
  .card b { font-size: 1.02em; }
  .card.unknown img { filter: brightness(0) opacity(0.5); }
  .small { font-size: 0.83em; color: var(--muted); line-height: 1.35; }
  .small b { color: var(--text); }
  .cost { font-weight: 700; color: var(--gold); display: inline-flex; align-items: center; gap: 4px; font-variant-numeric: tabular-nums; }
</style>
