import type { Exercise, SetEntry } from '../types';
import { e1rm, roundTo } from './e1rm';
import { bandRank } from './bands';

export type PrType = 'e1rm' | 'maxWeight' | 'maxReps' | 'bandReps' | 'bandLevel';

export interface PrRecord {
  type: PrType;
  exerciseId: string;
  exerciseName: string;
  message: string;
  newValue: number | string;
  oldValue?: number | string;
}

type EntryLike = Pick<SetEntry, 'weight' | 'reps' | 'bandLevel'>;

// 新しい記録を過去の履歴と比較してPR(自己ベスト更新)を検出する
export function detectPRs(
  exercise: Exercise,
  entry: EntryLike,
  history: EntryLike[],
): PrRecord[] {
  const prs: PrRecord[] = [];
  const base = { exerciseId: exercise.id, exerciseName: exercise.name };

  if (exercise.mode === 'band') {
    if (!entry.bandLevel) return prs;
    const rank = bandRank(entry.bandLevel);
    const histRanks = history
      .filter((h) => h.bandLevel)
      .map((h) => bandRank(h.bandLevel!))
      .filter((r) => r >= 0);
    if (rank >= 0 && histRanks.length > 0) {
      const best = Math.max(...histRanks);
      if (rank > best) {
        prs.push({
          ...base,
          type: 'bandLevel',
          message: `バンド軽量化! より弱い補助にステップアップ`,
          newValue: entry.bandLevel,
        });
      }
    }
    if (entry.reps != null) {
      const sameBandReps = history
        .filter((h) => h.bandLevel === entry.bandLevel && h.reps != null)
        .map((h) => h.reps!);
      if (sameBandReps.length > 0 && entry.reps > Math.max(...sameBandReps)) {
        prs.push({
          ...base,
          type: 'bandReps',
          message: `${entry.bandLevel}バンドでレップ更新!`,
          newValue: entry.reps,
          oldValue: Math.max(...sameBandReps),
        });
      }
    }
    return prs;
  }

  // weight / load モード
  if (entry.weight == null) return prs;
  const hist = history.filter((h) => h.weight != null);
  if (hist.length === 0) return prs; // 初記録はPR扱いしない

  const newE = e1rm(entry.weight, entry.reps ?? 1);
  const bestE = Math.max(...hist.map((h) => e1rm(h.weight!, h.reps ?? 1)));
  if (newE > bestE + 1e-9) {
    prs.push({
      ...base,
      type: 'e1rm',
      message: `推定1RM更新!`,
      newValue: roundTo(newE),
      oldValue: roundTo(bestE),
    });
  }

  const bestW = Math.max(...hist.map((h) => h.weight!));
  if (entry.weight > bestW) {
    prs.push({
      ...base,
      type: 'maxWeight',
      message: `最高重量更新!`,
      newValue: entry.weight,
      oldValue: bestW,
    });
  }

  const repsHist = hist.filter((h) => h.reps != null).map((h) => h.reps!);
  if (entry.reps != null && repsHist.length > 0 && entry.reps > Math.max(...repsHist)) {
    prs.push({
      ...base,
      type: 'maxReps',
      message: `最多レップ更新!`,
      newValue: entry.reps,
      oldValue: Math.max(...repsHist),
    });
  }
  return prs;
}
