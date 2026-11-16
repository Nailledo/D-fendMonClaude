import type { ClientMsg, Command, ServerMsg } from '@dfend/shared';
import { loadRaw, save } from '../storage';
import type { Host } from './host';

type Listener = (m: ServerMsg) => void;

/** Connexion WebSocket unique (lobby + partie), avec reconnexion automatique. */
export class Net {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  onBinary: ((buf: ArrayBuffer) => void) | null = null;
  onStatus: ((s: 'connecting' | 'open' | 'closed') => void) | null = null;
  token: string = loadRaw('token', '');
  name = '';
  private retry = 0;
  private wanted = false;
  private queue: ClientMsg[] = [];

  connect(name: string) {
    this.name = name;
    this.wanted = true;
    if (this.ws && this.ws.readyState <= 1) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    this.onStatus?.('connecting');
    ws.onopen = () => {
      this.retry = 0;
      this.onStatus?.('open');
      ws.send(JSON.stringify({ t: 'hello', name: this.name, token: this.token || undefined } satisfies ClientMsg));
      for (const m of this.queue) ws.send(JSON.stringify(m));
      this.queue.length = 0;
    };
    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        this.onBinary?.(e.data);
        return;
      }
      let m: ServerMsg;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.t === 'welcome') {
        this.token = m.token;
        save('token', m.token);
      }
      if (m.t === 'latency') this.send({ t: 'pong', n: m.n });
      for (const l of this.listeners) l(m);
    };
    ws.onclose = () => {
      this.onStatus?.('closed');
      this.ws = null;
      if (this.wanted && this.retry < 30) {
        this.retry++;
        setTimeout(() => this.wanted && this.connect(this.name), Math.min(5000, 400 * this.retry));
      }
    };
  }

  disconnect() {
    this.wanted = false;
    this.ws?.close();
    this.ws = null;
  }

  get open() {
    return this.ws?.readyState === 1;
  }

  send(m: ClientMsg) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m));
    else if (m.t !== 'cmd' && m.t !== 'pong') this.queue.push(m);
  }

  on(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

export const net = new Net();

/** Hôte distant : la partie tourne sur le serveur. */
export class RemoteHost implements Host {
  readonly local = false;
  onSnapshot: (buf: ArrayBuffer) => void = () => {};
  onEnd: Host['onEnd'] = () => {};
  constructor(private n: Net) {
    n.onBinary = (b) => this.onSnapshot(b);
  }
  send(c: Command) {
    this.n.send({ t: 'cmd', c });
  }
  pause() {}
  dispose() {
    this.n.onBinary = null;
  }
}
