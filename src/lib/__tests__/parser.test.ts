import { describe, it, expect } from 'vitest';
import { parseFreeText, normalizeText } from '../parser';
import { SEED_EXERCISES } from '../../db/seedExercises';

// Notionに記録していた実データ(表記揺れ・注釈・「→」続き書きを含む)
const PAST_LOG = `2025/12/10
ハイハング スナッチ　25キロ(RM26キロ)

12/13
ショルダープレス　22キロ
懸垂　紫で5回
ウォールボール　6.3kg一周目だけ　→ その後4.6kg

2026/1/16
バックスクワット　45キロ

1/19
ベンチプレス　45キロ　5-6rep
アメリカンケトルベル　12
プルアップ　紫

1/21
バックスクワット　40キロ　10rep
パワースナッチ 20キロ　→フルスクワットがきつい

1/23
ウォールボール4.6

1/26
ハングパワースナッチ 30キロ　1RM
ダンベルスクワット　12.5

2/9
上半身自重

2/18
ベンチプレス５０　3RM
スクワットクリーン　25キロ　7-8回

2/25
パワースナッチ　2回10セット　27キロ
※ヒンジむずい

3/2
プッシュジャーク　30キロ　手首痛い
懸垂　バンド紫

3/13
片足デッドリフト　45 8RM

3/18
片足デッドリフト　49  8RM

3/23
ルーマニアンデッドリフト 50 6rep

3/30
ルーマニアンデッドリフト 55 6rep
ハングダンベルパワークリーン 12.5 30rep
ダンベルバッシュアップ　10 30rep

4/3
スクワットクリーン　38キロ　2rep
ロシアンケトラベルスイング 16-20-24
※24はほぼできなかった

4/10
フロントスクワット　45 6RM
ダンベルスナッチ　12.5前半で死んだ　→10に

4/13
ベンチプレス　50 4RM

4/20
スクワットスナッチ　20キロ
→22.5だとしゃがめない！
パワースナッチ　２５キロ
※２８キロだと腕で押す感じになってしまう

4/24
デッドリフト　60 6RM

4/28
パワースナッチ　25 15回行けた
→30kcal漕いだ後は5回が限界

5/1
ウォールボール4.6

5/13
ベントオーバーロー 35
ダンベルショルダープレス　１０キロで10RM

5/15
パワークリーンandプッシュジャーク　25キロ
※リズミカルにやる練習。重さ余裕あり。

6/3
ショルダープレス　12.5いけた
ウォールボール　4.6 →やはりきついね

6/5
ハーフデッドリフト　50

6/9
クリーンデッドリフト　60
クリーン30 きつかったが一応、、

6/12
ターキッシュシットアップ　8

6/26
パワースナッチ　25でファーム意識　それでもギリ
※スクワットスナッチもやった(25はギリギリ)
`;

function findSession(result: ReturnType<typeof parseFreeText>, date: string) {
  const s = result.sessions.find((x) => x.date === date);
  expect(s, `セッション ${date} が見つからない`).toBeDefined();
  return s!;
}

describe('normalizeText', () => {
  it('全角数字を半角に変換する', () => {
    expect(normalizeText('ベンチプレス５０')).toBe('ベンチプレス50');
    expect(normalizeText('１０キロ')).toBe('10キロ');
  });

  it('カタカナの長音は変換しない', () => {
    expect(normalizeText('ロー')).toBe('ロー');
  });
});

describe('parseFreeText: 過去ログ実データ', () => {
  const result = parseFreeText(PAST_LOG, SEED_EXERCISES);

  it('29セッションに分割される', () => {
    expect(result.sessions.length).toBe(29);
  });

  it('年の引き継ぎ: 12/13 は 2025-12-13、1/16 は 2026-01-16', () => {
    expect(result.sessions[0].date).toBe('2025-12-10');
    expect(result.sessions[1].date).toBe('2025-12-13');
    expect(result.sessions[2].date).toBe('2026-01-16');
  });

  it('ハイハング スナッチ 25キロ(RM26キロ): 括弧はnoteへ', () => {
    const s = findSession(result, '2025-12-10');
    const set = s.sets[0];
    expect(set.exerciseName).toBe('ハイハングスナッチ');
    expect(set.weight).toBe(25);
    expect(set.note).toContain('RM26キロ');
  });

  it('懸垂 紫で5回: バンドとして解析', () => {
    const s = findSession(result, '2025-12-13');
    const set = s.sets.find((t) => t.exerciseName === '懸垂')!;
    expect(set.bandLevel).toBe('紫');
    expect(set.reps).toBe(5);
  });

  it('ウォールボール 6.3kg一周目だけ →その後4.6kg: 重量とnote', () => {
    const s = findSession(result, '2025-12-13');
    const set = s.sets.find((t) => t.exerciseName === 'ウォールボール')!;
    expect(set.weight).toBe(6.3);
    expect(set.note).toContain('その後4.6kg');
    expect(set.note).toContain('一周目だけ');
  });

  it('ベンチプレス 45キロ 5-6rep: レンジは最大値、原文note', () => {
    const s = findSession(result, '2026-01-19');
    const set = s.sets.find((t) => t.exerciseName === 'ベンチプレス')!;
    expect(set.weight).toBe(45);
    expect(set.reps).toBe(6);
    expect(set.note).toContain('5-6');
  });

  it('アメリカンケトルベル 12: 別名解決と単独数値=重量', () => {
    const s = findSession(result, '2026-01-19');
    const set = s.sets.find((t) => t.exerciseName === 'アメリカンケトルベルスイング')!;
    expect(set.weight).toBe(12);
  });

  it('プルアップ 紫: 懸垂に正規化されバンドのみ', () => {
    const s = findSession(result, '2026-01-19');
    const set = s.sets.find((t) => t.exerciseName === '懸垂')!;
    expect(set.bandLevel).toBe('紫');
  });

  it('ハングパワースナッチ 30キロ 1RM', () => {
    const s = findSession(result, '2026-01-26');
    const set = s.sets.find((t) => t.exerciseName === 'ハングパワースナッチ')!;
    expect(set.weight).toBe(30);
    expect(set.reps).toBe(1);
    expect(set.isRM).toBe(true);
  });

  it('上半身自重: 未知種目として提案される', () => {
    const s = findSession(result, '2026-02-09');
    expect(s.sets[0].exerciseName).toBe('上半身自重');
    expect(s.sets[0].isUnknown).toBe(true);
    expect(result.unknownExercises).toContain('上半身自重');
  });

  it('ベンチプレス５０ 3RM: 全角正規化とRM', () => {
    const s = findSession(result, '2026-02-18');
    const set = s.sets.find((t) => t.exerciseName === 'ベンチプレス')!;
    expect(set.weight).toBe(50);
    expect(set.reps).toBe(3);
    expect(set.isRM).toBe(true);
  });

  it('パワースナッチ 2回10セット 27キロ: 10セットに分解', () => {
    const s = findSession(result, '2026-02-25');
    const sets = s.sets.filter((t) => t.exerciseName === 'パワースナッチ');
    expect(sets.length).toBe(10);
    expect(sets[0].weight).toBe(27);
    expect(sets[0].reps).toBe(2);
  });

  it('※ヒンジむずい: 直前セットのnoteに付く', () => {
    const s = findSession(result, '2026-02-25');
    const last = s.sets[s.sets.length - 1];
    expect(last.note).toContain('ヒンジむずい');
  });

  it('片足デッドリフト 45 8RM', () => {
    const s = findSession(result, '2026-03-13');
    const set = s.sets[0];
    expect(set.exerciseName).toBe('片足デッドリフト');
    expect(set.weight).toBe(45);
    expect(set.reps).toBe(8);
    expect(set.isRM).toBe(true);
  });

  it('ロシアンケトラベルスイング 16-20-24: 重量違い3セットに分解', () => {
    const s = findSession(result, '2026-04-03');
    const sets = s.sets.filter((t) => t.exerciseName === 'ロシアンケトルベルスイング');
    expect(sets.map((t) => t.weight)).toEqual([16, 20, 24]);
  });

  it('→30kcal漕いだ後は5回が限界: contextFatigued が立つ', () => {
    const s = findSession(result, '2026-04-28');
    const set = s.sets.find((t) => t.exerciseName === 'パワースナッチ')!;
    expect(set.weight).toBe(25);
    expect(set.reps).toBe(15);
    expect(set.note).toContain('30kcal');
    expect(set.contextFatigued).toBe(true);
  });

  it('ダンベルショルダープレス １０キロで10RM: 全角+RM', () => {
    const s = findSession(result, '2026-05-13');
    const set = s.sets.find((t) => t.exerciseName === 'ダンベルショルダープレス')!;
    expect(set.weight).toBe(10);
    expect(set.reps).toBe(10);
    expect(set.isRM).toBe(true);
  });

  it('パワークリーンandプッシュジャーク: 別名解決', () => {
    const s = findSession(result, '2026-05-15');
    const set = s.sets[0];
    expect(set.exerciseName).toBe('パワークリーン&プッシュジャーク');
    expect(set.weight).toBe(25);
  });

  it('クリーンデッドリフト 60 と クリーン30 を正しく区別', () => {
    const s = findSession(result, '2026-06-09');
    const cdl = s.sets.find((t) => t.exerciseName === 'クリーンデッドリフト')!;
    const clean = s.sets.find((t) => t.exerciseName === 'クリーン')!;
    expect(cdl.weight).toBe(60);
    expect(clean.weight).toBe(30);
    expect(clean.note).toContain('きつかったが一応');
  });

  it('ターキッシュシットアップ 8', () => {
    const s = findSession(result, '2026-06-12');
    expect(s.sets[0].weight).toBe(8);
  });
});

describe('parseFreeText: 音声入力ワンライナー', () => {
  it('「今日パワースナッチ25キロ15回、その後ウォールボール4.6、全体のきつさ8」', () => {
    const r = parseFreeText(
      '今日パワースナッチ25キロ15回、その後ウォールボール4.6、全体のきつさ8',
      SEED_EXERCISES,
      { defaultDate: '2026-07-07' },
    );
    expect(r.sessions.length).toBe(1);
    const s = r.sessions[0];
    expect(s.date).toBe('2026-07-07');
    expect(s.sessionRpe).toBe(8);
    expect(s.sets.length).toBe(2);
    expect(s.sets[0].exerciseName).toBe('パワースナッチ');
    expect(s.sets[0].weight).toBe(25);
    expect(s.sets[0].reps).toBe(15);
    expect(s.sets[1].exerciseName).toBe('ウォールボール');
    expect(s.sets[1].weight).toBe(4.6);
  });
});

describe('parseFreeText: 振り返りメモ警告', () => {
  it('「◯/◯時点」の行に警告を出す', () => {
    const r = parseFreeText(
      '4/27\n1/21時点 バックスクワット40キロ10回',
      SEED_EXERCISES,
    );
    const s = r.sessions[0];
    expect(s.warnings.length).toBeGreaterThan(0);
    expect(s.warnings[0]).toContain('振り返り');
  });
});
