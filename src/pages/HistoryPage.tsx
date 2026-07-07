import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Exercise, Session, SetEntry } from '../types';
import { formatDateJP } from '../lib/format';
import Modal from '../components/Modal';
import { BAND_LEVELS } from '../lib/bands';

const COND_EMOJIS = ['😫', '😕', '😐', '🙂', '💪'];
const MOT_EMOJIS = ['🥱', '😑', '😐', '😊', '🔥'];

export default function HistoryPage() {
  const [editing, setEditing] = useState<SetEntry | null>(null);
  const data = useLiveQuery(async () => {
    const [sessions, sets, exercises] = await Promise.all([
      db.sessions.toArray(),
      db.sets.toArray(),
      db.exercises.toArray(),
    ]);
    return { sessions, sets, exercises };
  }, []);

  if (!data) return null;
  const { sessions, sets, exercises } = data;
  const exMap = new Map(exercises.map((e) => [e.id, e]));

  const setsBySession = new Map<string, SetEntry[]>();
  for (const s of sets) {
    if (!setsBySession.has(s.sessionId)) setsBySession.set(s.sessionId, []);
    setsBySession.get(s.sessionId)!.push(s);
  }

  const sorted = [...sessions].sort((a, b) => (a.date > b.date ? -1 : 1));

  if (sorted.length === 0) {
    return <div className="card text-sm text-gray-500">まだ記録がありません。</div>;
  }

  async function deleteSession(sess: Session) {
    if (!window.confirm(`${formatDateJP(sess.date)} の記録をすべて削除しますか?`)) return;
    await db.transaction('rw', db.sessions, db.sets, async () => {
      await db.sets.where('sessionId').equals(sess.id).delete();
      await db.sessions.delete(sess.id);
    });
  }

  return (
    <div className="space-y-3">
      {sorted.map((sess) => {
        const ss = (setsBySession.get(sess.id) ?? []).sort(
          (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
        );
        return (
          <div key={sess.id} className="card space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-bold">{formatDateJP(sess.date)}</span>
              {sess.preCondition != null && <span>{COND_EMOJIS[sess.preCondition - 1]}</span>}
              {sess.motivation != null && <span>{MOT_EMOJIS[sess.motivation - 1]}</span>}
              {sess.sessionRpe != null && (
                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                  RPE {sess.sessionRpe}
                </span>
              )}
              <span className="flex-1" />
              <button
                onClick={() => deleteSession(sess)}
                className="px-1 text-gray-400"
                aria-label="セッション削除"
              >
                🗑
              </button>
            </div>
            {sess.note && <div className="text-xs text-gray-500">📝 {sess.note}</div>}
            <div className="space-y-1">
              {ss.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setEditing(s)}
                  className="flex w-full items-center gap-2 rounded-lg bg-stone-100 px-3 py-2 text-left text-sm dark:bg-gray-800"
                >
                  <span className="flex-1">
                    <span className="font-medium">
                      {exMap.get(s.exerciseId)?.name ?? '?'}
                    </span>{' '}
                    {s.bandLevel && <span className="text-violet-500">{s.bandLevel} </span>}
                    {s.weight != null && <span>{s.weight}kg </span>}
                    {s.reps != null && <span>× {s.reps}回</span>}
                    {s.isRM && <span className="ml-1 font-bold text-orange-500">RM</span>}
                    {s.rpe != null && (
                      <span className="ml-1 text-xs text-gray-500">RPE{s.rpe}</span>
                    )}
                    {s.note && (
                      <div className="truncate text-xs text-gray-500">📝 {s.note}</div>
                    )}
                  </span>
                  <span className="text-gray-300">›</span>
                </button>
              ))}
              {ss.length === 0 && (
                <div className="text-xs text-gray-400">セットなし(チェックインのみ)</div>
              )}
            </div>
          </div>
        );
      })}
      {editing && (
        <EditSetModal
          set={editing}
          exercise={exMap.get(editing.exerciseId)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EditSetModal({
  set,
  exercise,
  onClose,
}: {
  set: SetEntry;
  exercise: Exercise | undefined;
  onClose: () => void;
}) {
  const [weight, setWeight] = useState(set.weight != null ? String(set.weight) : '');
  const [reps, setReps] = useState(set.reps != null ? String(set.reps) : '');
  const [isRM, setIsRM] = useState(!!set.isRM);
  const [band, setBand] = useState(set.bandLevel ?? '');
  const [rpe, setRpe] = useState(set.rpe != null ? String(set.rpe) : '');
  const [note, setNote] = useState(set.note ?? '');

  async function save() {
    await db.sets.update(set.id, {
      weight: weight === '' ? undefined : parseFloat(weight),
      reps: reps === '' ? undefined : parseInt(reps, 10),
      isRM: isRM || undefined,
      bandLevel: band || undefined,
      rpe: rpe === '' ? undefined : parseInt(rpe, 10),
      note: note || undefined,
    });
    onClose();
  }

  async function remove() {
    if (!window.confirm('このセットを削除しますか?')) return;
    await db.sets.delete(set.id);
    onClose();
  }

  return (
    <Modal open title={exercise?.name ?? 'セット編集'} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <label className="flex-1">
            <div className="mb-1 text-xs text-gray-500">重量 (kg)</div>
            <input
              type="number"
              inputMode="decimal"
              className="input"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </label>
          <label className="flex-1">
            <div className="mb-1 text-xs text-gray-500">回数</div>
            <input
              type="number"
              inputMode="numeric"
              className="input"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
            />
          </label>
        </div>
        {exercise?.mode === 'band' && (
          <label className="block">
            <div className="mb-1 text-xs text-gray-500">バンド</div>
            <select className="input" value={band} onChange={(e) => setBand(e.target.value)}>
              <option value="">なし</option>
              {BAND_LEVELS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={isRM}
              onChange={(e) => setIsRM(e.target.checked)}
              className="h-5 w-5 accent-orange-500"
            />
            限界記録 (RM)
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            RPE
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              className="input w-16 px-2 py-1"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
            />
          </label>
        </div>
        <label className="block">
          <div className="mb-1 text-xs text-gray-500">メモ</div>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <button onClick={remove} className="btn-secondary flex-1 text-red-500">
            削除
          </button>
          <button onClick={save} className="btn-primary flex-1">
            保存
          </button>
        </div>
      </div>
    </Modal>
  );
}
