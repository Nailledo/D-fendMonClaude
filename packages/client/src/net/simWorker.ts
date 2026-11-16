/// <reference lib="webworker" />
import { GameState, Sim, encodeSnapshot, type Command, type GameConfig, type LoggedCmd } from '@dfend/shared';

let sim: Sim | null = null;
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

self.onmessage = (e: MessageEvent) => {
  const m = e.data as { t: string; cfg?: GameConfig; c?: Command; v?: boolean };
  if (m.t === 'init' && m.cfg) {
    sim = new Sim(m.cfg);
    last = performance.now();
    // premier snapshot immédiat
    const buf = encodeSnapshot(sim, []);
    (self as unknown as Worker).postMessage(buf, [buf]);
    setInterval(loop, 16);
  } else if (m.t === 'cmd' && m.c) pending.push(m.c);
  else if (m.t === 'pause') paused = !!m.v;
  else if (m.t === 'getlog') (self as unknown as Worker).postMessage({ t: 'log', log });
};
