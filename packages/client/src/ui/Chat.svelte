<script lang="ts">
  import { PLAYER_COLORS } from '@dfend/shared';
  import { net } from '../net/Net';
  import { ui } from '../state.svelte';

  let { inline = false }: { inline?: boolean } = $props();
  let text = $state('');
  let input: HTMLInputElement | undefined = $state();
  let list: HTMLDivElement | undefined = $state();
  const QUICK = ['J’ai besoin d’or !', 'Je construis ici', 'Attention, volants !', 'Bien joué !', 'Appelez la vague'];

  function send(t = text) {
    const v = t.trim();
    if (v) net.send({ t: 'chat', text: v.slice(0, 140) });
    text = '';
    if (!inline) ui.chatOpen = false;
  }
  $effect(() => {
    if (ui.chatOpen && input) input.focus();
  });
  $effect(() => {
    void ui.chat.length;
    if (list) list.scrollTop = list.scrollHeight;
  });
  const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
  const now = () => Date.now();
</script>

<div class="chat" class:inline class:open={ui.chatOpen || inline}>
  <div class="msgs scroll" bind:this={list}>
    {#each ui.chat as m}
      {#if inline || ui.chatOpen || now() - m.t < 9000}
        <div class="m"><b style="color:{hex(PLAYER_COLORS[m.color] ?? 0xffffff)}">{m.from}</b> {m.text}</div>
      {/if}
    {/each}
  </div>
  {#if inline || ui.chatOpen}
    <div class="row">
      <input bind:this={input} type="text" maxlength="140" placeholder="Message…" bind:value={text}
        onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Enter') send(); if (e.key === 'Escape') { ui.chatOpen = false; } }} />
    </div>
    <div class="quick">
      {#each QUICK as q}<button class="btn small ghost" onclick={() => send(q)}>{q}</button>{/each}
    </div>
  {/if}
</div>

<style>
  .chat { pointer-events: none; display: flex; flex-direction: column; gap: 6px; width: 100%; }
  .chat.open { pointer-events: auto; }
  .chat.inline { background: rgba(30, 20, 12, 0.8); border-radius: 10px; padding: 10px; border: 2px solid var(--wood); flex: 1; }
  .msgs { max-height: 180px; display: flex; flex-direction: column; gap: 2px; }
  .inline .msgs { flex: 1; max-height: 260px; }
  .m { font-size: 0.9em; text-shadow: 0 1px 2px #000; background: rgba(0, 0, 0, 0.35); padding: 2px 8px; border-radius: 6px; width: fit-content; max-width: 100%; }
  .row input { flex: 1; }
  .quick { display: flex; flex-wrap: wrap; gap: 4px; }
  .quick .btn { font-size: 0.75em; padding: 3px 8px; }
</style>
