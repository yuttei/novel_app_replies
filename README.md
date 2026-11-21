# 青春再演劇場 リプライズ

ブラウザ上で動作するノベルゲームのプロジェクトである。HTML / CSS / TypeScript と Vite で構成し、ゲームの進行・文字送り・演出・音声再生をすべてブラウザ側で実行する。

## このプロジェクトでできること

- **タイトル画面から END 画面までの通しの再生**：
  - 夕焼けの光と微粒子が動くタイトル画面、タイトル BGM 再生、音源クレジット表示
  - 1文字ずつの逐次表示、主人公の選択肢風ボックス、クロコの立ち絵・表情切り替え、背景クロスフェード・カメラ演出
  - 1曲目・2曲目・3曲目・第3部の自動進行カード（各5秒）と END 画面の再生
- **PC・スマートフォン対応**：
  - 1600×900（16:9）を基準に全要素を同率縮小し、スマートフォンの横向き・縦向き表示に対応
  - タップ、マウスクリック、キーボード操作（Enter・Space・Tab・Escape）、スクリーンリーダー読み上げに対応
  - Web Audio API の `GainNode` による BGM フェード制御と、未対応環境向けフォールバック
- **データ駆動のシナリオ管理**：
  - `static/data/scenario.json` で台詞、画面分割、背景、表情、音源、演出 ID を一元管理
- **Vite による高速な開発と静的サイト公開**：
  - ローカル開発では `npm run dev`（Vite 開発サーバー）で即時プレビューし、公開時は `npm run build` で生成した `dist/` を Cloudflare Pages へ配信する構成

※セーブ・ロード機能およびデータベース保存は行わない（開始から END まで通して進める形式）。

## 遊び方

ゲームを遊ぶときは、Cloudflare Pages の公開 URL をブラウザで開く。公開 URL は Cloudflare の設定後に決まる（https://novel-app-replies.pages.dev を予定）。設定が終わるまでは公開版はない。

このリポジトリには BGM・SE の音源ファイルが含まれない。音源はライセンス上の理由から Private リポジトリで管理しているため、このリポジトリだけを clone して起動した場合は音が鳴らない（音声を読み込めなくても物語の進行は止まらない設計である）。

## クイックスタート（ローカル起動）

```sh
nix develop
npm ci
npm run dev
```

ブラウザで `http://127.0.0.1:5001` を開く。環境構築、同一 Wi-Fi 上のスマートフォン実機確認、Private 音源の配置（音源用リポジトリへアクセスできる開発者向け）、自動テストの詳細は [docs/development.md](docs/development.md) を参照する。

## ドキュメント構成

詳細や仕様は [docs/](docs/) 配下にまとめている。

### 技術・運用ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | システム構成、TypeScript モジュールの責務、`scenario.json` スキーマと演出 ID |
| [docs/development.md](docs/development.md) | 開発環境、Vite 起動、スマホ確認、Private 音源配置、テスト、台詞更新手順 |
| [docs/deployment.md](docs/deployment.md) | リポジトリ構成（Public コード・Private 音源・Private 旧履歴）、Cloudflare Pages へのデプロイ、公開前チェック |
| [docs/assets-policy.md](docs/assets-policy.md) | Public / Private の管理境界、音源ライセンス方針、個人情報・Git 履歴管理 |
| [CREDITS.md](CREDITS.md) | 使用音源・素材のクレジット表記、利用規約・抽出禁止の案内 |

### 仕様書・台本

| ドキュメント | 内容 |
| --- | --- |
| [docs/specs/実装済み仕様.md](docs/specs/実装済み仕様.md) | タイトル画面から END までの総合仕様（進行表・演出時間・共通 UI・素材一覧） |
| [docs/specs/開始画面仕様.md](docs/specs/開始画面仕様.md) | タイトル画面の表示、BGM、アニメーション、操作の詳細 |
| [docs/specs/ゲーム冒頭仕様.md](docs/specs/ゲーム冒頭仕様.md) | 本編開始から2曲目カードまでの詳細 |
| [docs/specs/ゲーム後半仕様.md](docs/specs/ゲーム後半仕様.md) | 2曲目カードから END 画面までの詳細 |
| [docs/specs/script.md](docs/specs/script.md) | ゲーム内で使用する台詞と演出指示の台本資料 |

## ライセンスと素材の扱い

- 本リポジトリのソースコード・ドキュメント・台本・自作素材は [MIT License](LICENSE) で公開する。
- BGM・SE などの外部音源素材は各配布元の利用規約に従う。詳細は [CREDITS.md](CREDITS.md) および [docs/assets-policy.md](docs/assets-policy.md) を確認する。
- 外部音源ファイルは、ライセンス上 Public リポジトリへの同梱が不適切なため、このリポジトリには含めず、音源用の Private リポジトリ `yuttei/novel_app_replies_assets` で管理している。リポジトリの構成は [docs/deployment.md](docs/deployment.md#リポジトリ構成) を参照する。
