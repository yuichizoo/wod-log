import type { Exercise } from '../types';
import type { ParseResult, ParsedSession, ParsedSet } from './parser';
import { normalizeText } from './parser';

// Claude API (claude-haiku-4-5) によるテキスト構造化。
// APIキーはユーザーが設定画面で入力し、端末のlocalStorageにのみ保存される。

interface ClaudeSet {
  exercise?: string;
  weight?: number | null;
  reps?: number | null;
  isRM?: boolean | null;
  bandLevel?: string | null;
  rpe?: number | null;
  note?: string | null;
}

interface ClaudeSession {
  date?: string | null;
  sessionRpe?: number | null;
  note?: string | null;
  sets?: ClaudeSet[];
}

interface ClaudeOutput {
  sessions?: ClaudeSession[];
}

function buildSystemPrompt(exercises: Exercise[]): string {
  const list = exercises
    .map((e) => `- ${e.name}${e.aliases.length ? `(別名: ${e.aliases.join(', ')})` : ''} [${e.mode}]`)
    .join('\n');
  return `あなたはCrossFitトレーニング記録の構造化パーサーです。ユーザーの音声入力テキストを解析し、次のJSONのみを出力してください(説明文・コードフェンス禁止)。

{"sessions":[{"date":"YYYY-MM-DD または null","sessionRpe":数値またはnull,"sets":[{"exercise":"種目名","weight":数値(kg)またはnull,"reps":数値またはnull,"isRM":true/false,"bandLevel":"バンド色またはnull","rpe":数値またはnull,"note":"補足またはnull"}]}]}

ルール:
- 全角数字は半角に変換する
- 「※」「→」以降の文は該当セットの note に入れる
- 「16-20-24」のような連続表記は重量違いの複数セットに分解する
- 「NRM」は reps=N, isRM=true とする
- 「N回Mセット」はM個のセットに分解する
- 「全体のきつさN」は sessionRpe とする
- 表記揺れは下記の既知種目名に正規化する。リストにない種目はそのままの名前で出力する
- 日付が書かれていなければ date は null
- 「◯/◯時点」のような過去の振り返りメモはそのセットの note に「振り返りメモ」と付記する

既知種目リスト:
${list}`;
}

export async function parseWithClaude(
  text: string,
  exercises: Exercise[],
  apiKey: string,
): Promise<ParseResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system: buildSystemPrompt(exercises),
      messages: [{ role: 'user', content: normalizeText(text) }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Claude APIエラー (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw: string =
    data?.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';
  const jsonText = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  let parsed: ClaudeOutput;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Claude APIの応答をJSONとして解釈できませんでした');
  }

  // 種目名を既知マスタに解決
  const byName = new Map<string, Exercise>();
  for (const ex of exercises) {
    byName.set(norm(ex.name), ex);
    for (const a of ex.aliases) byName.set(norm(a), ex);
  }

  const unknown = new Set<string>();
  const sessions: ParsedSession[] = (parsed.sessions ?? []).map((s) => {
    const sets: ParsedSet[] = (s.sets ?? [])
      .filter((t) => t.exercise)
      .map((t) => {
        const ex = byName.get(norm(t.exercise!));
        if (!ex) unknown.add(t.exercise!.trim());
        return {
          exerciseName: ex?.name ?? t.exercise!.trim(),
          exerciseId: ex?.id,
          isUnknown: !ex,
          weight: t.weight ?? undefined,
          reps: t.reps ?? undefined,
          isRM: t.isRM ?? undefined,
          bandLevel: t.bandLevel ?? undefined,
          rpe: t.rpe ?? undefined,
          note: t.note ?? undefined,
          contextFatigued: t.note ? /kcal|漕いだ後|疲労|疲れ/.test(t.note) : undefined,
        };
      });
    return {
      date: s.date ?? undefined,
      sessionRpe: s.sessionRpe ?? undefined,
      note: s.note ?? undefined,
      sets,
      warnings: [],
    };
  });

  return { sessions, unknownExercises: [...unknown] };
}

function norm(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}
