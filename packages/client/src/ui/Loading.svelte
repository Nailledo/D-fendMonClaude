<script lang="ts">
  import { onMount } from 'svelte';
  import { ui } from '../state.svelte';

  const TIPS = [
    'Cliquez sur un emplacement vide pour construire une tour.',
    'Cliquez sur votre héros puis sur le sol pour le déplacer (ou clic droit).',
    'Appeler la vague en avance (Espace) rapporte de l’or en bonus.',
    'Les casernes bloquent les ennemis sur le chemin : déplacez leur point de ralliement.',
    'Q, W et R déclenchent les compétences du héros ; 1 et 2 lancent les sorts.',
    'Les ennemis volants ignorent les soldats : gardez des archers ou des mages à portée.',
    'Une tour vendue pendant la préparation rend tout son prix.',
    'La touche F double la vitesse du jeu.',
  ];
  let tip = $state(TIPS[Math.floor(Math.random() * TIPS.length)]);
  let visible = $state(ui.loading.active);
  let fading = $state(false);

  onMount(() => {
    // le premier écran statique (index.html) laisse la place à celui-ci
    document.getElementById('boot')?.remove();
  });

  $effect(() => {
    if (ui.loading.active) {
      visible = true;
      fading = false;
      tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    } else if (visible) {
      fading = true;
      const t = setTimeout(() => { visible = false; fading = false; }, 350);
      return () => clearTimeout(t);
    }
  });
</script>

{#if visible}
  <div class="loading" class:fading role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ui.loading.progress * 100)} aria-label="Chargement">
    <div class="center">
      <div class="logo">D-Fend</div>
      {#if ui.loading.title}<div class="map">{ui.loading.title}</div>{:else}<div class="sub">La Quête de Samuel</div>{/if}
      <div class="bar"><div class="fill" style:width="{Math.round(ui.loading.progress * 100)}%"></div></div>
      <div class="label">{ui.loading.label}<span class="pct">{Math.round(ui.loading.progress * 100)} %</span></div>
    </div>
    <p class="tip"><b>Astuce</b> {tip}</p>
  </div>
{/if}

<style>
  .loading { position: fixed; inset: 0; z-index: 80; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: calc(24px + var(--sat)) 16px calc(24px + var(--sab));
    background: radial-gradient(ellipse at 50% 120%, #7cc242 0 28%, transparent 28.2%), radial-gradient(ellipse at 50% 30%, #bfe5f7 0%, #8fd0f0 55%, #6fb6de 100%); transition: opacity 0.35s ease; }
  .fading { opacity: 0; pointer-events: none; }
  .center { width: min(460px, 100%); display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .logo { font-family: var(--font-logo); font-size: clamp(70px, 15vw, 124px); line-height: 0.95; text-transform: uppercase; color: var(--gold-fill); transform: rotate(-3deg);
    -webkit-text-stroke: 11px var(--ink); paint-order: stroke fill; text-shadow: 0 8px 0 var(--ink), 0 14px 0 var(--hue-shadow); }
  .sub, .map { font-family: var(--font-display); color: #fff; font-size: clamp(16px, 2.6vw, 22px); text-align: center; padding: 3px 16px 5px; background: var(--toon-blue); border: var(--bw) solid var(--ink); border-radius: 12px; box-shadow: 0 4px 0 var(--ink);
    -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill; }
  .bar { width: 100%; height: 26px; margin-top: 22px; background: #5a3f33; border: var(--bw) solid var(--ink); border-radius: 999px; box-shadow: 0 4px 0 var(--ink); overflow: hidden; }
  .fill { height: 100%; background: var(--toon-gold); border-right: var(--bw) solid var(--ink); border-radius: 999px; transition: width 0.25s ease; }
  .label { width: 100%; display: flex; justify-content: space-between; gap: 12px; font-family: var(--font-display); color: #fff; font-size: 16px; -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill; }
  .pct { font-variant-numeric: tabular-nums; }
  .tip { position: absolute; bottom: calc(26px + var(--sab)); left: 16px; right: 16px; margin: 0 auto; max-width: 560px; text-align: center; color: var(--ink); font-size: 14.5px; font-weight: 800; line-height: 1.4;
    background: var(--panel); border: var(--bw) solid var(--ink); border-radius: var(--r); box-shadow: var(--shadow-sm); padding: 8px 14px; }
  .tip b { display: inline-block; margin-right: 8px; padding: 0 8px; background: var(--toon-gold); border: 2px solid var(--ink); border-radius: 99px; }
</style>
