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
    background: radial-gradient(ellipse at 50% 40%, #26302b 0%, #14181b 70%); transition: opacity 0.35s ease; }
  .fading { opacity: 0; pointer-events: none; }
  .center { width: min(440px, 100%); display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .logo { font-family: var(--font-logo); font-size: clamp(64px, 14vw, 112px); line-height: 0.9; filter: drop-shadow(0 4px 0 rgba(8, 10, 12, 0.65)); }
  .sub, .map { font-family: var(--font-display); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold); font-size: clamp(14px, 2.4vw, 20px); text-align: center; }
  .bar { width: 100%; height: 12px; margin-top: 18px; background: var(--sunken); border-radius: 999px; box-shadow: inset 0 2px 0 rgba(0, 0, 0, 0.35); overflow: hidden; }
  .fill { height: 100%; background: linear-gradient(180deg, #ffd476, var(--gold)); border-radius: 999px; transition: width 0.25s ease; }
  .label { width: 100%; display: flex; justify-content: space-between; gap: 12px; color: var(--muted); font-size: 14px; }
  .pct { color: var(--text); font-weight: 700; font-variant-numeric: tabular-nums; }
  .tip { position: absolute; bottom: calc(28px + var(--sab)); left: 16px; right: 16px; margin: 0 auto; max-width: 560px; text-align: center; color: var(--muted); font-size: 14px; line-height: 1.4; }
  .tip b { color: var(--gold); margin-right: 6px; }
</style>
