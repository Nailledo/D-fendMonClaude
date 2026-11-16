import { Worker } from 'node:worker_threads';
import type { GameConfig, LoggedCmd } from '@dfend/shared';

/** File de validation des scores : rejeu de la partie dans un thread séparé. */
export class Validator {
  private worker: Worker;
  private nextId = 1;
  private waiting = new Map<number, (r: { ok: boolean; wave?: number; error?: string }) => void>();
  readonly queue: number[] = [];

  constructor() {
    const isTs = import.meta.url.endsWith('.ts');
    this.worker = new Worker(new URL(isTs ? './replayWorker.ts' : './replayWorker.js', import.meta.url), isTs ? { execArgv: ['--import', 'tsx'] } : {});
    this.worker.on('message', (m: { id: number; ok: boolean; wave?: number; error?: string }) => {
      const cb = this.waiting.get(m.id);
      this.waiting.delete(m.id);
      cb?.(m);
    });
    this.worker.unref();
  }

  get pending() {
    return this.waiting.size;
  }

  run(cfg: GameConfig, log: LoggedCmd[]): Promise<{ ok: boolean; wave?: number; error?: string }> {
    return new Promise((res) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.waiting.delete(id);
        res({ ok: false, error: 'délai dépassé' });
      }, 60_000);
      this.waiting.set(id, (r) => {
        clearTimeout(timer);
        res(r);
      });
      this.worker.postMessage({ id, cfg, log });
    });
  }
}
