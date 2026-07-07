import { useState } from 'react';
import type { Exercise } from '../types';
import type { ParseResult, ParsedSession, ParsedSet } from '../lib/parser';
import { todayISO, formatDateJP } from '../lib/format';
import Modal from './Modal';

interface Props {
  result: ParseResult;
  exercises: Exercise[];
  onSave: (sessions: ParsedSession[]) => Promise<void>;
  onCancel: () => void;
}

// 解析結果の確認・修正モーダル
export default function ParsePreview({ result, onSave, onCancel }: Props) {
  const [sessions, setSessions] = useState<ParsedSession[]>(() =>
    result.sessions.map((s) => ({ ...s, sets: s.sets.map((t) => ({ ...t })) })),
  );
  const [busy, setBusy] = useState(false);

  const totalSets = sessions.reduce((a, s) => a + s.sets.length, 0);

  function updateSet(si: number, ti: number, patch: Partial<ParsedSet>) {
    setSessions((prev) =>
      prev.map((s, i) =>
        i !== si ? s : { ...s, sets: s.sets.map((t, j) => (j !== ti ? t : { ...t, ...patch })) },
      ),
    );
  }

  function removeSet(si: number, ti: number) {
    setSessions((prev) =>
      prev.map((s, i) => (i !== si ? s : { ...s, sets: s.sets.filter((_, j) => j !== ti) })),
    );
  }

  async function save() {
    setBusy(true);
    try {
      await onSave(sessions);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="解析結果の確認" onClose={onCancel}>
      <div className="space-y-4">
        {sessions.map((sess, si) => (
          <div key={si} className="rounded-xl border border-stone-200 p-3 dark:border-gray-800">
            <div className="mb-2 text-sm font-bold text-orange-600 dark:text-orange-400">
              {sess.date ? formatDateJP(sess.date) : `今日 (${formatDateJP(todayISO())})`}
              {sess.sessionRpe != null && (
                <span className="ml-2 text-gray-500">きつさ {sess.sessionRpe}/10</span>
              )}
            </div>
            {sess.warnings.map((w, i) => (
              <div
                key={i}
                className="mb-2 rounded-lg bg-amber-100 px-2 py-1 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
              >
                ⚠️ {w}
              </div>
            ))}
            <div className="space-y-2">
              {sess.sets.map((set, ti) => (
                <div key={ti} className="rounded-lg bg-stone-100 p-2 dark:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate text-sm font-medium">
                      {set.exerciseName}
                      {set.isUnknown && (
                        <span className="ml-1 rounded bg-sky-100 px-1 text-[10px] text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                          新規登録
                        </span>
                      )}
                      {set.isRM && (
                        <span className="ml-1 rounded bg-orange-100 px-1 text-[10px] text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                          RM
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => removeSet(si, ti)}
                      className="px-1 text-lg text-gray-400"
                      aria-label="削除"
                    >
                      🗑
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <label className="flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        className="input w-20 px-2 py-1"
                        value={set.weight ?? ''}
                        onChange={(e) =>
                          updateSet(si, ti, {
                            weight: e.target.value === '' ? undefined : parseFloat(e.target.value),
                          })
                        }
                      />
                      <span className="text-xs text-gray-500">kg</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        className="input w-16 px-2 py-1"
                        value={set.reps ?? ''}
                        onChange={(e) =>
                          updateSet(si, ti, {
                            reps: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                          })
                        }
                      />
                      <span className="text-xs text-gray-500">回</span>
                    </label>
                    {set.bandLevel && (
                      <span className="rounded bg-violet-100 px-2 py-1 text-xs text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                        {set.bandLevel}バンド
                      </span>
                    )}
                  </div>
                  {set.note && (
                    <div className="mt-1 truncate text-xs text-gray-500">📝 {set.note}</div>
                  )}
                </div>
              ))}
              {sess.sets.length === 0 && (
                <div className="text-sm text-gray-400">セットなし</div>
              )}
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary flex-1">
            キャンセル
          </button>
          <button onClick={save} disabled={busy || totalSets === 0} className="btn-primary flex-1">
            {busy ? '保存中…' : `${totalSets}セットを保存`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
