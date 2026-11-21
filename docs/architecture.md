# アーキテクチャ設計

本ドキュメントでは、「青春再演劇場 リプライズ」のシステム構成、モジュール責務、および `static/data/scenario.json` のデータ構造をまとめる。

## 全体構成

本アプリは、HTML・CSS・TypeScript と Vite で構成し、ゲームの進行・文字送り・演出・音声制御はすべてユーザーのブラウザ側で実行する。サーバー側の計算処理やデータベース保存は行わない。

| 層 | 技術・ファイル | 役割 |
| --- | --- | --- |
| 開発サーバー・静的ビルド | Node.js / Vite（`vite.config.ts`） | ローカル開発配信（`npm run dev`）と、`dist/` への静的サイト出力（`npm run build`） |
| 画面・スタイル | HTML（`index.html`, `game.html`）/ CSS（`static/css/`） | 1600×900（16:9）基準のレイアウト、夕焼け・微粒子・泡・フェード等のアニメーション |
| ゲーム進行・演出・音声 | TypeScript（`src/ts/*.ts`） | シナリオ検証、台詞送り、立ち絵・背景切り替え、カメラ演出、Web Audio API による音量制御 |
| シナリオデータ | JSON（`static/data/scenario.json`） | 台詞原文、表示分割、話者 ID、背景、表情、音源、演出 ID の一元管理 |

### 設計上の制約

- 外部フォント、外部 JavaScript ライブラリ、実行時に外部通信が必要な素材は使用しない（TypeScript / Vite は開発・ビルド専用）
- データベースおよびセーブ・ロード機能は持たず、タイトルから END まで通して進行する
- 画面は 1600×900 の 16:9 を基準とし、`cqw` 単位を用いて文字・余白・装飾を同率で縮小する
- 端末の「視差効果を減らす」設定が有効でも、物語演出の時間を短縮しない（`prefers-reduced-motion` で既存演出を無効化しない）

## ディレクトリ構成

| パス | 役割 |
| --- | --- |
| `index.html`, `game.html` | タイトル画面・本編画面の静的 HTML（相対パス参照） |
| `vite.config.ts` | Vite 開発サーバー・マルチページビルド設定（`publicDir: "static"`, `base: "./"`） |
| `src/ts/` | タイトルおよび本編の TypeScript ソースコード |
| `static/css/` | 共通・画面別スタイルシート（`common.css`, `title.css`, `game.css`） |
| `static/data/` | シナリオ正本（`scenario.json`） |
| `static/images/` | 配信用の背景・立ち絵・ブラウザアイコン |
| `static/audio/` | 配信用の BGM・SE（音源用の Private リポジトリ `yuttei/novel_app_replies_assets` で管理し、Public リポジトリでは `.gitignore` 対象） |
| `dist/` | `npm run build` が生成する静的配信成果物（`.gitignore` 対象） |
| `img_background/`, `img_character/` | 背景・立ち絵の元画像 |
| `BGM/`, `SE/` | 配布元から入手した元音源（音源用の Private リポジトリで管理し、Public リポジトリでは `.gitignore` 対象） |
| `scripts/` | 検証・加工スクリプト（`check.sh`, `compare-script.ts`, `process_dova_audio.sh`） |
| `tests/` | TypeScript 単体テスト（`tests/ts/`）、Playwright E2E テスト（`tests/e2e/`） |
| `docs/` | 技術・運用ドキュメントおよび仕様書（`docs/specs/`） |
| `private/` | Public リポジトリへ含めない企画資料（`private/docs/`）の置き場所（音源用の Private リポジトリで管理し、Public リポジトリでは `.gitignore` 対象） |

## モジュール責務一覧

HTML から `data-*` 属性経由でベース URL や遷移先 URL を受け取る設計とし、TypeScript 内にルートパスをハードコードしない。

| ファイル | 主な責務 |
| --- | --- |
| `src/ts/title.ts` | タイトル画面の BGM 自動再生試行、スピーカーボタン操作、音源クレジットダイアログ、開始暗転と遷移 |
| `src/ts/game.ts` | 本編全体のオーケストレーション（DOM 接続、背景・立ち絵・カメラ・カード・END 画面の制御） |
| `src/ts/game-config.ts` | 演出時間（ミリ秒）、音量、画面設定などの定数定義 |
| `src/ts/scenario-runtime.ts` | `scenario.json` のスキーマ検証と、章・台詞・ページ・カード進行の状態管理 |
| `src/ts/scenario-effects.ts` | 利用可能な演出 ID、実行フェーズ、必要音源 ID のカタログ定義 |
| `src/ts/scenario-effect-runner.ts` | 演出 ID に対応する画面・カメラ・立ち絵・BGM/SE 処理の実行 |
| `src/ts/game-state-controller.ts` | 入力許可状態（進行中・演出中・確認ダイアログ表示中）と復帰状態の管理 |
| `src/ts/game-dialog-view.ts` | 逐次文字表示、話者名切り替え、主人公の選択肢風ボックス、読み上げ通知の制御 |
| `src/ts/audio-manager.ts` | 本編で使用する BGM・SE の読み込み、再生、停止、フェード呼び出し |
| `src/ts/audio-gain-controller.ts` | Web Audio API の `GainNode` による BGM 音量フェード制御、未対応環境での `HTMLAudioElement.volume` フォールバック、モバイル操作時の音声再開 |

## シナリオデータ構造（`scenario.json` version 2）

ブラウザで使用する台詞と演出の正本は `static/data/scenario.json` である。`src/ts/scenario-runtime.ts` が開始前にデータを検証し、未登録の素材 ID や不正な演出 ID がある場合は本編画面にエラーを表示して停止する。

### トップレベル構造

| キー | 型 | 説明 |
| --- | --- | --- |
| `version` | 数値 | スキーマ版（現在は `2`） |
| `startChapter` | 文字列 | 最初に再生する章の `id`（現在は `"opening"`） |
| `assets` | オブジェクト | 使用する背景画像（`backgrounds`）、クロコ表情一覧（`characterExpressions`）、音源定義（`audio`） |
| `chapters` | 配列 | 各章の `id`、台詞配列 `entries`、章終了時の遷移・カード定義 `completion` |

### エントリ（`entries` の各要素）

- **種別（`kind`）**：
  - `"dialogue"`：通常の台詞または地の文（画面下部の 2 行テキストボックスへ表示）
  - `"protagonist"`：主人公の台詞（画面中央の 1 行選択肢風ボックスへ最大 2 個表示）
- **本文と分割**：
  - `sourceText`：原文テキストをそのまま保持
  - `pages`：通常文を複数画面へ分ける場合の配列（連結すると `sourceText` と一致する必要あり）
  - `lines` / `linePages`：主人公台詞を 1〜2 個のボックスまたは複数画面へ分ける場合の配列（連結すると `sourceText` と一致する必要あり）
- **話者と見た目**：
  - `speaker`：表示する話者名（地の文は `null`）
  - `speakerId`：同一人物を判定する内部 ID（例：`???` と `クロコ` に同じ `"chroko"` を指定し、名前変更時にボックスを消さない）
  - `background`：`assets.backgrounds` に登録された背景 ID
  - `character`：`assets.characterExpressions` に登録された表情 ID（立ち絵なしは省略または `null`）
  - `textTone`：主人公台詞の文字色指定（赤文字演出等）
- **演出トリガー**：
  - `enterEffects`：エントリ表示開始時に実行する演出 ID の配列
  - `selectEffects`：主人公台詞ボックス選択時に実行する演出 ID の配列
  - `completeEffects`：エントリ表示完了時に実行する演出 ID の配列

### 演出 ID カタログ（`src/ts/scenario-effects.ts`）

基本操作と冒頭処理が常に使用する基本音源は `cancel`、`decision`、`footsteps`、`metronome` の 4 つである。シナリオ上の演出 ID は次の 13 種類を定義している。

| 演出 ID | 実行フェーズ | 使用する音源 ID |
| --- | --- | --- |
| `water-transition` | `enter` | `bubble` |
| `start-corridor-bgm` | `enter`, `select` | `corridor` |
| `fade-out-corridor-bgm` | `enter` | `corridor` |
| `hesitation-zoom-shake` | `enter` | `footsteps` |
| `final-dialog-pause` | `enter` | なし |
| `final-camera-zoom` | `enter` | なし |
| `start-eternal-earth-bgm` | `select` | `eternal-earth` |
| `start-star-remnants-bgm` | `select` | `star-remnants` |
| `hold-before-next-line` | `select` | なし |
| `set-character-surprise` | `select` | なし |
| `set-character-grin` | `select` | なし |
| `register-name` | `complete` | なし |
| `stop-corridor-bgm` | `complete` | `corridor` |
