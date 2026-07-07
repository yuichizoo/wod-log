import type { Exercise } from '../types';

export interface ParsedSet {
  exerciseName: string;
  exerciseId?: string;
  isUnknown: boolean;
  weight?: number;
  reps?: number;
  isRM?: boolean;
  bandLevel?: string;
  rpe?: number;
  note?: string;
  contextFatigued?: boolean;
}

export interface ParsedSession {
  date?: string; // ISO (YYYY-MM-DD)。未指定なら保存時に今日扱い
  sessionRpe?: number;
  note?: string;
  sets: ParsedSet[];
  warnings: string[];
}

export interface ParseResult {
  sessions: ParsedSession[];
  unknownExercises: string[];
}

const FATIGUE_RE = /kcal|漕いだ後|疲労|疲れ/;
const BAND_COLORS = '黒|紫|緑|青|赤|白|黄|オレンジ';

// 全角数字・英字・記号を半角に正規化(カタカナの長音「ー」は変換しない)
export function normalizeText(input: string): string {
  return input
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/．/g, '.')
    .replace(/／/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/　/g, ' ');
}

// line の start 位置から name(空白無視)がマッチするか。マッチしたら終端位置、しなければ -1
function matchAt(line: string, start: number, name: string): number {
  const target = name.replace(/\s+/g, '').toLowerCase();
  let i = start;
  let j = 0;
  while (j < target.length) {
    while (i < line.length && /\s/.test(line[i])) i++;
    if (i >= line.length) return -1;
    if (line[i].toLowerCase() !== target[j]) return -1;
    i++;
    j++;
  }
  return i;
}

// 行内で最も早く出現する種目(同位置なら最長)を探す
export function findExercise(
  line: string,
  exercises: Exercise[],
): { exercise?: Exercise; start: number; end: number } {
  for (let start = 0; start < line.length; start++) {
    let best: { exercise: Exercise; end: number } | undefined;
    for (const ex of exercises) {
      for (const cand of [ex.name, ...ex.aliases]) {
        if (!cand) continue;
        const end = matchAt(line, start, cand);
        if (end !== -1 && (!best || end > best.end)) {
          best = { exercise: ex, end };
        }
      }
    }
    if (best) return { exercise: best.exercise, start, end: best.end };
  }
  return { start: -1, end: -1 };
}

const STOPWORDS_RE = /(今日|本日|その後|そのあと|それから|あとは|次に|つぎに|まずは|まず|最後に)/g;

interface SegmentResult {
  sets: ParsedSet[];
  warning?: string;
}

// 1セグメント(1種目分のテキスト)を解析する
function parseSetSegment(rawSeg: string, exercises: Exercise[]): SegmentResult {
  let warning: string | undefined;
  const notes: string[] = [];
  let line = rawSeg.trim();
  if (!line) return { sets: [] };

  // 「◯/◯時点」のような振り返りメモは重複登録の恐れがあるので警告
  if (/時点/.test(line)) {
    warning = `振り返りメモの可能性があります(重複登録に注意): 「${rawSeg.trim()}」`;
  }

  // 行内の「→」以降は note へ
  const arrowParts = line.split('→');
  line = arrowParts[0];
  for (const p of arrowParts.slice(1)) {
    const t = p.trim();
    if (t) notes.push('→' + t);
  }

  // 括弧内は note へ
  line = line.replace(/[（(]([^）)]*)[）)]/g, (_m, inner: string) => {
    const t = inner.trim();
    if (t) notes.push(t);
    return ' ';
  });

  // 種目名を特定
  const { exercise, start, end } = findExercise(line, exercises);
  let name: string;
  let rest: string;
  let isUnknown = false;
  if (exercise) {
    name = exercise.name;
    rest = line.slice(end);
    const prefix = line
      .slice(0, start)
      .replace(STOPWORDS_RE, ' ')
      .replace(/[、。,.\s]+/g, ' ')
      .trim();
    if (prefix) notes.push(prefix);
  } else {
    const m = line.match(/^[^0-9]+/);
    if (!m) return { sets: [], warning };
    name = m[0].replace(/[、。,.\s]+/g, ' ').trim();
    rest = line.slice(m[0].length);
    isUnknown = true;
    if (!name) return { sets: [], warning };
  }

  const base: ParsedSet = { exerciseName: name, exerciseId: exercise?.id, isUnknown };
  let setCount = 1;
  let seriesWeights: number[] = [];

  // 1. "8RM" のようなRM表記
  rest = rest.replace(/(\d+(?:\.\d+)?)\s*RM/i, (_m, n: string) => {
    base.reps = Math.round(parseFloat(n));
    base.isRM = true;
    return ' ';
  });

  // 2. "2回10セット"
  rest = rest.replace(/(\d+)\s*(?:回|reps?)\s*[×xX]?\s*(\d+)\s*セット/, (_m, r: string, s: string) => {
    base.reps = parseInt(r, 10);
    setCount = parseInt(s, 10);
    return ' ';
  });

  // 3. "5-6rep" / "7-8回" のようなレンジ → 最大値を採用し原文をnoteへ
  rest = rest.replace(/(\d+)\s*[-〜~]\s*(\d+)\s*(?:回|reps?)/, (m, a: string, b: string) => {
    base.reps = Math.max(parseInt(a, 10), parseInt(b, 10));
    notes.push(m.trim());
    return ' ';
  });

  // 4. "15回" / "6rep"
  if (base.reps == null) {
    rest = rest.replace(/(\d+)\s*(?:回|reps?)/i, (_m, r: string) => {
      base.reps = parseInt(r, 10);
      return ' ';
    });
  }

  // 5. "25キロ" / "6.3kg"
  rest = rest.replace(/(\d+(?:\.\d+)?)\s*(?:キロ|kg|㎏)/i, (_m, n: string) => {
    base.weight = parseFloat(n);
    return ' ';
  });

  // 6. "16-20-24" のような重量連続表記 → 複数セットに分解
  if (base.weight == null) {
    rest = rest.replace(/(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)+)/, (m: string) => {
      seriesWeights = m.split('-').map((x) => parseFloat(x.trim()));
      return ' ';
    });
  }

  // 7. バンド色
  const bandInlineRe = new RegExp(`バンド\\s*(${BAND_COLORS})|(${BAND_COLORS})\\s*バンド`);
  const bandInline = rest.match(bandInlineRe);
  if (bandInline) {
    base.bandLevel = bandInline[1] || bandInline[2];
    rest = rest.replace(bandInline[0], ' ');
  } else if (exercise?.mode === 'band') {
    const m2 = rest.match(new RegExp(`(${BAND_COLORS})`));
    if (m2) {
      base.bandLevel = m2[1];
      rest = rest.replace(m2[1], ' ');
    }
  }

  // 8. 単独の数字 → 重量(バンド種目でrep未定なら回数)
  if (base.weight == null && seriesWeights.length === 0) {
    rest = rest.replace(/(\d+(?:\.\d+)?)/, (_m, n: string) => {
      const v = parseFloat(n);
      if (exercise?.mode === 'band' && base.reps == null) {
        base.reps = Math.round(v);
      } else {
        base.weight = v;
      }
      return ' ';
    });
  }

  // 残りのテキストは note へ
  const leftover = rest
    .replace(/[×xX*]/g, ' ')
    .replace(/[、。,.\s]+/g, ' ')
    .trim()
    .replace(/^(で|に|を|は|が)\s*/, '')
    .trim();
  if (leftover) notes.push(leftover);

  const noteText = notes.filter(Boolean).join(' / ');
  if (noteText) base.note = noteText;
  if (base.note && FATIGUE_RE.test(base.note)) base.contextFatigued = true;

  const sets: ParsedSet[] = [];
  if (seriesWeights.length > 0) {
    seriesWeights.forEach((w, i) => {
      sets.push({ ...base, weight: w, note: i === 0 ? base.note : undefined });
    });
  } else if (setCount > 1) {
    for (let i = 0; i < setCount; i++) {
      sets.push({ ...base, note: i === 0 ? base.note : undefined });
    }
  } else {
    sets.push(base);
  }
  return { sets, warning };
}

// 複数行の生テキスト(音声入力・過去ログ)を構造化する
export function parseFreeText(
  text: string,
  exercises: Exercise[],
  opts: { defaultDate?: string } = {},
): ParseResult {
  const lines = normalizeText(text).split(/\r?\n/);
  const sessions: ParsedSession[] = [];
  let current: ParsedSession | null = null;
  let lastYear: number | undefined;
  let lastMonth: number | undefined;
  const unknown = new Set<string>();

  const ensure = (): ParsedSession => {
    if (current) return current;
    const s: ParsedSession = { date: opts.defaultDate, sets: [], warnings: [] };
    current = s;
    sessions.push(s);
    return s;
  };

  const appendNoteToLast = (sess: ParsedSession, note: string) => {
    const last = sess.sets[sess.sets.length - 1];
    if (last) {
      last.note = last.note ? `${last.note} / ${note}` : note;
      if (FATIGUE_RE.test(last.note)) last.contextFatigued = true;
    } else {
      sess.note = sess.note ? `${sess.note} / ${note}` : note;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 日付行 (2025/12/10 や 12/13)
    const dm = line.match(/^(?:(\d{4})\/)?(\d{1,2})\/(\d{1,2})$/);
    if (dm) {
      let year = dm[1] ? parseInt(dm[1], 10) : (lastYear ?? new Date().getFullYear());
      const month = parseInt(dm[2], 10);
      const day = parseInt(dm[3], 10);
      // 年指定なしで月が前回より小さくなったら年をまたいだとみなす
      if (!dm[1] && lastYear != null && lastMonth != null && month < lastMonth) {
        year = lastYear + 1;
      }
      lastYear = year;
      lastMonth = month;
      const s: ParsedSession = {
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        sets: [],
        warnings: [],
      };
      current = s;
      sessions.push(s);
      continue;
    }

    // ※ や → で始まる行は直前セットのnoteへ
    if (/^[※→]/.test(line)) {
      const sess = ensure();
      const note = line.startsWith('※') ? line.slice(1).trim() : line;
      appendNoteToLast(sess, note);
      continue;
    }

    // 読点区切りで複数種目が1行に入っている場合に対応
    const segments = line.split(/[、,]/);
    for (const seg0 of segments) {
      const seg = seg0.trim();
      if (!seg) continue;

      // 「全体のきつさ8」→ セッションRPE
      const rpeM = seg.match(/^(?:全体の)?きつさ\s*(\d+)\s*$/);
      if (rpeM) {
        ensure().sessionRpe = parseInt(rpeM[1], 10);
        continue;
      }

      const { sets, warning } = parseSetSegment(seg, exercises);
      const sess = ensure();
      if (warning) sess.warnings.push(warning);

      // 未知種目かつ数値情報ゼロのセグメントは、直前セットがあればnote扱い
      const noteish =
        sets.length === 1 &&
        sets[0].isUnknown &&
        sets[0].weight == null &&
        sets[0].reps == null &&
        sets[0].bandLevel == null;
      if (noteish && sess.sets.length > 0) {
        appendNoteToLast(sess, seg);
        continue;
      }

      for (const s of sets) {
        if (s.isUnknown) unknown.add(s.exerciseName);
        sess.sets.push(s);
      }
    }
  }

  return { sessions, unknownExercises: [...unknown] };
}
