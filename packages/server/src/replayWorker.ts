import { parentPort } from 'node:worker_threads';
import { replay, type GameConfig, type LoggedCmd } from '@dfend/shared';

parentPort?.on('message', (m: { id: number; cfg: GameConfig; log: LoggedCmd[] }) => {
  try {
    const r = replay(m.cfg, m.log);
    parentPort?.postMessage({ id: m.id, ok: true, wave: r.wave });
  } catch (e) {
    parentPort?.postMessage({ id: m.id, ok: false, error: String(e) });
  }
});
