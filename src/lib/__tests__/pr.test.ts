import { describe, it, expect } from 'vitest';
import { detectPRs } from '../pr';
import type { Exercise } from '../../types';

const bench: Exercise = {
  id: 'bench',
  name: 'ベンチプレス',
  aliases: [],
  category: 'press',
  mode: 'weight',
};

const pullup: Exercise = {
  id: 'pullup',
  name: '懸垂',
  aliases: [],
  category: 'pull',
  mode: 'band',
};

describe('detectPRs (weightモード)', () => {
  it('履歴がなければPRなし(初記録は祝わない)', () => {
    expect(detectPRs(bench, { weight: 100, reps: 5 }, [])).toEqual([]);
  });

  it('e1RM更新と最多レップ更新を検出', () => {
    const history = [{ weight: 50, reps: 3 }]; // e1RM = 55
    const prs = detectPRs(bench, { weight: 50, reps: 4 }, history); // e1RM ≈ 56.7
    const types = prs.map((p) => p.type);
    expect(types).toContain('e1rm');
    expect(types).toContain('maxReps');
    expect(types).not.toContain('maxWeight');
  });

  it('最高重量更新を検出(e1RMは未更新)', () => {
    const history = [{ weight: 50, reps: 3 }]; // e1RM = 55
    const prs = detectPRs(bench, { weight: 52.5, reps: 1 }, history); // e1RM = 52.5
    const types = prs.map((p) => p.type);
    expect(types).toContain('maxWeight');
    expect(types).not.toContain('e1rm');
  });

  it('更新していなければPRなし', () => {
    const history = [{ weight: 60, reps: 5 }];
    expect(detectPRs(bench, { weight: 50, reps: 3 }, history)).toEqual([]);
  });
});

describe('detectPRs (bandモード)', () => {
  it('同一バンドでのレップ増をPRとして検出', () => {
    const history = [{ bandLevel: '紫', reps: 5 }];
    const prs = detectPRs(pullup, { bandLevel: '紫', reps: 6 }, history);
    expect(prs.map((p) => p.type)).toContain('bandReps');
  });

  it('バンド段階の軽量化をPRとして検出 (紫→赤)', () => {
    const history = [{ bandLevel: '紫', reps: 5 }];
    const prs = detectPRs(pullup, { bandLevel: '赤', reps: 3 }, history);
    expect(prs.map((p) => p.type)).toContain('bandLevel');
  });

  it('強い補助への後退はPRではない (紫→黒)', () => {
    const history = [{ bandLevel: '紫', reps: 5 }];
    const prs = detectPRs(pullup, { bandLevel: '黒', reps: 8 }, history);
    expect(prs.map((p) => p.type)).not.toContain('bandLevel');
  });
});
