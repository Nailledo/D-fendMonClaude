<script lang="ts">
  import { app } from '../app';
  import { keyLabel, keys } from '../settings';
  import { HEROES } from '@dfend/shared';
  import { heroName, ui } from '../state.svelte';
  import { SPEAKERS } from '../story/dialogs';

  const d = $derived(ui.dialog!);
  const line = $derived(d.lines[d.i]);
  // le héros de l'histoire, c'est vous : votre pseudo, votre personnage
  const me = $derived(line.who === 'samuel');
  const sp = $derived(me ? { name: heroName(), color: '#' + HEROES[ui.hero].color.toString(16).padStart(6, '0') } : SPEAKERS[line.who]);
  const portrait = $derived(ui.portraits[me ? ui.hero : line.who]);
  const text = $derived(line.text.replace(/\bSamuel\b/g, heroName()));
</script>

<div class="dlg ui" role="button" tabindex="0" onclick={() => app.game?.nextDialog()} onkeydown={() => {}}>
  <div class="box panel paper" class:right={line.who === 'kessin' || line.who === 'grolbak' || line.who === 'vasiere'}>
    <div class="por" style="--c:{sp.color}">
      {#if portrait}<img src={portrait} alt={sp.name} />{:else}<span>{sp.name[0]}</span>{/if}
    </div>
    <div class="txt">
      <b style="--c:{sp.color}">{sp.name}</b>
      {#key d.i}<p>{text}</p>{/key}
      <div class="foot">
        <span>{d.i + 1} / {d.lines.length}</span>
        {#if ui.touch}<span>Touchez pour tourner la page</span>
        {:else}<span>Clic ou <span class="kbd">{keyLabel(keys.wave)}</span> pour continuer · <span class="kbd">{keyLabel(keys.menu)}</span> pour passer</span>{/if}
      </div>
    </div>
  </div>
</div>

<style>
  .dlg { position: fixed; inset: 0; display: flex; align-items: flex-end; justify-content: center; padding: 0 16px calc(172px + var(--sab)); background: linear-gradient(180deg, rgba(43, 26, 18, 0) 40%, rgba(43, 26, 18, 0.45)); cursor: pointer; z-index: 30; }
  /* une page du livre du conteur */
  .box { display: flex; gap: 20px; align-items: center; width: min(820px, 100%); animation: page 0.28s ease; padding: 18px 24px 14px 20px; transform: rotate(-0.4deg); }
  .box.right { flex-direction: row-reverse; transform: rotate(0.4deg); }
  @keyframes page { from { opacity: 0; transform: translateY(14px) rotate(-1.5deg); } }
  /* vignette ovale cernée d'encre, lavis d'aquarelle à la couleur du personnage */
  .por { position: relative; flex: none; width: 104px; height: 122px; display: grid; place-items: center; overflow: hidden; font-family: var(--font-story); font-size: 52px; color: var(--ink);
    border-radius: 50%; border: 2px solid var(--ink); box-shadow: inset 0 0 0 4px #f6ecd2, inset 0 0 0 5px rgba(45, 36, 22, 0.4);
    background: radial-gradient(ellipse at 50% 60%, color-mix(in srgb, var(--c) 55%, transparent) 0%, color-mix(in srgb, var(--c) 25%, transparent) 60%, transparent 80%), #efe1bd; }
  .por img { width: 100%; height: 100%; object-fit: cover; filter: sepia(0.15); }
  .txt { flex: 1; min-width: 0; }
  .txt b { font-family: var(--font-story-sc); font-weight: 400; font-size: 1.45em; line-height: 1; letter-spacing: 0.04em; color: color-mix(in srgb, var(--c) 45%, #2d2416);
    background: linear-gradient(transparent 62%, color-mix(in srgb, var(--c) 45%, transparent) 62% 92%, transparent 92%); padding: 0 4px; }
  p { margin: 8px 0 10px; font-family: var(--font-story); font-size: 1.3em; line-height: 1.4; max-width: 62ch; animation: fade 0.3s ease; }
  /* lettrine rouge */
  p::first-letter { float: left; font-size: 2.6em; line-height: 0.82; margin: 4px 6px 0 0; color: var(--wax); }
  .foot { display: flex; justify-content: space-between; font-family: var(--font-story); font-style: italic; font-size: 0.92em; color: var(--faint); gap: 8px; flex-wrap: wrap; border-top: 1px solid rgba(45, 36, 22, 0.25); padding-top: 6px; }
  .foot .kbd { font-style: normal; }
  .foot > span:first-child { font-family: var(--font-ui); font-style: normal; font-weight: 800; }
  @media (max-width: 600px) {
    .dlg { padding-bottom: calc(110px + var(--sab)); }
    .box { gap: 12px; padding: 12px 14px 10px; }
    .por { width: 64px; height: 76px; }
    p { font-size: 1.12em; }
  }
  @media (max-height: 520px) and (orientation: landscape) {
    .dlg { padding-bottom: calc(86px + var(--sab)); }
    .box { padding: 10px 16px 8px; gap: 14px; }
    .por { width: 70px; height: 82px; }
    p { font-size: 1.1em; margin: 4px 0 6px; }
  }
</style>
