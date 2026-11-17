<script lang="ts">
  import { app } from '../app';
  import { keyLabel, keys } from '../settings';
  import { ui } from '../state.svelte';
  import { SPEAKERS } from '../story/dialogs';

  const d = $derived(ui.dialog!);
  const line = $derived(d.lines[d.i]);
  const sp = $derived(SPEAKERS[line.who]);
  const portrait = $derived(ui.portraits[line.who]);
</script>

<div class="dlg ui" role="button" tabindex="0" onclick={() => app.game?.nextDialog()} onkeydown={() => {}}>
  <div class="box panel" class:right={line.who === 'kessin' || line.who === 'grolbak' || line.who === 'vasiere'}>
    <div class="por" style="--c:{sp.color}">
      {#if portrait}<img src={portrait} alt={sp.name} />{:else}<span>{sp.name[0]}</span>{/if}
    </div>
    <div class="txt">
      <b style="color:{sp.color}">{sp.name}</b>
      {#key d.i}<p>{line.text}</p>{/key}
      <div class="foot">
        <span>{d.i + 1} / {d.lines.length}</span>
        <span>Clic ou <span class="kbd">{keyLabel(keys.wave)}</span> pour continuer · <span class="kbd">{keyLabel(keys.menu)}</span> pour passer</span>
      </div>
    </div>
  </div>
</div>

<style>
  .dlg { position: fixed; inset: 0; display: flex; align-items: flex-end; justify-content: center; padding: 0 16px 128px; background: rgba(12, 14, 16, 0.35); cursor: pointer; z-index: 30; }
  .box { display: flex; gap: 18px; align-items: center; width: min(800px, 100%); animation: rise 0.2s ease; padding: 16px 20px; }
  .box.right { flex-direction: row-reverse; }
  .por { flex: none; width: 100px; height: 100px; background: #d9cfb8; display: grid; place-items: center; overflow: hidden; font-family: var(--font-display); font-size: 44px; font-weight: 700; color: var(--line);
    clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); box-shadow: inset 0 -5px 0 var(--c); }
  .por img { width: 100%; height: 100%; }
  .txt { flex: 1; min-width: 0; }
  .txt b { font-family: var(--font-display); font-size: 1.45em; line-height: 1; }
  p { margin: 6px 0 8px; font-size: 1.12em; line-height: 1.45; max-width: 62ch; animation: fade 0.25s ease; }
  .foot { display: flex; justify-content: space-between; font-size: 0.8em; color: var(--faint); gap: 8px; flex-wrap: wrap; }
  @media (max-width: 600px) { .por { width: 64px; height: 64px; } }
</style>
