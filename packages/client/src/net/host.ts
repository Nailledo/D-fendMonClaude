import type { Command, EndInfo, GameConfig, LoggedCmd } from '@dfend/shared';

/** Source des snapshots : simulation locale (solo) ou serveur (multi). */
export interface Host {
  readonly local: boolean;
  onSnapshot: (buf: ArrayBuffer) => void;
  onEnd: (info: Omit<EndInfo, 'mode' | 'mapId' | 'difficulty'>) => void;
  send(c: Command): void;
  pause(v: boolean): void;
  getLog?(): Promise<LoggedCmd[]>;
  dispose(): void;
}

export class LocalHost implements Host {
  readonly local = true;
  onSnapshot: (buf: ArrayBuffer) => void = () => {};
  onEnd: Host['onEnd'] = () => {};
  private worker: Worker;
  private logResolve: ((l: LoggedCmd[]) => void) | null = null;

  constructor(cfg: GameConfig) {
    this.worker = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) this.onSnapshot(e.data);
      else if (e.data.t === 'end') this.onEnd(e.data);
      else if (e.data.t === 'log' && this.logResolve) this.logResolve(e.data.log);
    };
    this.worker.postMessage({ t: 'init', cfg });
  }
  send(c: Command) {
    this.worker.postMessage({ t: 'cmd', c });
  }
  pause(v: boolean) {
    this.worker.postMessage({ t: 'pause', v });
  }
  getLog() {
    return new Promise<LoggedCmd[]>((res) => {
      this.logResolve = res;
      this.worker.postMessage({ t: 'getlog' });
    });
  }
  dispose() {
    this.worker.terminate();
  }
}
