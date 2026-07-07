# 🏋️ WOD Log

CrossFit のトレーニングを最小の手間で記録し、成長をグラフで見える化する個人用 PWA。
iPhone の Safari からホーム画面に追加して使う想定です。データはすべて端末内(IndexedDB)に保存され、サーバーは不要です。

## 主な機能

- **音声入力テキストの自動構造化** — 音声入力した生テキストを貼って「解析」するだけで種目・重量・回数に分解。Claude API(claude-haiku-4-5)対応、APIキー未設定でも正規表現ベースの簡易パーサーで動作
- **プレワークアウトチェックイン** — 体調・モチベーション・睡眠を絵文字タップだけで記録(3タップ・5秒)
- **気合い出席** — モチベーション2以下で来た日を特別カウントして称賛 🔥
- **PR自動検出** — 保存時に推定1RM(Epley式)・最高重量・最多レップを過去と比較し、更新なら紙吹雪でお祝い。バンド種目は「同一バンドでのrep増」「バンド軽量化」をPR扱い
- **ダッシュボード** — 種目別e1RM推移、週次ボリューム、セッションRPE、カテゴリバランスレーダー、体調×パフォーマンス分析
- **過去ログ一括取り込み** — Notion等の過去記録を貼り付けて一括インポート
- **バックアップ** — JSON/CSVエクスポート、JSONインポート

## 開発

Node.js 18+ が必要です。

```bash
npm install       # 依存パッケージのインストール
npm run dev       # 開発サーバー起動 (http://localhost:5173)
npm test          # データ層の単体テスト (e1RM / PR判定 / パーサー)
npm run build     # 本番ビルド (dist/ に出力)
npm run gen-icons # PWAアイコンの再生成
```

## 公開 (GitHub Pages)

公開URL: **https://yuichizoo.github.io/wod-log/**

コードを修正したら、次のコマンドで再公開できます:

```bash
npm run deploy   # ビルドして gh-pages ブランチに公開
```

数分後に上記URLへ自動反映されます。インストール済みのPWAも次回起動時に自動更新されます。

### iPhone へのインストール

1. iPhone の **Safari** で https://yuichizoo.github.io/wod-log/ を開く
2. 共有ボタン(□に↑)→ **「ホーム画面に追加」**
3. ホーム画面の「WOD Log」アイコンから起動(全画面・オフライン対応)

> 補足: Cloudflare Pages にデプロイする場合は、ビルドコマンド `npm run build`・出力 `dist` を指定し、`vite.config.ts` の `base` を `/` に戻してください。

## Claude APIキーの設定(任意)

1. [console.anthropic.com](https://console.anthropic.com/) で APIキーを取得
2. アプリの「設定」タブ → 「Claude APIキー」に貼り付けて保存

キーは端末の localStorage にのみ保存され、外部には送信されません(Anthropic APIの呼び出しにのみ使用)。

## 技術スタック

- React 18 + TypeScript + Vite
- Tailwind CSS(モバイルファースト・ダークモード対応)
- Dexie.js(IndexedDB)/ Recharts / vite-plugin-pwa / Vitest

## カスタマイズ

- **バンドの序列**: [src/lib/bands.ts](src/lib/bands.ts) の `BAND_LEVELS`(強い補助→弱い補助の順)をジムのバンド構成に合わせて編集
- **種目マスタ**: アプリの「設定」タブから追加・編集(別名=音声入力の表記揺れも登録可能)
