<script lang="ts">
  import Ico from './Ico.svelte';
  import { CLASSES, DmgType, SKILL_UNLOCK, type ClassPassive, type ClassSkill } from '@dfend/shared';
  import { hex, passiveIcon, skillIcon } from './classIcons';

  /** Fiche d'une classe de héros : en-tête, statistiques, puis ses passifs et compétences (icône, nom, type, effet). */
  let { cls }: { cls: number } = $props();
  const c = $derived(CLASSES[cls] ?? CLASSES[0]);
  type Ab = { icon: { k: string; fb: string }; name: string; kind: string; meta: string; desc: string; ult: boolean };
  const abilities = $derived<Ab[]>([
    ...(c.passives as ClassPassive[]).map((p, i) => ({ icon: passiveIcon(p), name: p.name, kind: 'Passif', meta: `nœud ${i === 0 ? 2 : 4}`, desc: p.desc, ult: false })),
    ...(c.skills as ClassSkill[]).map((s, i) => ({
      icon: skillIcon(s),
      name: s.name,
      kind: i === 2 ? 'Ultime' : `Compétence ${i + 1}`,
      meta: `niveau ${SKILL_UNLOCK[i]} · recharge ${s.cd} s`,
      desc: s.desc,
      ult: i === 2,
    })),
  ]);
</script>

<div class="sheet" style="--cc:{hex(c.color)}">
  <div class="main">
    <div class="hd"><b>{c.name}</b><span>{c.role}</span></div>
    <p class="desc">{c.desc}</p>
    <div class="st">
      <span>PV {c.hp}</span><span>Dégâts {c.dmg[0]}–{c.dmg[1]}</span><span>{c.range ? `Portée ${String(c.range).replace('.', ',')}` : 'Mêlée'}</span>
      <span>{c.dmgType === DmgType.Magic ? 'Magique' : 'Physique'}</span><span>Armure {Math.round(c.armor * 100)} %</span>
    </div>
    <ul class="ab">
      {#each abilities as a}
        <li class:ult={a.ult}>
          <span class="ic"><Ico k={a.icon.k} fb={a.icon.fb} /></span>
          <div class="tx">
            <b class="nm">{a.name}</b>
            <div class="meta"><span class="kind">{a.kind}</span>{a.meta}</div>
            <p>{a.desc}</p>
          </div>
        </li>
      {/each}
    </ul>
  </div>
</div>

<style>
  .sheet { display: flex; gap: 16px; align-items: flex-start; text-align: left; }
  .main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .hd { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; }
  .st { display: flex; flex-wrap: wrap; gap: 4px; }
  .st span { font-size: 11.5px; font-weight: 900; padding: 0 8px; border: 2px solid var(--ink); border-radius: 99px; background: var(--panel-hi); }
  .hd b { font-family: var(--font-display); font-weight: 400; font-size: 1.5em; line-height: 1; color: var(--cc); -webkit-text-stroke: 0.5px var(--ink); }
  .hd span { font-size: 0.9em; font-weight: 800; color: var(--muted); }
  .desc { margin: 0; font-size: 0.92em; color: var(--muted); font-weight: 700; line-height: 1.35; }
  .ab { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 8px; }
  li { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 10px; align-items: start; padding: 8px 10px 8px 8px; background: var(--panel-hi); border: 2px solid var(--ink); border-radius: var(--r-sm); }
  li.ult { background: #fff4d0; border-color: var(--gold-lo); }
  .ic { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; background: var(--ink); overflow: hidden; }
  .ic :global(.icon) { width: 44px; height: 44px; margin: 0; vertical-align: 0; }
  .ic :global(svg.icon) { width: 26px; height: 26px; color: #fff; }
  .tx { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .nm { font-weight: 900; font-size: 0.98em; line-height: 1.15; }
  .kind { flex: none; margin-right: 6px; font-size: 10px; color: var(--ink); font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; padding: 0 7px; border-radius: 99px; border: 1.5px solid var(--ink); background: var(--panel); }
  .ult .kind { background: var(--gold-fill); }
  .meta { display: flex; flex-wrap: wrap; align-items: center; row-gap: 2px; margin-top: 2px; font-size: 11.5px; font-weight: 800; color: var(--faint); }
  .tx p { margin: 2px 0 0; font-size: 0.86em; font-weight: 700; line-height: 1.3; color: var(--text); }
  @media (max-width: 560px) {
    .sheet { gap: 10px; }
  }
</style>
