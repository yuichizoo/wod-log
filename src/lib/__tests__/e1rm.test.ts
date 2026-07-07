import { describe, it, expect } from 'vitest';
import { e1rm, roundTo } from '../e1rm';

describe('e1rm (Epley式)', () => {
  it('reps=1 のときは重量そのまま', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(30, 1)).toBe(30);
  });

  it('reps=0 や負値でも重量そのまま', () => {
    expect(e1rm(100, 0)).toBe(100);
  });

  it('weight × (1 + reps/30)', () => {
    expect(e1rm(100, 10)).toBeCloseTo(133.333, 2);
    expect(e1rm(25, 15)).toBeCloseTo(37.5, 5);
    expect(e1rm(50, 3)).toBeCloseTo(55, 5);
  });

  it('roundTo', () => {
    expect(roundTo(133.3333)).toBe(133.3);
    expect(roundTo(2.456, 2)).toBe(2.46);
  });
});
