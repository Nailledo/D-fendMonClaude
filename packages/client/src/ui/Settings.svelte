<script lang="ts">
  import { audio } from '../audio/Audio';
  import { ACTION_LABELS, DEFAULT_KEYS, applyPreset, keyLabel, keys, resetKeys, saveKeys, saveSettings, settings, type Action, type Quality } from '../settings';
  import { ui } from '../state.svelte';

  let tab = $state<'gfx' | 'audio' | 'keys' | 'access'>('gfx');
  const s = $state({ ...settings });
  const k = $state({ ...keys });
  let capturing = $state<Action | null>(null);
  let needReload = $state(false);

  function commit() {
    const reload = s.antialias !== settings.antialias || s.shadows !== settings.shadows || s.quality !== settings.quality || s.decorDensity !== settings.decorDensity;
    Object.assign(settings, s);
    saveSettings();
    audio.applyVolumes();
    document.documentElement.style.setProperty('--scale', String(settings.textScale));
    document.documentElement.classList.toggle('show-keys', settings.showKeys);
    if (reload) needReload = true;
  }
  function preset(q: Quality) {
    applyPreset(q);
    Object.assign(s, settings);
    needReload = true;
  }
  function onKey(e: KeyboardEvent) {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.code !== 'Escape' || capturing === 'menu') {
      // échange si conflit
      const other = (Object.keys(k) as Action[]).find((a) => a !== capturing && k[a] === e.code);
      if (other) k[other] = k[capturing];
      k[capturing] = e.code;
      Object.assign(keys, k);
      saveKeys();
    }
    capturing = null;
  }
  function close() {
    commit();
    ui.overlay = null;
  }
  const conflicts = $derived.by(() => {
    const seen = new Map<string, number>();
    for (const a of Object.keys(k) as Action[]) seen.set(k[a], (seen.get(k[a]) ?? 0) + 1);
    return seen;
  });
</script>

<svelte:window onkeydown={onKey} />

<div class="overlay-bg">
  <div class="panel box" data-capturing={capturing ? '1' : undefined}>
    <div class="head">
      <h2>Paramètres</h2>
      <button class="btn small" onclick={close}>Fermer</button>
    </div>
    <div class="seg tabs">
      {#each [['gfx', 'Graphismes'], ['audio', 'Audio'], ['keys', 'Contrôles'], ['access', 'Accessibilité']] as [id, label]}
        <button class:on={tab === id} onclick={() => { commit(); tab = id as typeof tab; }}>{label}</button>
      {/each}
    </div>
    <div class="body scroll">
      {#if tab === 'gfx'}
        <div class="seg presets">
          {#each [['bas', 'Bas'], ['moyen', 'Moyen'], ['haut', 'Haut'], ['ultra', 'Ultra']] as [q, label]}
            <button class:on={s.quality === q} onclick={() => preset(q as Quality)}>{label}</button>
          {/each}
        </div>
        <label>Échelle de résolution : {Math.round(s.resScale * 100)} %<input type="range" min="0.5" max="2" step="0.05" bind:value={s.resScale} onchange={commit} /></label>
        <label>Densité du décor : {Math.round(s.decorDensity * 100)} %<input type="range" min="0.2" max="1.5" step="0.05" bind:value={s.decorDensity} onchange={commit} /></label>
        <label>Limite d’images par seconde
          <select bind:value={s.fpsCap} onchange={commit}>
            <option value={0}>Illimitée (synchro écran)</option><option value={30}>30</option><option value={60}>60</option><option value={120}>120</option>
          </select>
        </label>
        <label class="check"><input type="checkbox" bind:checked={s.shadows} onchange={commit} /> Ombres</label>
        <label class="check"><input type="checkbox" bind:checked={s.antialias} onchange={commit} /> Anticrénelage (MSAA)</label>
        {#if needReload}<p class="warn">Certains réglages s’appliquent au rechargement. <button class="btn small" onclick={() => location.reload()}>Recharger</button></p>{/if}
      {:else if tab === 'audio'}
        <label>Volume général : {Math.round(s.volMaster * 100)} %<input type="range" min="0" max="1" step="0.05" bind:value={s.volMaster} oninput={commit} /></label>
        <label>Musique : {Math.round(s.volMusic * 100)} %<input type="range" min="0" max="1" step="0.05" bind:value={s.volMusic} oninput={commit} /></label>
        <label>Effets : {Math.round(s.volSfx * 100)} %<input type="range" min="0" max="1" step="0.05" bind:value={s.volSfx} oninput={commit} /></label>
        <button class="btn small" onclick={() => { audio.unlock(); audio.play('upgrade'); }}>Tester le son</button>
      {:else if tab === 'keys'}
        <p class="muted">Tout se joue à la souris : clic gauche pour sélectionner/construire, clic droit pour déplacer le héros, molette pour zoomer, glisser pour déplacer la caméra. Au tactile : appui long pour déplacer le héros, pincement pour zoomer. Cliquez sur une touche pour la changer.</p>
        <div class="keys">
          {#each Object.keys(ACTION_LABELS) as a}
            {@const act = a as Action}
            <div class="krow">
              <span>{ACTION_LABELS[act]}</span>
              <button class="kb" class:cap={capturing === act} class:conf={(conflicts.get(k[act]) ?? 0) > 1} onclick={() => (capturing = act)}>
                {capturing === act ? 'Appuyez sur une touche…' : keyLabel(k[act])}
              </button>
              {#if k[act] !== DEFAULT_KEYS[act]}<button class="btn small ghost" aria-label="Touche par défaut" title="Par défaut" onclick={() => { k[act] = DEFAULT_KEYS[act]; Object.assign(keys, k); saveKeys(); }}>↺</button>{/if}
            </div>
          {/each}
        </div>
        <button class="btn small" onclick={() => { resetKeys(); Object.assign(k, keys); }}>Tout réinitialiser</button>
        <label class="check"><input type="checkbox" bind:checked={s.edgeScroll} onchange={commit} /> Déplacer la caméra aux bords de l’écran</label>
      {:else}
        <label>Taille du texte : {Math.round(s.textScale * 100)} %<input type="range" min="0.85" max="1.4" step="0.05" bind:value={s.textScale} onchange={commit} /></label>
        <label class="check"><input type="checkbox" bind:checked={s.damageNumbers} onchange={commit} /> Afficher les chiffres de dégâts</label>
        <label class="check"><input type="checkbox" bind:checked={s.reduceShake} onchange={commit} /> Réduire les tremblements d’écran</label>
        <label class="check"><input type="checkbox" bind:checked={s.showKeys} onchange={commit} /> Toujours afficher les raccourcis clavier (sinon : au survol, ou en maintenant Alt)</label>
        <label class="check"><input type="checkbox" bind:checked={s.colorblind} onchange={commit} /> Mode daltonien (motifs sur les couleurs de joueurs)</label>
      {/if}
    </div>
  </div>
</div>

<style>
  .box { width: min(640px, 100%); max-height: 88vh; display: flex; flex-direction: column; gap: 14px; }
  .head { display: flex; justify-content: space-between; align-items: center; }
  h2 { margin: 0; font-size: 2em; }
  .body { display: flex; flex-direction: column; gap: 14px; padding-right: 6px; }
  label { display: flex; flex-direction: column; gap: 6px; font-weight: 700; }
  label.check { flex-direction: row; align-items: center; gap: 10px; font-weight: 400; }
  .muted { color: var(--muted); margin: 0; font-size: 0.9em; }
  .warn { color: var(--gold); font-weight: 700; margin: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .keys { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; }
  .krow { display: flex; align-items: center; gap: 6px; font-size: 0.92em; }
  .krow span { flex: 1; }
  .kb { min-width: 96px; cursor: pointer; padding: 5px 8px; border: 2px solid var(--edge); background: var(--sunken); color: var(--text); font-weight: 700; }
  .kb:hover { border-color: var(--muted); }
  .kb.cap { border-color: var(--gold); color: var(--gold); }
  .kb.conf { border-color: var(--life); color: var(--bad); }
  @media (max-width: 600px) { .keys { grid-template-columns: 1fr; } }
</style>
