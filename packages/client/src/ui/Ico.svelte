<script lang="ts">
  import { ui } from '../state.svelte';

  /**
   * Icône 3D du jeu (voir render/icons3d.ts) ; tant qu'elle n'est pas générée,
   * l'ancienne icône SVG `fb` est affichée à sa place.
   */
  let { k, fb = '', cls = '' }: { k: string; fb?: string; cls?: string } = $props();
  const src = $derived(ui.icons[k]);
</script>

{#if src}<img class="icon ico3d {cls}" {src} alt="" draggable="false" />{:else}{@html fb}{/if}

<style>
  .ico3d { object-fit: contain; vertical-align: -0.28em; pointer-events: none; -webkit-user-drag: none; }
</style>
