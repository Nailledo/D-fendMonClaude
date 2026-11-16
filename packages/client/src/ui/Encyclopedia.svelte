<script lang="ts">
  import { ENEMIES, FAMILIES, HEROES, HERO_IDS, TOWERS } from '@dfend/shared';
  import { progress, ui } from '../state.svelte';
  import { FAMILY_NAME, ICON } from './icons';
  import { PASSIVE_ICON, SKILL_ICON, UPGRADE_ICON } from './skillIcons';

  let tab = $state<'towers' | 'enemies' | 'heroes'>('towers');
  const enemies = ENEMIES.filter((e) => !e.spawnOnly || e.boss);
</script>

<div class="overlay-bg">
  <div class="panel box">
    <div class="head">
      <h2>{@html ICON.book} Encyclopédie</h2>
      <button class="btn small" onclick={() => (ui.overlay = null)}>Fermer</button>
    </div>
    <div class="row">
      <button class="btn small" class:gold={tab === 'towers'} onclick={() => (tab = 'towers')}>Tours</button>
      <button class="btn small" class:gold={tab === 'enemies'} onclick={() => (tab = 'enemies')}>Ennemis ({progress.seen.length})</button>
      <button class="btn small" class:gold={tab === 'heroes'} onclick={() => (tab = 'heroes')}>Héros</button>
    </div>
    <div class="body scroll">
      {#if tab === 'towers'}
        {#each FAMILIES as f, fi}
          <h3>{FAMILY_NAME[fi]}</h3>
          <div class="grid">
            {#each TOWERS[f] as t, l}
              <div class="card">
                {#if ui.portraits[`t_${fi}_${l}`]}<img src={ui.portraits[`t_${fi}_${l}`]} alt="" />{/if}
                <b>{t.name}</b>
                <span class="small">{t.desc}</span>
                <span class="cost">{@html ICON.coin} {t.cost}</span>
                {#if t.skills}{#each t.skills as s}<span class="small">{@html UPGRADE_ICON[s.id] ?? ''} <b>{s.name}</b> : {s.desc}</span>{/each}{/if}
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
              <span class="small">{@html PASSIVE_ICON[h] ?? ''} <b>{d.passive.name}</b> : {d.passive.desc}</span>
              {#each d.skills as s, i}<span class="small">{@html SKILL_ICON[h]?.[i] ?? ''} <b>{s.name}</b> : {s.desc}</span>{/each}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .box { width: min(980px, 100%); height: min(86vh, 900px); display: flex; flex-direction: column; gap: 10px; }
  .head { display: flex; justify-content: space-between; align-items: center; }
  h2, h3 { margin: 0; }
  h3 { margin-top: 8px; }
  .body { flex: 1; padding-right: 6px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
  .card { display: flex; flex-direction: column; gap: 3px; align-items: center; text-align: center; padding: 8px; border-radius: 10px; background: rgba(0, 0, 0, 0.07); }
  .card img { width: 96px; height: 96px; }
  .card.unknown img { filter: brightness(0) opacity(0.45); }
  .small { font-size: 0.8em; color: #5b4128; }
  .small :global(svg.icon) { width: 1.7em; height: 1.7em; vertical-align: -0.55em; }
  .cost { font-weight: 800; }
</style>
