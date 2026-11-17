import { GameState, type Command, type GameConfig } from './types';
import { Sim } from './sim';

/** Durée (ticks) après la dernière commande au-delà de laquelle le rejeu considère la partie abandonnée. */
export const REPLAY_IDLE_TICKS = 20 * 60 * 3;
/** Durée maximale d'une partie rejouée (2 h de jeu). */
export const REPLAY_MAX_TICKS = 20 * 60 * 120;

export interface LoggedCmd {
  tick: number;
  pid: number;
  c: Command;
}

/** Rejoue une partie à partir de la graine et du journal de commandes. Sert à valider les scores de survie. */
export function replay(cfg: GameConfig, log: LoggedCmd[], maxTicks = REPLAY_MAX_TICKS): { wave: number; state: GameState; tick: number } {
  const sim = new Sim(cfg);
  let i = 0;
  const sorted = [...log].sort((a, b) => a.tick - b.tick);
  // la partie s'arrête 3 min après la dernière commande (abandon), même sans aucune commande
  const stopAt = Math.min(maxTicks, (sorted.length ? sorted[sorted.length - 1].tick : 0) + REPLAY_IDLE_TICKS);
  while (sim.tick < stopAt && sim.state !== GameState.Lost && sim.state !== GameState.Won) {
    while (i < sorted.length && sorted[i].tick <= sim.tick) {
      sim.apply(sorted[i].pid, sorted[i].c);
      i++;
    }
    sim.step();
    sim.events.length = 0;
  }
  return { wave: sim.wavesSurvived, state: sim.state, tick: sim.tick };
}
