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
  .dlg { position: fixed; left: 0; right: 0; bottom: 0; top: 0; display: flex; align-items: flex-end; justify-content: center; padding: 0 16px 120px; background: linear-gradient(0deg, rgba(0, 0, 0, 0.55), transparent 55%); cursor: pointer; z-index: 30; }
  .box { display: flex; gap: 16px; align-items: center; width: min(780px, 100%); animation: rise 0.25s ease; }
  .box.right { flex-direction: row-reverse; }
  .por { flex: none; width: 96px; height: 96px; border-radius: 14px; border: 3px solid var(--c); background: radial-gradient(circle at 50% 35%, #fff8e1, #c8a46a); display: grid; place-items: center; overflow: hidden; font-family: 'Cinzel', serif; font-size: 40px; font-weight: 800; }
  .por img { width: 100%; height: 100%; }
  .txt { flex: 1; }
  .txt b { font-family: 'Cinzel', serif; font-size: 1.1em; }
  p { margin: 4px 0 6px; font-size: 1.08em; line-height: 1.4; animation: fade 0.3s ease; }
  .foot { display: flex; justify-content: space-between; font-size: 0.75em; color: #7a6040; gap: 8px; flex-wrap: wrap; }
  @media (max-width: 600px) { .por { width: 64px; height: 64px; } }
</style>
