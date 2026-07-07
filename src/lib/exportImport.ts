import { db } from '../db/db';
import type { Exercise, Session, SetEntry } from '../types';

interface ExportData {
  version: number;
  exportedAt: string;
  exercises: Exercise[];
  sessions: Session[];
  sets: SetEntry[];
}

export async function exportJSON(): Promise<string> {
  const [exercises, sessions, sets] = await Promise.all([
    db.exercises.toArray(),
    db.sessions.toArray(),
    db.sets.toArray(),
  ]);
  const data: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    exercises,
    sessions,
    sets,
  };
  return JSON.stringify(data, null, 2);
}

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportCSV(): Promise<string> {
  const [exercises, sessions, sets] = await Promise.all([
    db.exercises.toArray(),
    db.sessions.toArray(),
    db.sets.toArray(),
  ]);
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const sessMap = new Map(sessions.map((s) => [s.id, s]));
  const header = 'date,exercise,weight,reps,isRM,bandLevel,rpe,note';
  const rows = sets
    .map((s) => ({ s, date: sessMap.get(s.sessionId)?.date ?? '' }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(({ s, date }) =>
      [
        date,
        exMap.get(s.exerciseId)?.name ?? s.exerciseId,
        s.weight ?? '',
        s.reps ?? '',
        s.isRM ? 1 : '',
        s.bandLevel ?? '',
        s.rpe ?? '',
        s.note ?? '',
      ]
        .map(csvEscape)
        .join(','),
    );
  return [header, ...rows].join('\n');
}

export async function importJSON(
  text: string,
): Promise<{ exercises: number; sessions: number; sets: number }> {
  const data = JSON.parse(text) as ExportData;
  if (!Array.isArray(data.exercises) || !Array.isArray(data.sessions) || !Array.isArray(data.sets)) {
    throw new Error('バックアップファイルの形式が正しくありません');
  }
  await db.transaction('rw', db.exercises, db.sessions, db.sets, async () => {
    await db.exercises.clear();
    await db.sessions.clear();
    await db.sets.clear();
    await db.exercises.bulkAdd(data.exercises);
    await db.sessions.bulkAdd(data.sessions);
    await db.sets.bulkAdd(data.sets);
  });
  return {
    exercises: data.exercises.length,
    sessions: data.sessions.length,
    sets: data.sets.length,
  };
}

export function downloadFile(filename: string, text: string, type = 'application/json'): void {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
