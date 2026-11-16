/// <reference lib="webworker" />
import { GameState, Sim, encodeSnapshot, type Command, type GameConfig, type LoggedCmd } from '@dfend/shared';

let sim: Sim | null = null;
let bench = false;
let paused = false;
const pending: Command[] = [];
const log: LoggedCmd[] = [];
let acc = 0;
let last = 0;

function loop() {
  if (!sim) return;
  const now = performance.now();
  if (paused) { last = now; return; }
  acc += now - last;
  last = now;
  if (acc > 500) acc = 500;
  const events: number[][] = [];
  let stepped = false;
  if (bench) benchStep(sim);
  while (acc >= 50) {
    acc -= 50;
    const steps = sim.speed;
    for (let s = 0; s < steps; s++) {
      while (pending.length) {
        const c = pending.shift()!;
        log.push({ tick: sim.tick, pid: 0, c });
        sim.apply(0, c);
      }
      sim.step();
      for (const e of sim.drainEvents()) events.push(e);
      stepped = true;
    }
  }
  if (stepped) {
    const buf = encodeSnapshot(sim, events);
    (self as unknown as Worker).postMessage(buf, [buf]);
  }
  if (sim.state === GameState.Won || sim.state === GameState.Lost) {
    if (!(sim as unknown as { _ended?: boolean })._ended) {
      (sim as unknown as { _ended?: boolean })._ended = true;
      (self as unknown as Worker).postMessage({
        t: 'end', won: sim.state === GameState.Won, stars: sim.stars, wave: sim.wavesSurvived,
        stats: sim.players.map((p) => ({ id: p.id, name: p.name, kills: p.kills, damage: Math.round(p.damage), gold: Math.round(p.goldEarned) })),
      });
    }
  }
}

/** Mode benchmark : or illimité, tours au maximum, vagues appelées en continu. */
function benchStep(s: Sim) {
  const p = s.players[0];
  p.gold = 1e7;
  s.lives = 20;
  if (s.tick % 20 !== 0) return;
  s.map.slots.forEach((sl, i) => {
    if (sl.locked) return;
    const t = s.towerBySlot[i];
    if (!t) s.apply(0, { k: 'build', slot: i, fam: i % 4 });
    else if (t.level < 2) s.apply(0, { k: 'up', tower: t.id });
    else if (t.level === 2) s.apply(0, { k: 'spec', tower: t.id, s: ((i >> 2) % 2) + 1 as 1 | 2 });
    else { s.apply(0, { k: 'skill', tower: t.id, i: 0 }); s.apply(0, { k: 'skill', tower: t.id, i: 1 }); }
  });
  if (s.tick % 60 === 0) s.apply(0, { k: 'wave' });
  s.lives = 20;
  // renforts d'ennemis très résistants pour atteindre ~400 ennemis à l'écran
  const spawn = (s as unknown as { spawnEnemy(t: number, p: number, hp: number, lane: number, d?: number): void }).spawnEnemy.bind(s);
  for (let k = 0; k < 24 && s.enemies.length < 400; k++) spawn((k * 7) % 18, k % s.map.paths.length, 60, ((k % 5) - 2) * 0.3, (k * 3.7) % 40);
  s.lives = 20;
}

self.onmessage = (e: MessageEvent) => {
  const m = e.data as { t: string; cfg?: GameConfig; c?: Command; v?: boolean; bench?: boolean };
  if (m.t === 'init' && m.cfg) {
    sim = new Sim(m.cfg);
    bench = !!m.bench;
    last = performance.now();
    // premier snapshot immédiat
    const buf = encodeSnapshot(sim, []);
    (self as unknown as Worker).postMessage(buf, [buf]);
    setInterval(loop, 16);
  } else if (m.t === 'cmd' && m.c) pending.push(m.c);
  else if (m.t === 'pause') paused = !!m.v;
  else if (m.t === 'getlog') (self as unknown as Worker).postMessage({ t: 'log', log });
};
