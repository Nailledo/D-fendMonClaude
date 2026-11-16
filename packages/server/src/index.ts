import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { SURVIVAL_MAPS, type ClientMsg, type GameConfig, type LoggedCmd } from '@dfend/shared';
import { Scores } from './db';
import { RoomManager } from './rooms';
import { Validator } from './validate';

const PORT = Number(process.env.PORT ?? 3000);
const MAX_ROOMS = Number(process.env.MAX_ROOMS ?? 60);
const here = fileURLToPath(new URL('.', import.meta.url));
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? join(here, '../../client/dist'));
const DB_PATH = resolve(process.env.DB_PATH ?? join(here, '../../../data/scores.db'));
const LOG = process.env.LOG_LEVEL ?? 'info';

let scores: Scores | null = null;
try {
  scores = new Scores(DB_PATH);
} catch (e) {
  console.error('Base de scores indisponible :', e);
}
const rooms = new RoomManager(MAX_ROOMS, scores);
const validator = new Validator();

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain',
};

function json(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage, max: number): Promise<string> {
  return new Promise((res, rej) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > max) { rej(new Error('trop gros')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rej);
  });
}

// limitation simple des envois de score par IP
const scoreHits = new Map<string, number[]>();
function allowScore(ip: string) {
  const now = Date.now();
  const list = (scoreHits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= 3) return false;
  list.push(now);
  scoreHits.set(ip, list);
  return true;
}

async function handleScore(req: IncomingMessage, res: ServerResponse) {
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
  if (!allowScore(ip)) return json(res, 429, { ok: false, error: 'trop de requêtes' });
  if (validator.pending > 8) return json(res, 503, { ok: false, error: 'serveur occupé' });
  let body: { cfg: GameConfig; log: LoggedCmd[]; claimed: number };
  try {
    body = JSON.parse(await readBody(req, 2_000_000));
  } catch {
    return json(res, 400, { ok: false, error: 'requête invalide' });
  }
  const cfg = body?.cfg;
  if (!cfg || cfg.mode !== 'survival' || !SURVIVAL_MAPS.includes(cfg.mapId) || !Array.isArray(cfg.players) || cfg.players.length !== 1 || !Array.isArray(body.log) || body.log.length > 60_000) {
    return json(res, 400, { ok: false, error: 'partie invalide' });
  }
  const clean: GameConfig = {
    mode: 'survival', mapId: cfg.mapId, difficulty: cfg.difficulty === 0 || cfg.difficulty === 2 ? cfg.difficulty : 1, seed: Number(cfg.seed) >>> 0,
    players: [{ id: 0, name: String(cfg.players[0].name ?? 'Joueur').replace(/[\u0000-\u001f<>]/g, '').slice(0, 16) || 'Joueur', hero: cfg.players[0].hero }],
  };
  const log = body.log.filter((l) => l && Number.isInteger(l.tick) && l.tick >= 0 && l.c && typeof l.c === 'object').map((l) => ({ tick: l.tick, pid: 0, c: l.c }));
  const r = await validator.run(clean, log);
  if (!r.ok || r.wave === undefined) return json(res, 400, { ok: false, error: r.error ?? 'rejeu impossible' });
  if (r.wave < Number(body.claimed)) return json(res, 400, { ok: false, error: 'score non confirmé par le rejeu' });
  if (r.wave > 0) scores?.add(clean.mapId, 1, clean.difficulty, r.wave, [clean.players[0].name]);
  return json(res, 200, { ok: true, wave: r.wave });
}

function serveStatic(req: IncomingMessage, res: ServerResponse, path: string) {
  let p = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, '');
  if (p === '/' || p === '') p = '/index.html';
  let file = join(STATIC_DIR, p);
  if (!file.startsWith(STATIC_DIR)) { res.writeHead(403).end(); return; }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(STATIC_DIR, 'index.html');
  if (!existsSync(file)) { res.writeHead(404).end('Client non construit : lancez « pnpm build ».'); return; }
  const ext = extname(file);
  const immutable = file.includes(`${join(STATIC_DIR, 'assets')}`);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  try {
    if (url.pathname === '/health') return json(res, 200, { ok: true, ...rooms.stats() });
    if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
      const map = url.searchParams.get('map') ?? '';
      const players = Math.max(1, Math.min(4, Number(url.searchParams.get('players') ?? 1) | 0));
      if (!SURVIVAL_MAPS.includes(map)) return json(res, 400, { rows: [] });
      return json(res, 200, { rows: scores?.top(map, players) ?? [] });
    }
    if (url.pathname === '/api/score' && req.method === 'POST') return await handleScore(req, res);
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, url.pathname);
    res.writeHead(405).end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { ok: false });
  }
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
server.on('upgrade', (req, socket, head) => {
  if (!req.url?.startsWith('/ws')) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws) => {
  const c = rooms.connect(ws);
  ws.on('message', (data, isBinary) => {
    if (isBinary) return;
    let m: ClientMsg;
    try {
      m = JSON.parse(String(data));
    } catch {
      return;
    }
    if (!m || typeof m !== 'object' || typeof (m as { t?: unknown }).t !== 'string') return;
    try {
      rooms.message(c, m);
    } catch (e) {
      console.error('message', e);
    }
  });
  ws.on('pong', () => (c.alive = true));
  ws.on('close', () => rooms.close(c));
  ws.on('error', () => ws.close());
});

// détection des connexions mortes
setInterval(() => {
  for (const c of rooms.clients) {
    if (!c.alive) { c.ws.terminate(); continue; }
    c.alive = false;
    c.ws.ping();
  }
}, 15_000);

server.listen(PORT, () => {
  if (LOG !== 'silent') console.log(`D-Fend : serveur prêt sur le port ${PORT} (statique : ${STATIC_DIR})`);
});

const shutdown = () => {
  server.close();
  for (const c of rooms.clients) c.ws.close(1001, 'redémarrage');
  setTimeout(() => process.exit(0), 300);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
