// バンド補助の段階。強い補助(重いバンド)→ 弱い補助の順。
// ジムのバンド構成に合わせて編集可。
export const BAND_LEVELS = ['黒', '緑', '紫', '青', '赤', '白'];

// 序列番号を返す(大きいほど補助が弱い=進歩)。未知の色は -1
export function bandRank(level: string): number {
  return BAND_LEVELS.indexOf(level);
}
