import type { Exercise, Session, SetEntry } from '../types';
import { e1rm, roundTo } from './e1rm';
import { detectPRs, type PrRecord } from './pr';
import { daysAgoISO, weekStartISO } from './format';

export interface SetWithDate extends SetEntry {
  date: string;
}

export function joinSetsWithDate(sessions: Session[], sets: SetEntry[]): SetWithDate[] {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  return sets
    .flatMap((s) => {
      const sess = byId.get(s.sessionId);
      return sess ? [{ ...s, date: sess.date }] : [];
    })
    .sort((a, b) =>
      a.date === b.date ? (a.createdAt ?? 0) - (b.createdAt ?? 0) : a.date < b.date ? -1 : 1,
    );
}

// 種目別・日別の最高e1RM系列
export function e1rmSeries(
  sets: SetWithDate[],
  exerciseId: string,
): { date: string; value: number }[] {
  const byDate = new Map<string, number>();
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || s.weight == null) continue;
    const v = e1rm(s.weight, s.reps ?? 1);
    const cur = byDate.get(s.date);
    if (cur == null || v > cur) byDate.set(s.date, v);
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, value]) => ({ date, value: roundTo(value) }));
}

// 週次ボリューム (Σ 重量×rep)
export function weeklyVolume(sets: SetWithDate[]): { week: string; volume: number }[] {
  const byWeek = new Map<string, number>();
  for (const s of sets) {
    if (s.weight == null || s.reps == null) continue;
    const wk = weekStartISO(s.date);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + s.weight * s.reps);
  }
  return [...byWeek.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([week, volume]) => ({ week, volume: Math.round(volume) }));
}

export function rpeSeries(sessions: Session[]): { date: string; rpe: number }[] {
  return sessions
    .filter((s) => s.sessionRpe != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((s) => ({ date: s.date, rpe: s.sessionRpe! }));
}

export const RADAR_CATEGORIES = [
  { key: 'squat', label: 'スクワット' },
  { key: 'hinge', label: 'ヒンジ' },
  { key: 'press', label: 'プレス' },
  { key: 'pull', label: 'プル' },
  { key: 'olympic', label: 'オリンピック' },
] as const;

// 直近weeks週のカテゴリ別記録回数(日×種目のユニーク数)
export function categoryBalance(
  sets: SetWithDate[],
  exercises: Exercise[],
  weeks = 8,
): { category: string; count: number }[] {
  const cutoff = daysAgoISO(weeks * 7);
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const seen = new Map<string, Set<string>>();
  for (const s of sets) {
    if (s.date < cutoff) continue;
    const ex = exMap.get(s.exerciseId);
    if (!ex) continue;
    if (!seen.has(ex.category)) seen.set(ex.category, new Set());
    seen.get(ex.category)!.add(`${s.date}:${s.exerciseId}`);
  }
  return RADAR_CATEGORIES.map((c) => ({
    category: c.label,
    count: seen.get(c.key)?.size ?? 0,
  }));
}

export interface CondPerf {
  level: number;
  avgPct: number;
  n: number;
}

// 体調/モチベーション段階別の「その日のe1RM達成率(当時ベスト比%)」平均
export function conditionPerformance(
  sessions: Session[],
  sets: SetWithDate[],
  key: 'preCondition' | 'motivation',
): CondPerf[] {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1));
  const setsBySession = new Map<string, SetWithDate[]>();
  for (const s of sets) {
    if (!setsBySession.has(s.sessionId)) setsBySession.set(s.sessionId, []);
    setsBySession.get(s.sessionId)!.push(s);
  }

  const best = new Map<string, number>(); // exerciseId → それまでの最高e1RM
  const samples: { level: number; pct: number }[] = [];

  for (const sess of sorted) {
    const ss = setsBySession.get(sess.id) ?? [];
    let dayPct: number | undefined;
    for (const s of ss) {
      if (s.weight == null) continue;
      const v = e1rm(s.weight, s.reps ?? 1);
      const b = best.get(s.exerciseId);
      if (b != null && b > 0) {
        const pct = (v / b) * 100;
        if (dayPct == null || pct > dayPct) dayPct = pct;
      }
    }
    for (const s of ss) {
      if (s.weight == null) continue;
      const v = e1rm(s.weight, s.reps ?? 1);
      const b = best.get(s.exerciseId);
      if (b == null || v > b) best.set(s.exerciseId, v);
    }
    const level = sess[key];
    if (dayPct != null && level != null) samples.push({ level, pct: dayPct });
  }

  const result: CondPerf[] = [];
  for (let level = 1; level <= 5; level++) {
    const g = samples.filter((s) => s.level === level);
    if (g.length > 0) {
      result.push({
        level,
        avgPct: Math.round(g.reduce((a, b) => a + b.pct, 0) / g.length),
        n: g.length,
      });
    }
  }
  return result;
}

// 「体調3以下でも平均92%出ている」のような一言インサイト
export function conditionInsight(groups: CondPerf[], label: string): string | undefined {
  const low = groups.filter((g) => g.level <= 3);
  if (low.length === 0) return undefined;
  const totalN = low.reduce((a, g) => a + g.n, 0);
  const avg = Math.round(low.reduce((a, g) => a + g.avgPct * g.n, 0) / totalN);
  return `${label}3以下の日でも平均${avg}%のパフォーマンス。調子が悪くても行く価値あり 💪`;
}

// 「気合い出席」= モチベーション2以下でチェックインした日
export function konjoCount(sessions: Session[]): number {
  return sessions.filter((s) => s.motivation != null && s.motivation <= 2).length;
}

export interface PrEvent extends PrRecord {
  date: string;
}

// 全履歴を時系列で再生してPRイベント一覧を計算する
export function computePrHistory(sets: SetWithDate[], exercises: Exercise[]): PrEvent[] {
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const hist = new Map<string, SetWithDate[]>();
  const events: PrEvent[] = [];
  for (const s of sets) {
    const ex = exMap.get(s.exerciseId);
    if (!ex) continue;
    const h = hist.get(s.exerciseId) ?? [];
    for (const pr of detectPRs(ex, s, h)) {
      events.push({ ...pr, date: s.date });
    }
    h.push(s);
    hist.set(s.exerciseId, h);
  }
  return events;
}
