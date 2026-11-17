import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface ScoreRow {
  name: string;
  wave: number;
  date: number;
}

/** Classement de survie (SQLite intégré à Node, aucune dépendance native). */
export class Scores {
  private db: DatabaseSync;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        map TEXT NOT NULL,
        players INTEGER NOT NULL,
        difficulty INTEGER NOT NULL,
        wave INTEGER NOT NULL,
        names TEXT NOT NULL,
        date INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_scores_diff ON scores(map, players, difficulty, wave DESC);
    `);
  }

  add(map: string, players: number, difficulty: number, wave: number, names: string[]) {
    this.db.prepare('INSERT INTO scores (map, players, difficulty, wave, names, date) VALUES (?, ?, ?, ?, ?, ?)').run(map, players, difficulty, wave, names.join(', '), Date.now());
  }

  /** Meilleurs scores pour une carte, un nombre de joueurs et une difficulté. */
  top(map: string, players: number, difficulty: number, limit = 20): ScoreRow[] {
    const rows = this.db
      .prepare('SELECT names AS name, wave, date FROM scores WHERE map = ? AND players = ? AND difficulty = ? ORDER BY wave DESC, date ASC LIMIT ?')
      .all(map, players, difficulty, limit) as unknown as ScoreRow[];
    return rows;
  }
}
