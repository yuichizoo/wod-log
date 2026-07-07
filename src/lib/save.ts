import { db, newId } from '../db/db';
import type { Exercise, Session } from '../types';
import type { ParsedSession } from './parser';
import { detectPRs, type PrRecord } from './pr';
import { guessCategory, guessMode } from '../db/seedExercises';
import { todayISO } from './format';

export interface SaveOutcome {
  prs: (PrRecord & { date: string })[];
  setCount: number;
}

export async function getOrCreateSession(date: string): Promise<Session> {
  const existing = await db.sessions.where('date').equals(date).first();
  if (existing) return existing;
  const s: Session = { id: newId(), date };
  await db.sessions.add(s);
  return s;
}

function norm(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

// 解析結果をDBに保存する。未知種目は自動登録し、保存時にPR判定を行う。
export async function saveParsedSessions(
  parsed: ParsedSession[],
  exercises: Exercise[],
  opts: { detectPr?: boolean } = {},
): Promise<SaveOutcome> {
  const detect = opts.detectPr ?? true;
  const prs: SaveOutcome['prs'] = [];
  let setCount = 0;

  const pool = [...exercises];
  const byName = new Map<string, Exercise>();
  for (const ex of pool) {
    byName.set(norm(ex.name), ex);
    for (const a of ex.aliases) byName.set(norm(a), ex);
  }

  for (const ps of parsed) {
    if (ps.sets.length === 0 && !ps.sessionRpe && !ps.note) continue;
    const date = ps.date ?? todayISO();
    const session = await getOrCreateSession(date);

    const patch: Partial<Session> = {};
    if (ps.sessionRpe != null) patch.sessionRpe = ps.sessionRpe;
    if (ps.note) {
      patch.note = session.note ? `${session.note} / ${ps.note}` : ps.note;
    }
    if (Object.keys(patch).length > 0) await db.sessions.update(session.id, patch);

    for (const set of ps.sets) {
      let ex = set.exerciseId
        ? pool.find((e) => e.id === set.exerciseId)
        : byName.get(norm(set.exerciseName));
      if (!ex) {
        ex = {
          id: newId(),
          name: set.exerciseName,
          aliases: [],
          category: guessCategory(set.exerciseName),
          mode: guessMode(set.exerciseName),
        };
        await db.exercises.add(ex);
        pool.push(ex);
        byName.set(norm(ex.name), ex);
      }

      if (detect) {
        const history = await db.sets.where('exerciseId').equals(ex.id).toArray();
        for (const pr of detectPRs(ex, set, history)) {
          prs.push({ ...pr, date });
        }
      }

      await db.sets.add({
        id: newId(),
        sessionId: session.id,
        exerciseId: ex.id,
        weight: set.weight,
        reps: set.reps,
        isRM: set.isRM || undefined,
        bandLevel: set.bandLevel,
        rpe: set.rpe,
        note: set.note,
        contextFatigued: set.contextFatigued || undefined,
        createdAt: Date.now() + setCount, // 同時保存でも順序を保つ
      });
      setCount++;
    }
  }

  return { prs, setCount };
}
