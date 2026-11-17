import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

/** Fenêtre glissante : au plus `max` événements par `windowMs` et par clé. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(readonly max: number, readonly windowMs: number) {}

  /** Enregistre un événement ; renvoie false si la limite est déjà atteinte. */
  hit(key: string, now = Date.now()): boolean {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.max) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    return true;
  }

  /** Oublie les clés inactives (à appeler régulièrement : la table ne grossit pas indéfiniment). */
  sweep(now = Date.now()) {
    for (const [k, list] of this.hits) if (!list.some((t) => now - t < this.windowMs)) this.hits.delete(k);
  }

  get size() {
    return this.hits.size;
  }
}

/**
 * Adresse du client. Derrière un proxy de confiance (Caddy), on lit le DERNIER élément de
 * X-Forwarded-For : c'est celui ajouté par le proxy, le client ne peut pas le choisir.
 * Sans proxy de confiance, l'en-tête est ignoré.
 */
export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    const raw = Array.isArray(xff) ? xff.join(',') : xff;
    if (raw) {
      const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length) return parts[parts.length - 1];
    }
  }
  return req.socket.remoteAddress ?? 'inconnu';
}

const RESERVED = new Set(['systeme', 'system', 'serveur', 'server', 'admin', 'administrateur', 'moderateur']);

/**
 * Nettoie un texte venant d'un joueur : contrôles, caractères de format invisibles
 * (zéro-largeur, marques bidirectionnelles), chevrons ; espaces normalisés.
 */
export function sanitizeText(s: unknown, max: number): string {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cs}<>]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Nom de joueur : nettoyé, et jamais un nom réservé (« Système »…). */
export function sanitizeName(s: unknown, fallback = 'Joueur'): string {
  const n = sanitizeText(s, 16);
  if (!n) return fallback;
  const plain = n.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/g, '');
  return RESERVED.has(plain) ? fallback : n;
}

/** L'en-tête Origin d'une connexion WebSocket est-il acceptable ? */
export function originAllowed(origin: string | undefined, host: string | undefined, extra: string[] = []): boolean {
  // Clients hors navigateur : pas d'Origin. Ils peuvent de toute façon en forger un ;
  // le contrôle protège contre les pages tierces ouvertes dans le navigateur d'un joueur.
  if (!origin) return true;
  let o: URL;
  try {
    o = new URL(origin);
  } catch {
    return false;
  }
  if (extra.includes(o.origin)) return true;
  if (!host) return false;
  const hostName = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
  return o.hostname.replace(/^\[|\]$/g, '').toLowerCase() === hostName;
}

/**
 * Tickets de partie de survie : le serveur choisit la graine et la signe.
 * Format : graine.carte.difficulté.émission.nonce.signature
 */
export class Tickets {
  private used = new Map<string, number>();
  private secret: Buffer;
  constructor(secret?: string, readonly ttlMs = 6 * 3600_000) {
    this.secret = secret ? Buffer.from(secret, 'utf8') : randomBytes(32);
  }

  private sign(body: string) {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }

  issue(mapId: string, difficulty: number, now = Date.now()): { seed: number; ticket: string } {
    const seed = randomBytes(4).readUInt32LE(0) >>> 0;
    const body = [seed, mapId, difficulty, now, randomBytes(9).toString('base64url')].join('.');
    return { seed, ticket: `${body}.${this.sign(body)}` };
  }

  /**
   * Vérifie un ticket et le consomme (usage unique).
   * Renvoie la date d'émission, ou un message d'erreur.
   */
  redeem(ticket: unknown, seed: number, mapId: string, difficulty: number, now = Date.now()): { ok: true; issuedAt: number } | { ok: false; error: string } {
    if (typeof ticket !== 'string' || ticket.length > 200) return { ok: false, error: 'ticket manquant' };
    const parts = ticket.split('.');
    if (parts.length !== 6) return { ok: false, error: 'ticket invalide' };
    const body = parts.slice(0, 5).join('.');
    const sig = Buffer.from(parts[5]);
    const expect = Buffer.from(this.sign(body));
    if (sig.length !== expect.length || !timingSafeEqual(sig, expect)) return { ok: false, error: 'ticket invalide' };
    const [s, m, d, at, nonce] = parts;
    const issuedAt = Number(at);
    if (Number(s) !== seed >>> 0 || m !== mapId || Number(d) !== difficulty) return { ok: false, error: 'ticket d’une autre partie' };
    if (!Number.isFinite(issuedAt) || now - issuedAt > this.ttlMs || issuedAt > now + 60_000) return { ok: false, error: 'ticket expiré' };
    if (this.used.has(nonce)) return { ok: false, error: 'ticket déjà utilisé' };
    this.used.set(nonce, issuedAt);
    return { ok: true, issuedAt };
  }

  sweep(now = Date.now()) {
    for (const [n, at] of this.used) if (now - at > this.ttlMs) this.used.delete(n);
  }
}
