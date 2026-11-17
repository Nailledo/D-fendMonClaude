<script lang="ts">
  import Ico from './Ico.svelte';
  import { ENEMIES, FAMILIES, HERO_IDS, TOWERS } from '@dfend/shared';
  import { progress, ui } from '../state.svelte';
  import { FAMILY_COLOR, FAMILY_NAME, ICON } from './icons';
  import { UPGRADE_ICON } from './skillIcons';
  import HeroSheet from './HeroSheet.svelte';

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
                <span class="cost"><Ico k="coin" fb={ICON.coin} /> {t.cost}</span>
                {#if t.skills}
                  <ul class="sk">
                    {#each t.skills as s}
                      <li><span class="ic"><Ico k={'up_' + s.id} fb={UPGRADE_ICON[s.id] ?? ''} /></span><span><b>{s.name}</b><span>{s.desc}</span></span></li>
                    {/each}
                  </ul>
                {/if}
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
        <div class="heroes">
          {#each HERO_IDS as h}<div class="hrow"><HeroSheet id={h} portrait /></div>{/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .box { width: min(1000px, 100%); height: min(88vh, 900px); display: flex; flex-direction: column; gap: 14px; }
  .head { display: flex; justify-content: space-between; align-items: center; }
  h2 { margin: 0; font-size: 2em; display: flex; align-items: center; gap: 10px; }
  h3 { margin: 16px 0 10px; font-size: 1.45em; display: flex; align-items: center; gap: 10px; }
  h3:first-child { margin-top: 2px; }
  h3::before { content: ''; width: 16px; height: 16px; border-radius: 50%; border: 2.5px solid var(--ink); background: var(--fc, var(--gold-fill)); }
  .body { flex: 1; padding: 2px 8px 8px 2px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; align-items: start; }
  .card { display: flex; flex-direction: column; gap: 5px; align-items: center; text-align: center; padding: 12px 10px; min-width: 0;
    background: var(--panel-hi); border: 2.5px solid var(--ink); border-radius: var(--r-sm); box-shadow: 0 3px 0 var(--ink); overflow-wrap: anywhere; }
  .card img { width: 92px; height: 92px; background: linear-gradient(180deg, #a9d3f2 0 55%, #7cc242 55%); border: 2.5px solid var(--ink); border-radius: 50%; }
  .card > b { font-weight: 900; font-size: 1.02em; line-height: 1.2; }
  .card.unknown img { filter: brightness(0) opacity(0.5); }
  .small { font-size: 0.84em; font-weight: 700; color: var(--muted); line-height: 1.35; }
  .cost { font-family: var(--font-display); font-size: 1.1em; color: #a05f00; display: inline-flex; align-items: center; gap: 4px; font-variant-numeric: tabular-nums; }
  .cost :global(.icon) { margin: 0; vertical-align: 0; }
  /* compétences des spécialisations : une ligne par compétence, icône alignée à gauche */
  .sk { list-style: none; margin: 4px 0 0; padding: 8px 0 0; border-top: 2px dashed var(--ink-soft); width: 100%; display: flex; flex-direction: column; gap: 8px; text-align: left; }
  .sk li { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 8px; align-items: start; font-size: 0.82em; line-height: 1.3; }
  .sk li > span:last-child { display: flex; flex-direction: column; }
  .sk b { font-weight: 900; color: var(--text); }
  .sk li > span:last-child > span { color: var(--muted); font-weight: 700; }
  .ic { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; background: var(--ink); overflow: hidden; }
  .ic :global(.icon) { width: 30px; height: 30px; margin: 0; vertical-align: 0; }
  .ic :global(svg.icon) { width: 18px; height: 18px; color: #fff; }
  .heroes { display: flex; flex-direction: column; gap: 12px; }
  .hrow { padding: 14px; background: var(--panel-hi); border: 2.5px solid var(--ink); border-radius: var(--r); box-shadow: 0 3px 0 var(--ink); }
</style>
