<script lang="ts">
  import { LEVELS, SPELLS } from '@dfend/shared';
  import { audio } from '../audio/Audio';
  import { chosenSpells, pickSpell, unlockedSpells } from '../meta';
  import { progress } from '../state.svelte';
  import Ico from './Ico.svelte';
  import { spellFb, spellKey } from './spellIcon';

  /** Choix des deux sorts généraux : on arme un emplacement, puis on clique un sort obtenu. */
  let { onchange, compact = false }: { onchange?: () => void; compact?: boolean } = $props();
  let slot = $state<0 | 1>(0);
  const chosen = $derived((progress.spells, progress.stars, chosenSpells()));
  const open = $derived((progress.stars, unlockedSpells()));

  function pick(i: number) {
    if (!pickSpell(slot, i)) { audio.play('deny'); return; }
    audio.play('click');
    // l'emplacement suivant est armé : deux clics suffisent pour refaire tout le choix
    slot = slot === 0 ? 1 : 0;
    onchange?.();
  }
  const cond = (i: number) => {
    const lv = SPELLS[i].unlock;
    return lv < 0 ? 'Disponible' : `Terminer : ${LEVELS[lv]?.name ?? `niveau ${lv + 1}`}`;
  };
</script>

<div class="sp" class:compact>
  <div class="slots">
    {#each [0, 1] as s}
      <button class="slot" class:on={slot === s} onclick={() => (slot = s as 0 | 1)} aria-label="Emplacement {s + 1} : {SPELLS[chosen[s]].name}">
        <span class="ic"><Ico k={spellKey(chosen[s])} fb={spellFb(chosen[s])} /></span>
        <span class="tx"><small>Sort {s + 1}</small><b>{SPELLS[chosen[s]].name}</b></span>
      </button>
    {/each}
  </div>
  <div class="grid">
    {#each SPELLS as sp, i}
      <button class="card" class:locked={!open[i]} class:in={chosen.includes(i)} disabled={!open[i]} onclick={() => pick(i)} title="{sp.name} — {sp.desc} (recharge {sp.cd} s)">
        <span class="ic"><Ico k={spellKey(i)} fb={spellFb(i)} /></span>
        <b>{sp.name}</b>
        {#if !compact}<span class="d">{sp.desc}</span>{/if}
        <span class="m">{open[i] ? `Recharge ${sp.cd} s` : `🔒 ${cond(i)}`}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .sp { display: flex; flex-direction: column; gap: 10px; }
  .slots { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .slot { cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 6px 10px 6px 6px; text-align: left; font: inherit; color: var(--text); background: var(--panel-hi); border: 2.5px solid var(--ink); border-radius: var(--r-sm); box-shadow: 0 3px 0 var(--ink); }
  .slot.on { background: var(--gold-fill); transform: translateY(2px); box-shadow: 0 1px 0 var(--ink); }
  .slot .tx { display: flex; flex-direction: column; min-width: 0; }
  .slot small { font-weight: 800; color: var(--muted); }
  .slot b { font-family: var(--font-display); font-weight: 400; line-height: 1.1; }
  .ic { width: 46px; height: 46px; flex: none; display: grid; place-items: center; }
  .ic :global(.ico3d) { width: 100%; height: 100%; margin: 0; vertical-align: 0; }
  .ic :global(.icon) { width: 28px; height: 28px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .compact .grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
  .card { cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 6px; text-align: center; font: inherit; color: var(--text); background: var(--panel-hi); border: 2.5px solid var(--ink); border-radius: var(--r-sm); box-shadow: 0 3px 0 var(--ink); }
  .card:hover:not(:disabled) { background: #fff; }
  .card.in { background: var(--gold-fill); }
  .card.locked { opacity: 0.55; cursor: not-allowed; filter: grayscale(0.6); }
  .card b { font-family: var(--font-display); font-weight: 400; line-height: 1.1; }
  .d { font-size: 0.8em; font-weight: 700; color: var(--muted); line-height: 1.3; }
  .m { font-size: 0.78em; font-weight: 800; color: var(--faint); }
</style>
