import { Worker } from 'node:worker_threads';
import type { GameConfig, LoggedCmd } from '@dfend/shared';

export interface ReplayResult {
  ok: boolean;
  wave?: number;
  /** dernier tick simulé */
  tick?: number;
  /** la partie rejouée s'est terminée par une défaite (et non par abandon) */
  lost?: boolean;
  error?: string;
}

interface Job {
  id: number;
  cfg: GameConfig;
  log: LoggedCmd[];
  done: (r: ReplayResult) => void;
}

/**
 * File de validation des scores : rejeu de la partie dans un thread séparé, une partie à la fois.
 * Un rejeu trop long fait tuer le thread (il ne continue pas en arrière-plan) puis le relance.
 */
export class Validator {
  private worker: Worker | null = null;
  private nextId = 1;
  private queue: Job[] = [];
  private current: Job | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(readonly maxQueue = 8, readonly timeoutMs = 30_000) {}

  /** Tâches en cours ou en attente. */
  get pending() {
    return this.queue.length + (this.current ? 1 : 0);
  }

  get full() {
    return this.pending >= this.maxQueue;
  }

  run(cfg: GameConfig, log: LoggedCmd[]): Promise<ReplayResult> {
    if (this.full) return Promise.resolve({ ok: false, error: 'serveur occupé' });
    return new Promise((done) => {
      this.queue.push({ id: this.nextId++, cfg, log, done });
      this.pump();
    });
  }

  private spawn(): Worker {
    const isTs = import.meta.url.endsWith('.ts');
    const w = new Worker(new URL(isTs ? './replayWorker.ts' : './replayWorker.js', import.meta.url), isTs ? { execArgv: ['--import', 'tsx'] } : {});
    w.on('message', (m: { id: number } & ReplayResult) => {
      if (!this.current || m.id !== this.current.id) return;
      this.finish({ ok: m.ok, wave: m.wave, tick: m.tick, lost: m.lost, error: m.error });
    });
    w.on('error', (e) => {
      console.error('rejeu', e);
      this.kill();
      this.finish({ ok: false, error: 'rejeu impossible' });
    });
    w.unref();
    return w;
  }

  private pump() {
    if (this.current || this.queue.length === 0) return;
    const job = this.queue.shift()!;
    this.current = job;
    this.worker ??= this.spawn();
    this.timer = setTimeout(() => {
      // le thread est réellement arrêté : il ne consomme plus de processeur
      this.kill();
      this.finish({ ok: false, error: 'délai dépassé' });
    }, this.timeoutMs);
    this.worker.postMessage({ id: job.id, cfg: job.cfg, log: job.log });
  }

  private kill() {
    const w = this.worker;
    this.worker = null;
    if (w) void w.terminate();
  }

  private finish(r: ReplayResult) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const job = this.current;
    this.current = null;
    job?.done(r);
    this.pump();
  }
}
