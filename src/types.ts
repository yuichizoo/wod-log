export type Category =
  | 'squat'
  | 'hinge'
  | 'press'
  | 'pull'
  | 'olympic'
  | 'core'
  | 'conditioning';

export type Mode = 'weight' | 'band' | 'load';

// 種目マスタ
export interface Exercise {
  id: string;
  name: string; // 例: "パワースナッチ"
  aliases: string[]; // 音声入力の揺れ対応: ["パワスナ", "power snatch"]
  category: Category;
  mode: Mode;
  // weight: バーベル/ダンベル重量×rep
  // band:   バンド補助段階(懸垂など)
  // load:   器具重量のみ(ウォールボール、ケトルベルなど)
}

// セッション(1回のジム訪問)
export interface Session {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  preCondition?: number; // 1-5: 開始前の体調
  sessionRpe?: number; // 1-10: セッション全体のきつさ
  motivation?: number; // 1-5: 開始前のモチベーション
  sleepQuality?: number; // 1-5: 前夜の睡眠の質
  note?: string;
}

// セット記録
export interface SetEntry {
  id: string;
  sessionId: string;
  exerciseId: string;
  weight?: number; // kg
  reps?: number;
  isRM?: boolean; // "6RM" のような限界記録か
  bandLevel?: string; // 例: "紫"
  rpe?: number; // 1-10
  note?: string;
  contextFatigued?: boolean; // コンディショニング後の疲労状態か
  createdAt?: number; // 並び順用タイムスタンプ
}
