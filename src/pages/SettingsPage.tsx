import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../db/db';
import type { Category, Exercise, Mode } from '../types';
import { getApiKey, setApiKey } from '../lib/apiKey';
import { exportJSON, exportCSV, importJSON, downloadFile } from '../lib/exportImport';
import { parseFreeText, type ParseResult, type ParsedSession } from '../lib/parser';
import { saveParsedSessions } from '../lib/save';
import ParsePreview from '../components/ParsePreview';
import Modal from '../components/Modal';

const CATEGORY_LABELS: Record<Category, string> = {
  squat: 'スクワット',
  hinge: 'ヒンジ',
  press: 'プレス',
  pull: 'プル',
  olympic: 'オリンピック',
  core: 'コア',
  conditioning: 'コンディショニング',
};

const MODE_LABELS: Record<Mode, string> = {
  weight: '重量×回数',
  band: 'バンド補助',
  load: '器具重量',
};

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <ApiKeyCard />
      <SeedImportCard />
      <ExerciseMasterCard />
      <DataCard />
      <div className="px-1 text-center text-xs text-gray-400">
        WOD Log — データはすべてこの端末の中に保存されます
      </div>
    </div>
  );
}

// ---------- Claude APIキー ----------

function ApiKeyCard() {
  const [key, setKey] = useState(getApiKey());
  const [saved, setSaved] = useState(false);

  function save() {
    setApiKey(key.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="card space-y-2">
      <h2 className="font-bold">🔑 Claude APIキー</h2>
      <p className="text-xs text-gray-500">
        設定すると音声テキスト解析の精度が上がります(claude-haiku-4-5を使用)。
        未設定でも簡易解析で動作します。キーはこの端末にのみ保存されます。
        取得は console.anthropic.com から。
      </p>
      <input
        type="password"
        className="input"
        placeholder="sk-ant-..."
        value={key}
        onChange={(e) => setKey(e.target.value)}
      />
      <button onClick={save} className="btn-primary w-full">
        {saved ? '保存しました ✅' : key ? '保存する' : 'キーを削除'}
      </button>
    </div>
  );
}

// ---------- 過去ログ一括インポート ----------

function SeedImportCard() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];

  function analyze() {
    if (!text.trim()) return;
    setResult(parseFreeText(text, exercises));
  }

  async function save(sessions: ParsedSession[]) {
    const outcome = await saveParsedSessions(sessions, exercises, { detectPr: false });
    setResult(null);
    setText('');
    setDone(`${sessions.length}セッション / ${outcome.setCount}セットを取り込みました ✅`);
  }

  return (
    <div className="card space-y-2">
      <h2 className="font-bold">📥 過去ログの一括取り込み</h2>
      <p className="text-xs text-gray-500">
        Notionなどに記録していた過去ログを貼り付けて一括登録できます。
        日付行(例: 2025/12/10 や 12/13)ごとにセッションとして分割されます。
      </p>
      <textarea
        className="input min-h-[120px] font-mono text-sm"
        placeholder={'2025/12/10\nハイハングスナッチ 25キロ\n\n12/13\nショルダープレス 22キロ\n懸垂 紫で5回'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button onClick={analyze} disabled={!text.trim()} className="btn-primary w-full">
        解析して取り込む
      </button>
      {done && <div className="text-sm text-green-600 dark:text-green-400">{done}</div>}
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

// ---------- 種目マスタ管理 ----------

function ExerciseMasterCard() {
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);

  const sorted = [...exercises].sort((a, b) =>
    a.category === b.category
      ? a.name.localeCompare(b.name, 'ja')
      : a.category.localeCompare(b.category),
  );

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">🏷️ 種目マスタ ({exercises.length})</h2>
        <button onClick={() => setCreating(true)} className="text-sm font-bold text-orange-500">
          ＋追加
        </button>
      </div>
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {sorted.map((e) => (
          <button
            key={e.id}
            onClick={() => setEditing(e)}
            className="flex w-full items-center gap-2 rounded-lg bg-stone-100 px-3 py-2 text-left text-sm dark:bg-gray-800"
          >
            <span className="flex-1 truncate">
              <span className="font-medium">{e.name}</span>
              {e.aliases.length > 0 && (
                <span className="ml-1 text-xs text-gray-400">
                  ({e.aliases.join(', ')})
                </span>
              )}
            </span>
            <span className="shrink-0 rounded bg-stone-200 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {CATEGORY_LABELS[e.category]}
            </span>
          </button>
        ))}
      </div>
      {(editing || creating) && (
        <ExerciseEditModal
          exercise={editing ?? undefined}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function ExerciseEditModal({
  exercise,
  onClose,
}: {
  exercise?: Exercise;
  onClose: () => void;
}) {
  const [name, setName] = useState(exercise?.name ?? '');
  const [aliases, setAliases] = useState(exercise?.aliases.join(', ') ?? '');
  const [category, setCategory] = useState<Category>(exercise?.category ?? 'conditioning');
  const [mode, setMode] = useState<Mode>(exercise?.mode ?? 'weight');

  async function save() {
    if (!name.trim()) return;
    const record: Exercise = {
      id: exercise?.id ?? newId(),
      name: name.trim(),
      aliases: aliases
        .split(/[,、]/)
        .map((s) => s.trim())
        .filter(Boolean),
      category,
      mode,
    };
    await db.exercises.put(record);
    onClose();
  }

  async function remove() {
    if (!exercise) return;
    const used = await db.sets.where('exerciseId').equals(exercise.id).count();
    if (used > 0) {
      window.alert(`この種目には${used}件の記録があるため削除できません。`);
      return;
    }
    if (!window.confirm(`「${exercise.name}」を削除しますか?`)) return;
    await db.exercises.delete(exercise.id);
    onClose();
  }

  return (
    <Modal open title={exercise ? '種目を編集' : '種目を追加'} onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <div className="mb-1 text-xs text-gray-500">種目名</div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <div className="mb-1 text-xs text-gray-500">別名 (カンマ区切り・音声入力の揺れ対応)</div>
          <input
            className="input"
            placeholder="パワスナ, power snatch"
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
          />
        </label>
        <label className="block">
          <div className="mb-1 text-xs text-gray-500">カテゴリ</div>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="mb-1 text-xs text-gray-500">記録タイプ</div>
          <select
            className="input"
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
          >
            {Object.entries(MODE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          {exercise && (
            <button onClick={remove} className="btn-secondary flex-1 text-red-500">
              削除
            </button>
          )}
          <button onClick={save} disabled={!name.trim()} className="btn-primary flex-1">
            保存
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- データ管理 ----------

function DataCard() {
  const [msg, setMsg] = useState<string | null>(null);

  async function doExportJSON() {
    downloadFile(`wod-log-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportJSON());
  }

  async function doExportCSV() {
    downloadFile(
      `wod-log-${new Date().toISOString().slice(0, 10)}.csv`,
      await exportCSV(),
      'text/csv',
    );
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (
      !window.confirm(
        '現在のデータをすべて置き換えます。よろしいですか?(実行前にエクスポートしておくと安全です)',
      )
    ) {
      return;
    }
    try {
      const counts = await importJSON(await file.text());
      setMsg(`復元しました: ${counts.sessions}セッション / ${counts.sets}セット ✅`);
    } catch (err) {
      setMsg(`読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="card space-y-2">
      <h2 className="font-bold">💾 バックアップ</h2>
      <div className="flex gap-2">
        <button onClick={doExportJSON} className="btn-secondary flex-1 text-sm">
          JSONエクスポート
        </button>
        <button onClick={doExportCSV} className="btn-secondary flex-1 text-sm">
          CSVエクスポート
        </button>
      </div>
      <label className="btn-secondary block w-full cursor-pointer text-center text-sm">
        JSONから復元 (インポート)
        <input type="file" accept=".json,application/json" className="hidden" onChange={onImportFile} />
      </label>
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
