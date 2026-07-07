import Dexie, { type Table } from 'dexie';
import type { Exercise, Session, SetEntry } from '../types';
import { SEED_EXERCISES } from './seedExercises';

class WodLogDB extends Dexie {
  exercises!: Table<Exercise, string>;
  sessions!: Table<Session, string>;
  sets!: Table<SetEntry, string>;

  constructor() {
    super('wod-log');
    this.version(1).stores({
      exercises: 'id, name, category, mode',
      sessions: 'id, date',
      sets: 'id, sessionId, exerciseId',
    });
    this.on('populate', () => {
      this.exercises.bulkAdd(SEED_EXERCISES);
    });
  }
}

export const db = new WodLogDB();

export function newId(): string {
  return crypto.randomUUID();
}
