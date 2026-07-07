import type { Category, Exercise, Mode } from '../types';

// 過去ログに登場する種目をベースにした初期マスタ
export const SEED_EXERCISES: Exercise[] = [
  // squat
  { id: 'back-squat', name: 'バックスクワット', aliases: ['バックスクワッド'], category: 'squat', mode: 'weight' },
  { id: 'front-squat', name: 'フロントスクワット', aliases: [], category: 'squat', mode: 'weight' },
  { id: 'db-squat', name: 'ダンベルスクワット', aliases: [], category: 'squat', mode: 'weight' },

  // hinge
  { id: 'deadlift', name: 'デッドリフト', aliases: [], category: 'hinge', mode: 'weight' },
  { id: 'romanian-deadlift', name: 'ルーマニアンデッドリフト', aliases: ['ルーマニアンデッド', 'RDL'], category: 'hinge', mode: 'weight' },
  { id: 'single-leg-deadlift', name: '片足デッドリフト', aliases: ['シングルレッグデッドリフト'], category: 'hinge', mode: 'weight' },
  { id: 'half-deadlift', name: 'ハーフデッドリフト', aliases: [], category: 'hinge', mode: 'weight' },
  { id: 'clean-deadlift', name: 'クリーンデッドリフト', aliases: [], category: 'hinge', mode: 'weight' },
  { id: 'russian-kb-swing', name: 'ロシアンケトルベルスイング', aliases: ['ロシアンケトラベルスイング', 'ロシアンスイング'], category: 'hinge', mode: 'load' },
  { id: 'american-kb-swing', name: 'アメリカンケトルベルスイング', aliases: ['アメリカンケトルベル', 'アメリカンケトラベル', 'アメリカンスイング'], category: 'hinge', mode: 'load' },

  // press
  { id: 'shoulder-press', name: 'ショルダープレス', aliases: ['ストリクトプレス'], category: 'press', mode: 'weight' },
  { id: 'db-shoulder-press', name: 'ダンベルショルダープレス', aliases: [], category: 'press', mode: 'weight' },
  { id: 'bench-press', name: 'ベンチプレス', aliases: [], category: 'press', mode: 'weight' },
  { id: 'push-jerk', name: 'プッシュジャーク', aliases: [], category: 'press', mode: 'weight' },
  { id: 'db-pushup', name: 'ダンベルプッシュアップ', aliases: ['ダンベルバッシュアップ'], category: 'press', mode: 'weight' },

  // pull
  { id: 'pullup', name: '懸垂', aliases: ['プルアップ', 'チンアップ', 'チンニング'], category: 'pull', mode: 'band' },
  { id: 'bent-over-row', name: 'ベントオーバーロー', aliases: ['ベントオーバーロウ'], category: 'pull', mode: 'weight' },

  // olympic
  { id: 'snatch', name: 'スナッチ', aliases: [], category: 'olympic', mode: 'weight' },
  { id: 'power-snatch', name: 'パワースナッチ', aliases: ['パワスナ'], category: 'olympic', mode: 'weight' },
  { id: 'hang-power-snatch', name: 'ハングパワースナッチ', aliases: [], category: 'olympic', mode: 'weight' },
  { id: 'high-hang-snatch', name: 'ハイハングスナッチ', aliases: [], category: 'olympic', mode: 'weight' },
  { id: 'squat-snatch', name: 'スクワットスナッチ', aliases: [], category: 'olympic', mode: 'weight' },
  { id: 'db-snatch', name: 'ダンベルスナッチ', aliases: [], category: 'olympic', mode: 'weight' },
  { id: 'clean', name: 'クリーン', aliases: [], category: 'olympic', mode: 'weight' },
  { id: 'squat-clean', name: 'スクワットクリーン', aliases: [], category: 'olympic', mode: 'weight' },
  { id: 'hang-db-power-clean', name: 'ハングダンベルパワークリーン', aliases: [], category: 'olympic', mode: 'weight' },
  { id: 'power-clean-push-jerk', name: 'パワークリーン&プッシュジャーク', aliases: ['パワークリーンandプッシュジャーク', 'クリーン&ジャーク'], category: 'olympic', mode: 'weight' },

  // core
  { id: 'turkish-situp', name: 'ターキッシュシットアップ', aliases: ['ターキッシュゲットアップ'], category: 'core', mode: 'load' },

  // conditioning
  { id: 'wall-ball', name: 'ウォールボール', aliases: ['ウォールボールショット'], category: 'conditioning', mode: 'load' },
];

// 未知の種目を自動登録するときのカテゴリ推定
export function guessCategory(name: string): Category {
  if (/スクワット$|スクワッド$/.test(name)) return 'squat';
  if (/デッドリフト|スイング|ヒンジ|グッドモーニング/.test(name)) return 'hinge';
  if (/プレス|ジャーク|プッシュアップ|ディップ/.test(name)) return 'press';
  if (/懸垂|プル|ロー|ロウ|チン/.test(name)) return 'pull';
  if (/スナッチ|クリーン/.test(name)) return 'olympic';
  if (/シットアップ|プランク|コア|アブ/.test(name)) return 'core';
  return 'conditioning';
}

export function guessMode(name: string): Mode {
  if (/懸垂|プルアップ|チン/.test(name)) return 'band';
  if (/ケトルベル|ウォールボール|メディシン|スレッド/.test(name)) return 'load';
  return 'weight';
}
