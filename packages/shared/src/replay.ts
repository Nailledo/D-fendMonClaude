import { GameState, type Command, type GameConfig } from './types';
import { Sim } from './sim';

export interface LoggedCmd {
  tick: number;
  pid: number;
  c: Command;
}

/** Rejoue une partie à partir de la graine et du journal de commandes. Sert à valider les scores de survie. */
export function replay(cfg: GameConfig, log: LoggedCmd[], maxTicks = 20 * 60 * 120): { wave: number; state: GameState; tick: number } {
  const sim = new Sim(cfg);
  let i = 0;
  const sorted = [...log].sort((a, b) => a.tick - b.tick);
  while (sim.tick < maxTicks && sim.state !== GameState.Lost && sim.state !== GameState.Won) {
    while (i < sorted.length && sorted[i].tick <= sim.tick) {
      sim.apply(sorted[i].pid, sorted[i].c);
      i++;
    }
    sim.step();
    sim.events.length = 0;
    // fin du journal : la partie s'arrête là (abandon)
    if (i >= sorted.length && sorted.length && sim.tick > sorted[sorted.length - 1].tick + 20 * 60 * 3) break;
  }
  return { wave: sim.wavesSurvived, state: sim.state, tick: sim.tick };
}
