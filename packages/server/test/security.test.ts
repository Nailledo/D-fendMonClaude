import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage } from 'node:http';
import { ROOM_CODE_LEN, SURVIVAL_MAPS, replay, type GameConfig } from '@dfend/shared';
import { RateLimiter, Tickets, clientIp, originAllowed, sanitizeName, sanitizeText } from '../src/security';
import { RoomManager, type Client } from '../src/rooms';

describe('RateLimiter', () => {
  it('bloque au-delà de la limite puis relâche après la fenêtre', () => {
    const l = new RateLimiter(2, 1000);
    expect(l.hit('a', 0)).toBe(true);
    expect(l.hit('a', 10)).toBe(true);
    expect(l.hit('a', 20)).toBe(false);
    expect(l.hit('b', 20)).toBe(true);
    expect(l.hit('a', 1015)).toBe(true);
  });
  it('oublie les clés inactives', () => {
    const l = new RateLimiter(1, 1000);
    l.hit('a', 0);
    l.sweep(5000);
    expect(l.size).toBe(0);
  });
});

describe('clientIp', () => {
  const req = (xff: string | undefined, remote = '10.0.0.1') => ({ headers: xff ? { 'x-forwarded-for': xff } : {}, socket: { remoteAddress: remote } }) as unknown as IncomingMessage;
  it('ignore X-Forwarded-For sans proxy de confiance', () => {
    expect(clientIp(req('1.2.3.4'), false)).toBe('10.0.0.1');
  });
  it('prend la dernière adresse (celle écrite par le proxy)', () => {
    expect(clientIp(req('6.6.6.6, 1.2.3.4'), true)).toBe('1.2.3.4');
  });
});

describe('noms et textes', () => {
  it('retire les caractères invisibles et bidirectionnels', () => {
    expect(sanitizeText('a​b‮c<d>', 20)).toBe('abcd');
  });
  it('refuse les noms réservés, accents et casse compris', () => {
    expect(sanitizeName('Système')).toBe('Joueur');
    expect(sanitizeName('  SYSTEME ')).toBe('Joueur');
    expect(sanitizeName('Sys​tème')).toBe('Joueur');
    expect(sanitizeName('Lyra')).toBe('Lyra');
  });
});

describe('originAllowed', () => {
  it('accepte la même origine et les clients sans Origin', () => {
    expect(originAllowed('https://defend.sayk.fr', 'defend.sayk.fr')).toBe(true);
    expect(originAllowed('http://localhost:5173', 'localhost:5173')).toBe(true);
    expect(originAllowed(undefined, 'defend.sayk.fr')).toBe(true);
  });
  it('refuse une page d’un autre site', () => {
    expect(originAllowed('https://evil.example', 'defend.sayk.fr')).toBe(false);
    expect(originAllowed('https://defend.sayk.fr.evil.example', 'defend.sayk.fr')).toBe(false);
    expect(originAllowed('nimporte quoi', 'defend.sayk.fr')).toBe(false);
  });
  it('accepte les origines ajoutées explicitement', () => {
    expect(originAllowed('https://autre.fr', 'defend.sayk.fr', ['https://autre.fr'])).toBe(true);
  });
});

describe('Tickets', () => {
  const map = SURVIVAL_MAPS[0];
  it('valide un ticket une seule fois', () => {
    const t = new Tickets('secret');
    const { seed, ticket } = t.issue(map, 1, 1000);
    expect(t.redeem(ticket, seed, map, 1, 2000)).toEqual({ ok: true, issuedAt: 1000 });
    expect(t.redeem(ticket, seed, map, 1, 3000).ok).toBe(false);
  });
  it('refuse une autre graine, carte ou difficulté', () => {
    const t = new Tickets('secret');
    const { seed, ticket } = t.issue(map, 1, 1000);
    expect(t.redeem(ticket, seed + 1, map, 1, 2000).ok).toBe(false);
    expect(t.redeem(ticket, seed, map, 2, 2000).ok).toBe(false);
  });
  it('refuse un ticket falsifié ou signé avec une autre clé', () => {
    const a = new Tickets('a'), b = new Tickets('b');
    const { seed, ticket } = a.issue(map, 1, 1000);
    expect(b.redeem(ticket, seed, map, 1, 2000).ok).toBe(false);
    const forged = ticket.replace(/^\d+/, String(seed ^ 1));
    expect(a.redeem(forged, seed ^ 1, map, 1, 2000).ok).toBe(false);
  });
  it('refuse un ticket expiré', () => {
    const t = new Tickets('s', 1000);
    const { seed, ticket } = t.issue(map, 1, 0);
    expect(t.redeem(ticket, seed, map, 1, 5000).ok).toBe(false);
  });
});

describe('replay', () => {
  it('s’arrête 3 min après la dernière commande, même sans commande', () => {
    const cfg: GameConfig = { mode: 'survival', mapId: SURVIVAL_MAPS[0], difficulty: 1, seed: 1, players: [{ id: 0, name: 'T', hero: 'samuel' }] };
    const r = replay(cfg, []);
    expect(r.tick).toBeLessThanOrEqual(20 * 60 * 3);
  });
});

describe('RoomManager', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const fakeWs = () => {
    const sent: { t: string; msg?: string; code?: string }[] = [];
    const ws = { readyState: 1, send: (s: unknown) => typeof s === 'string' && sent.push(JSON.parse(s)), close: vi.fn() };
    return { ws, sent };
  };
  const hello = (mgr: RoomManager, ip = '1.1.1.1') => {
    const f = fakeWs();
    const c = mgr.connect(f.ws as never, ip);
    mgr.message(c, { t: 'hello', name: 'Test' });
    return { c, sent: f.sent, ws: f.ws };
  };

  it('crée des codes de la bonne longueur', () => {
    const mgr = new RoomManager(10, null);
    const { c } = hello(mgr);
    mgr.message(c, { t: 'create' });
    expect([...mgr.rooms.keys()][0]).toHaveLength(ROOM_CODE_LEN);
  });

  it('supprime tout de suite un salon vide et limite les créations', () => {
    const mgr = new RoomManager(60, null);
    const { c, sent } = hello(mgr);
    for (let i = 0; i < 10; i++) mgr.message(c, { t: 'create' });
    // 3 créations autorisées par minute, et les salons abandonnés ne restent pas
    expect(mgr.rooms.size).toBe(1);
    expect(sent.filter((m) => m.t === 'error').length).toBe(7);
    mgr.message(c, { t: 'leave' });
    expect(mgr.rooms.size).toBe(0);
  });

  it('limite les tentatives pour deviner un code', () => {
    const mgr = new RoomManager(60, null);
    const { c, sent } = hello(mgr);
    for (let i = 0; i < 8; i++) mgr.message(c, { t: 'join', code: 'ZZZZZ' + i });
    const errs = sent.filter((m) => m.t === 'error').map((m) => m.msg);
    expect(errs.filter((m) => m?.startsWith('Salon introuvable')).length).toBe(5);
    expect(errs.filter((m) => m?.startsWith('Trop de tentatives')).length).toBe(3);
  });

  it('ferme une connexion qui inonde le serveur', () => {
    const mgr = new RoomManager(60, null);
    const { c, ws } = hello(mgr);
    for (let i = 0; i < 100; i++) mgr.message(c, { t: 'ready', ready: true } as never);
    expect(ws.close).toHaveBeenCalled();
    expect((c as Client).msgBudget).toBeLessThan(0);
  });

  it('remplace un nom réservé', () => {
    const mgr = new RoomManager(60, null);
    const f = fakeWs();
    const c = mgr.connect(f.ws as never, '1.1.1.1');
    mgr.message(c, { t: 'hello', name: 'Système' });
    expect(c.name).toBe('Joueur');
  });
});
