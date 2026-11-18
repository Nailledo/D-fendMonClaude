import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { HERO_IDS, REPLAY_MAX_TICKS, sanitizeMeta, SURVIVAL_MAPS, TICK_RATE, type ClientMsg, type GameConfig, type HeroId, type LoggedCmd } from '@dfend/shared';
import { Scores } from './db';
import { RoomManager } from './rooms';
import { RateLimiter, Tickets, clientIp, originAllowed, sanitizeName } from './security';
import { Validator } from './validate';

const env = process.env;
const PORT = Number(env.PORT ?? 3000);
const MAX_ROOMS = Number(env.MAX_ROOMS ?? 60);
const MAX_CLIENTS = Number(env.MAX_CLIENTS ?? 500);
const MAX_CONN_PER_IP = Number(env.MAX_CONN_PER_IP ?? 8);
/** À activer uniquement derrière un proxy (Caddy) qui écrit X-Forwarded-For. */
const TRUST_PROXY = env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true';
const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const here = fileURLToPath(new URL('.', import.meta.url));
const STATIC_DIR = resolve(env.STATIC_DIR ?? join(here, '../../client/dist'));
const DB_PATH = resolve(env.DB_PATH ?? join(here, '../../../data/scores.db'));
const LOG = env.LOG_LEVEL ?? 'info';
/** Vitesse de jeu maximale (×2) : sert à vérifier qu'une partie n'a pas duré moins longtemps que son journal. */
const MAX_SPEED = 2;
const TIME_SLACK_TICKS = 30 * TICK_RATE;

let scores: Scores | null = null;
try {
  scores = new Scores(DB_PATH);
} catch (e) {
  console.error('Base de scores indisponible :', e);
}
const rooms = new RoomManager(MAX_ROOMS, scores);
const validator = new Validator();
const tickets = new Tickets(env.SCORE_SECRET);
if (!env.SCORE_SECRET && LOG !== 'silent') console.log('SCORE_SECRET absent : clé de signature aléatoire (les tickets en cours sont perdus au redémarrage).');

const scoreLimit = new RateLimiter(3, 60_000);
const seedLimit = new RateLimiter(6, 10 * 60_000);
setInterval(() => {
  scoreLimit.sweep();
  seedLimit.sweep();
  tickets.sweep();
}, 60_000).unref();

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain',
};

/** En-têtes de sécurité communs à toutes les réponses. */
function securityHeaders(req: IncomingMessage): Record<string, string> {
  const host = String(req.headers.host ?? '').replace(/[^a-zA-Z0-9.:\-[\]]/g, '');
  const ws = host ? ` ws://${host} wss://${host}` : '';
  return {
    'content-security-policy': [
      "default-src 'self'",
      // wasm-unsafe-eval : seulement la compilation de WebAssembly (décodeur meshoptimizer des modèles
      // compressés), pas eval() ni les scripts en ligne
      "script-src 'self' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob:",
      // blob: : le chargeur GLTF lit les textures des modèles importés par une URL blob locale
      `connect-src 'self' blob:${ws}`,
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'DENY',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'cross-origin-opener-policy': 'same-origin',
  };
}

function json(req: IncomingMessage, res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { ...securityHeaders(req), 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
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

function difficultyOf(v: unknown): 0 | 1 | 2 {
  const d = Number(v);
  return d === 0 || d === 2 ? d : 1;
}

/** Délivre la graine d'une partie de survie solo, signée par le serveur. */
async function handleSeed(req: IncomingMessage, res: ServerResponse) {
  const ip = clientIp(req, TRUST_PROXY);
  if (!seedLimit.hit(ip)) return json(req, res, 429, { ok: false, error: 'trop de parties lancées, réessayez dans quelques minutes' });
  let body: { mapId?: unknown; difficulty?: unknown };
  try {
    body = JSON.parse(await readBody(req, 1_000));
  } catch {
    return json(req, res, 400, { ok: false, error: 'requête invalide' });
  }
  const mapId = String(body?.mapId ?? '');
  if (!SURVIVAL_MAPS.includes(mapId)) return json(req, res, 400, { ok: false, error: 'carte inconnue' });
  return json(req, res, 200, { ok: true, ...tickets.issue(mapId, difficultyOf(body.difficulty)) });
}

async function handleScore(req: IncomingMessage, res: ServerResponse) {
  const ip = clientIp(req, TRUST_PROXY);
  if (!scoreLimit.hit(ip)) return json(req, res, 429, { ok: false, error: 'trop de requêtes' });
  if (validator.full) return json(req, res, 503, { ok: false, error: 'serveur occupé, réessayez dans une minute' });
  let body: { cfg: GameConfig; log: LoggedCmd[]; claimed: number; ticket: string };
  try {
    body = JSON.parse(await readBody(req, 2_000_000));
  } catch {
    return json(req, res, 400, { ok: false, error: 'requête invalide' });
  }
  const cfg = body?.cfg;
  if (
    !cfg || cfg.mode !== 'survival' || !SURVIVAL_MAPS.includes(cfg.mapId) || !Array.isArray(cfg.players) || cfg.players.length !== 1 ||
    !HERO_IDS.includes(cfg.players[0]?.hero as HeroId) || !Array.isArray(body.log) || body.log.length > 60_000
  ) {
    return json(req, res, 400, { ok: false, error: 'partie invalide' });
  }
  const clean: GameConfig = {
    mode: 'survival', mapId: cfg.mapId, difficulty: difficultyOf(cfg.difficulty), seed: Number(cfg.seed) >>> 0,
    // l'arbre de compétences et les objets changent la partie : le rejeu doit les connaître (bornés)
    players: [{ id: 0, name: sanitizeName(cfg.players[0].name), hero: cfg.players[0].hero, ...sanitizeMeta(cfg.players[0].tree, cfg.players[0].items) }],
  };
  const log: LoggedCmd[] = [];
  let lastTick = 0;
  for (const l of body.log) {
    if (!l || !Number.isInteger(l.tick) || l.tick < 0 || l.tick > REPLAY_MAX_TICKS || !l.c || typeof l.c !== 'object') continue;
    log.push({ tick: l.tick, pid: 0, c: l.c });
    if (l.tick > lastTick) lastTick = l.tick;
  }
  // la graine doit venir du serveur : impossible d'essayer des graines hors ligne pour garder la meilleure
  const t = tickets.redeem(body.ticket, clean.seed, clean.mapId, clean.difficulty);
  if (!t.ok) return json(req, res, 400, { ok: false, error: t.error });
  // une partie ne peut pas durer moins longtemps (en temps réel) que son journal, même en vitesse ×2
  const maxTicks = ((Date.now() - t.issuedAt) / 1000) * TICK_RATE * MAX_SPEED + TIME_SLACK_TICKS;
  if (lastTick > maxTicks) return json(req, res, 400, { ok: false, error: 'journal plus long que la partie' });
  const r = await validator.run(clean, log);
  if (!r.ok || r.wave === undefined) return json(req, res, 400, { ok: false, error: r.error ?? 'rejeu impossible' });
  // défaite au rejeu : elle a eu lieu au même tick que dans la vraie partie, qui ne peut pas avoir été plus courte
  if (r.lost && (r.tick ?? 0) > maxTicks) return json(req, res, 400, { ok: false, error: 'partie plus courte que le rejeu' });
  if (r.wave < Number(body.claimed)) return json(req, res, 400, { ok: false, error: 'score non confirmé par le rejeu' });
  // le rejeu peut aller plus loin que la partie réelle (il continue après la dernière commande) : on garde le score annoncé
  const wave = Math.max(0, Math.min(r.wave, Math.floor(Number(body.claimed)) || 0));
  if (wave > 0) scores?.add(clean.mapId, 1, clean.difficulty, wave, [clean.players[0].name]);
  return json(req, res, 200, { ok: true, wave });
}

function serveStatic(req: IncomingMessage, res: ServerResponse, path: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    res.writeHead(400, securityHeaders(req)).end();
    return;
  }
  let p = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  if (p === '/' || p === '' || p === sep) p = '/index.html';
  let file = join(STATIC_DIR, p);
  if (file !== STATIC_DIR && !file.startsWith(STATIC_DIR + sep)) { res.writeHead(403, securityHeaders(req)).end(); return; }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(STATIC_DIR, 'index.html');
  if (!existsSync(file)) { res.writeHead(404, securityHeaders(req)).end('Client non construit : lancez « pnpm build ».'); return; }
  const ext = extname(file);
  const immutable = file.startsWith(join(STATIC_DIR, 'assets') + sep);
  res.writeHead(200, {
    ...securityHeaders(req),
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  try {
    if (url.pathname === '/health') return json(req, res, 200, { ok: true, ...rooms.stats() });
    if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
      const map = url.searchParams.get('map') ?? '';
      const players = Math.max(1, Math.min(4, Number(url.searchParams.get('players') ?? 1) | 0));
      const difficulty = difficultyOf(url.searchParams.get('difficulty') ?? 1);
      if (!SURVIVAL_MAPS.includes(map)) return json(req, res, 400, { rows: [] });
      return json(req, res, 200, { rows: scores?.top(map, players, difficulty) ?? [] });
    }
    if (url.pathname === '/api/seed' && req.method === 'POST') return await handleSeed(req, res);
    if (url.pathname === '/api/score' && req.method === 'POST') return await handleScore(req, res);
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, url.pathname);
    res.writeHead(405, securityHeaders(req)).end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(req, res, 500, { ok: false });
  }
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
server.on('upgrade', (req, socket, head) => {
  const refuse = (code: number, text: string) => {
    socket.end(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  };
  if (!req.url?.startsWith('/ws')) return void socket.destroy();
  // une page d'un autre site ne peut pas ouvrir de connexion au nom du joueur
  if (!originAllowed(req.headers.origin, req.headers.host, ALLOWED_ORIGINS)) return refuse(403, 'Forbidden');
  const ip = clientIp(req, TRUST_PROXY);
  if (rooms.clients.size >= MAX_CLIENTS || rooms.countIp(ip) >= MAX_CONN_PER_IP) return refuse(429, 'Too Many Requests');
  (req as IncomingMessage & { ip?: string }).ip = ip;
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws, req) => {
  const c = rooms.connect(ws, (req as IncomingMessage & { ip?: string }).ip);
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
  if (LOG !== 'silent') console.log(`D-Fend : serveur prêt sur le port ${PORT} (statique : ${STATIC_DIR}, proxy de confiance : ${TRUST_PROXY ? 'oui' : 'non'})`);
});

const shutdown = () => {
  server.close();
  for (const c of rooms.clients) c.ws.close(1001, 'redémarrage');
  setTimeout(() => process.exit(0), 300);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
