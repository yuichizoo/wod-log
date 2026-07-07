import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../db/db';
import type { Exercise, Session, SetEntry } from '../types';
import { todayISO } from '../lib/format';
import { parseFreeText, type ParseResult, type ParsedSession } from '../lib/parser';
import { parseWithClaude } from '../lib/claudeParser';
import { getApiKey } from '../lib/apiKey';
import { getOrCreateSession, saveParsedSessions } from '../lib/save';
import { detectPRs, type PrRecord } from '../lib/pr';
import { firePrConfetti } from '../lib/celebrate';
import { BAND_LEVELS } from '../lib/bands';
import { roundTo } from '../lib/e1rm';
import ParsePreview from '../components/ParsePreview';
import Modal from '../components/Modal';

const COND_EMOJIS = ['😫', '😕', '😐', '🙂', '💪'];
const MOT_EMOJIS = ['🥱', '😑', '😐', '😊', '🔥'];
const SLEEP_EMOJIS = ['😵', '😪', '😐', '🙂', '😴'];

const KONJO_MESSAGES = [
  '低モチでも来た。それが一番えらい 🔥',
  'やる気ゼロで出席。それこそ本物の強さ 🔥',
  '気分が乗らない日に来るのがチャンピオン 🏆',
];

export default function RecordPage() {
  const today = todayISO();
  const data = useLiveQuery(async () => {
    const session = await db.sessions.where('date').equals(today).first();
    const exercises = await db.exercises.toArray();
    const sets = session
      ? await db.sets.where('sessionId').equals(session.id).toArray()
      : [];
    return { session, exercises, sets };
  }, [today]);

  const [checkinSkipped, setCheckinSkipped] = useState(false);
  const [celebration, setCelebration] = useState<PrRecord[] | null>(null);
  const [konjoMsg, setKonjoMsg] = useState<string | null>(null);

  if (!data) return null;
  const { session, exercises, sets } = data;

  const needCheckin =
    !checkinSkipped && (!session || (session.preCondition == null && session.motivation == null));

  const handleSaved = (prs: PrRecord[]) => {
    if (prs.length > 0) {
      firePrConfetti();
      setCelebration(prs);
    }
  };

  const handleCheckinDone = (motivation: number | null) => {
    if (motivation != null && motivation <= 2) {
      setKonjoMsg(
        KONJO_MESSAGES[Math.floor(Math.random() * KONJO_MESSAGES.length)] +
          ' 「気合い出席」+1',
      );
    }
  };

  if (needCheckin) {
    return (
      <CheckIn onDone={handleCheckinDone} onSkip={() => setCheckinSkipped(true)} />
    );
  }

  return (
    <div className="space-y-4">
      {konjoMsg && (
        <div className="card border-orange-300 bg-orange-50 text-sm font-bold text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300">
          {konjoMsg}
        </div>
      )}
      {session && (session.preCondition != null || session.motivation != null) && (
        <div className="flex items-center gap-3 px-1 text-sm text-gray-500">
          {session.preCondition != null && (
            <span>体調 {COND_EMOJIS[session.preCondition - 1]}</span>
          )}
          {session.motivation != null && (
            <span>モチベ {MOT_EMOJIS[session.motivation - 1]}</span>
          )}
          {session.sleepQuality != null && (
            <span>睡眠 {SLEEP_EMOJIS[session.sleepQuality - 1]}</span>
          )}
        </div>
      )}
      {checkinSkipped && (!session || session.preCondition == null) && (
        <button
          onClick={() => setCheckinSkipped(false)}
          className="px-1 text-sm text-orange-500 underline"
        >
          チェックインを入力する
        </button>
      )}
      <VoiceParseCard exercises={exercises} onSaved={handleSaved} />
      <QuickInputCard exercises={exercises} onSaved={handleSaved} />
      <TodaySetsCard sets={sets} exercises={exercises} />
      <SessionRpeCard session={session} />
      {celebration && (
        <PrBanner prs={celebration} onClose={() => setCelebration(null)} />
      )}
    </div>
  );
}

// ---------- プレワークアウトチェックイン ----------

function CheckIn({
  onDone,
  onSkip,
}: {
  onDone: (motivation: number | null) => void;
  onSkip: () => void;
}) {
  const [cond, setCond] = useState<number | null>(null);
  const [mot, setMot] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const s = await getOrCreateSession(todayISO());
      await db.sessions.update(s.id, {
        preCondition: cond ?? undefined,
        motivation: mot ?? undefined,
        sleepQuality: sleep ?? undefined,
      });
      onDone(mot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-5">
      <div>
        <h2 className="text-lg font-black">今日のチェックイン</h2>
        <p className="text-xs text-gray-500">タップだけ・5秒で完了</p>
      </div>
      <EmojiRow label="体調" emojis={COND_EMOJIS} value={cond} onChange={setCond} />
      <EmojiRow label="モチベーション" emojis={MOT_EMOJIS} value={mot} onChange={setMot} />
      <EmojiRow
        label="昨夜の睡眠 (任意)"
        emojis={SLEEP_EMOJIS}
        value={sleep}
        onChange={setSleep}
      />
      <button
        onClick={start}
        disabled={busy || cond == null || mot == null}
        className="btn-primary w-full text-lg"
      >
        記録をはじめる 💪
      </button>
      <button onClick={onSkip} className="w-full text-center text-sm text-gray-500 underline">
        スキップして記録へ
      </button>
    </div>
  );
}

function EmojiRow({
  label,
  emojis,
  value,
  onChange,
}: {
  label: string;
  emojis: string[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium">{label}</div>
      <div className="flex gap-2">
        {emojis.map((e, i) => (
          <button
            key={i}
            onClick={() => onChange(i + 1)}
            className={`flex-1 rounded-xl py-3 text-3xl transition active:scale-95 ${
              value === i + 1
                ? 'bg-orange-100 ring-2 ring-orange-500 dark:bg-orange-900/40'
                : 'bg-stone-100 dark:bg-gray-800'
            }`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- 音声テキスト解析 ----------

function VoiceParseCard({
  exercises,
  onSaved,
}: {
  exercises: Exercise[];
  onSaved: (prs: PrRecord[]) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);

  async function analyze() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const key = getApiKey();
      let r: ParseResult;
      if (key) {
        try {
          r = await parseWithClaude(text, exercises, key);
        } catch (e) {
          r = parseFreeText(text, exercises, { defaultDate: todayISO() });
          setError(
            `Claude APIでの解析に失敗したため簡易解析を使用しました: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }
      } else {
        r = parseFreeText(text, exercises, { defaultDate: todayISO() });
      }
      setResult(r);
    } finally {
      setBusy(false);
    }
  }

  async function save(sessions: ParsedSession[]) {
    const withDate = sessions.map((s) => ({ ...s, date: s.date ?? todayISO() }));
    const outcome = await saveParsedSessions(withDate, exercises);
    setResult(null);
    setText('');
    onSaved(outcome.prs);
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-bold">🎙️ 音声入力テキストから記録</h2>
      <textarea
        className="input min-h-[88px]"
        placeholder="例: 今日パワースナッチ25キロ15回、その後ウォールボール4.6、全体のきつさ8"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <div className="text-xs text-amber-600 dark:text-amber-400">{error}</div>}
      <button
        onClick={analyze}
        disabled={busy || !text.trim()}
        className="btn-primary w-full"
      >
        {busy ? '解析中…' : '解析する'}
      </button>
      {result && (
        <ParsePreview
          result={result}
          exercises={exercises}
          onSave={save}
          onCancel={() => setResult(null)}
        />
      )}
    </div>
  );
}

// ---------- クイック入力 ----------

function QuickInputCard({
  exercises,
  onSaved,
}: {
  exercises: Exercise[];
  onSaved: (prs: PrRecord[]) => void;
}) {
  const counts =
    useLiveQuery(async () => {
      const all = await db.sets.toArray();
      const m: Record<string, number> = {};
      for (const s of all) m[s.exerciseId] = (m[s.exerciseId] ?? 0) + 1;
      return m;
    }, []) ?? {};

  const sorted = [...exercises].sort(
    (a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0),
  );

  const [exId, setExId] = useState('');
  const effectiveId = exId || sorted[0]?.id || '';
  const ex = exercises.find((e) => e.id === effectiveId);

  const [weight, setWeight] = useState(20);
  const [reps, setReps] = useState(5);
  const [isRM, setIsRM] = useState(false);
  const [band, setBand] = useState(BAND_LEVELS[2]);
  const [rpe, setRpe] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // 前回の記録をデフォルト値としてプリセット
  useEffect(() => {
    if (!effectiveId) return;
    let cancelled = false;
    (async () => {
      const all = await db.sets.where('exerciseId').equals(effectiveId).toArray();
      const last = all.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
      if (cancelled || !last) return;
      if (last.weight != null) setWeight(last.weight);
      if (last.reps != null) setReps(last.reps);
      if (last.bandLevel) setBand(last.bandLevel);
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveId]);

  async function save() {
    if (!ex) return;
    setBusy(true);
    try {
      const entry =
        ex.mode === 'band'
          ? { bandLevel: band, reps }
          : { weight, reps };
      const history = await db.sets.where('exerciseId').equals(ex.id).toArray();
      const prs = detectPRs(ex, entry, history);
      const session = await getOrCreateSession(todayISO());
      await db.sets.add({
        id: newId(),
        sessionId: session.id,
        exerciseId: ex.id,
        ...entry,
        isRM: isRM || undefined,
        rpe: rpe ?? undefined,
        createdAt: Date.now(),
      } as SetEntry);
      setIsRM(false);
      setRpe(null);
      onSaved(prs);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } finally {
      setBusy(false);
    }
  }

  if (!ex) return null;

  return (
    <div className="card space-y-3">
      <h2 className="font-bold">⚡ クイック入力</h2>
      <select
        className="input"
        value={effectiveId}
        onChange={(e) => setExId(e.target.value)}
      >
        {sorted.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>

      {ex.mode === 'band' ? (
        <div>
          <div className="mb-1 text-xs text-gray-500">バンド (強い補助 → 弱い補助)</div>
          <div className="flex gap-1.5">
            {BAND_LEVELS.map((b) => (
              <button
                key={b}
                onClick={() => setBand(b)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition active:scale-95 ${
                  band === b
                    ? 'bg-orange-500 text-white'
                    : 'bg-stone-100 dark:bg-gray-800'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Stepper
          value={weight}
          step={2.5}
          min={0}
          unit="kg"
          onChange={setWeight}
        />
      )}

      <Stepper value={reps} step={1} min={1} unit="回" onChange={(v) => setReps(Math.round(v))} />

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={isRM}
            onChange={(e) => setIsRM(e.target.checked)}
            className="h-5 w-5 accent-orange-500"
          />
          限界記録 (RM)
        </label>
      </div>

      <div>
        <div className="mb-1 text-xs text-gray-500">セットのきつさ RPE (任意)</div>
        <div className="flex gap-1">
          {[...Array(10)].map((_, i) => (
            <button
              key={i}
              onClick={() => setRpe(rpe === i + 1 ? null : i + 1)}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                rpe === i + 1
                  ? 'bg-orange-500 text-white'
                  : 'bg-stone-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={busy} className="btn-primary w-full text-lg">
        {savedFlash ? '保存しました ✅' : '記録する'}
      </button>
    </div>
  );
}

function Stepper({
  value,
  step,
  min,
  unit,
  onChange,
}: {
  value: number;
  step: number;
  min: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, roundTo(value - step, 2)))}
        className="h-14 w-14 shrink-0 rounded-2xl bg-stone-200 text-2xl font-bold transition active:scale-95 dark:bg-gray-800"
      >
        −
      </button>
      <div className="flex-1 text-center">
        <input
          inputMode="decimal"
          value={String(value)}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(v);
          }}
          className="w-full bg-transparent text-center text-3xl font-black outline-none"
        />
        <div className="text-xs text-gray-500">{unit}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(roundTo(value + step, 2))}
        className="h-14 w-14 shrink-0 rounded-2xl bg-stone-200 text-2xl font-bold transition active:scale-95 dark:bg-gray-800"
      >
        ＋
      </button>
    </div>
  );
}

// ---------- 今日の記録一覧 ----------

function TodaySetsCard({
  sets,
  exercises,
}: {
  sets: SetEntry[];
  exercises: Exercise[];
}) {
  if (sets.length === 0) return null;
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const ordered = [...sets].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  return (
    <div className="card space-y-2">
      <h2 className="font-bold">今日の記録 ({sets.length}セット)</h2>
      {ordered.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-2 rounded-lg bg-stone-100 px-3 py-2 text-sm dark:bg-gray-800"
        >
          <span className="flex-1 truncate">
            <span className="font-medium">{exMap.get(s.exerciseId)?.name ?? '?'}</span>{' '}
            {s.bandLevel && <span className="text-violet-500">{s.bandLevel} </span>}
            {s.weight != null && <span>{s.weight}kg </span>}
            {s.reps != null && <span>× {s.reps}回</span>}
            {s.isRM && <span className="ml-1 text-orange-500">RM</span>}
          </span>
          <button
            onClick={() => db.sets.delete(s.id)}
            className="px-1 text-gray-400"
            aria-label="削除"
          >
            🗑
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------- セッションRPE ----------

function SessionRpeCard({ session }: { session: Session | undefined }) {
  async function setRpe(n: number) {
    const s = session ?? (await getOrCreateSession(todayISO()));
    await db.sessions.update(s.id, { sessionRpe: n });
  }
  return (
    <div className="card space-y-2">
      <h2 className="font-bold">今日全体のきつさ</h2>
      <div className="flex gap-1">
        {[...Array(10)].map((_, i) => (
          <button
            key={i}
            onClick={() => setRpe(i + 1)}
            className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition ${
              session?.sessionRpe === i + 1
                ? 'bg-orange-500 text-white'
                : 'bg-stone-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- PRお祝いバナー ----------

function PrBanner({ prs, onClose }: { prs: PrRecord[]; onClose: () => void }) {
  return (
    <Modal open title="🎉 自己ベスト更新!" onClose={onClose}>
      <div className="space-y-3">
        {prs.map((pr, i) => (
          <div
            key={i}
            className="rounded-xl bg-gradient-to-r from-orange-100 to-amber-100 p-3 dark:from-orange-900/40 dark:to-amber-900/40"
          >
            <div className="font-bold">{pr.exerciseName}</div>
            <div className="text-sm">
              {pr.message}{' '}
              {pr.oldValue != null && (
                <span className="text-gray-500">{pr.oldValue} → </span>
              )}
              <span className="font-black text-orange-600 dark:text-orange-400">
                {pr.newValue}
                {pr.type === 'e1rm' || pr.type === 'maxWeight' ? 'kg' : ''}
                {pr.type === 'maxReps' || pr.type === 'bandReps' ? '回' : ''}
              </span>
            </div>
          </div>
        ))}
        <button onClick={onClose} className="btn-primary w-full">
          ナイスワーク! 💪
        </button>
      </div>
    </Modal>
  );
}
