# 青春再演劇場 リプライズ（AI エージェント向け指針）

ブラウザ上で動作するノベルゲームのプロジェクトである。タイトル画面から END 画面まで実装済みであり、TypeScript と Vite を用いてローカル開発と静的サイト生成を行い、Public リポジトリ `yuttei/novel_app_replies`（コード）＋ Private リポジトリ `yuttei/novel_app_replies_assets`（音源・企画資料）＋ Cloudflare Pages（無料公開）で運用する構成としている。

## 技術構成

- フロントエンド：HTML（`index.html`, `game.html`）、CSS（`static/css/`）、TypeScript（`src/ts/*.ts`）
- 開発サーバー・ビルド：Vite（`vite.config.ts`、`npm run dev` / `npm run build`）
- シナリオデータ：`static/data/scenario.json`
- 開発環境：Nix（Node.js、npm、Git、GitHub CLI、curl、FFmpeg）
- 公開方針：Public リポジトリでコードと公開可能な素材を管理し、ライセンス上 Public に置けない音源を Private リポジトリ `yuttei/novel_app_replies_assets` へ分離して Cloudflare Pages（無料枠）へ静的配信（リポジトリ構成と詳細は [docs/deployment.md](docs/deployment.md)）
- データベース・セーブ機能：使用しない（一度開始したら END まで進める形式とし、明示的な依頼がない限り追加しない）

## 変更してはいけないもの

- `private/docs/前提.md`（`yuttei/novel_app_replies_assets` で管理し、ローカルへコピーして参照する）は、物語上の変更できない前提である。内容を変更しないこと
- `private/docs/概要.md`、`private/docs/詳細.md`、`docs/specs/script.md` は、ユーザーから明示的に依頼された場合を除いて書き換えないこと
- 台詞や物語を、実装作業の都合だけで言い換えたり補ったりしないこと
- 元画像と元音源を、配信用ファイルで上書きしたり削除したりしないこと
- Public リポジトリへライセンス NG の音源ファイルや個人情報を含む非公開資料を混入させないこと（詳細は [docs/assets-policy.md](docs/assets-policy.md)）

## 正しい内容を判断するときの優先順位

台本や仕様書よりもソースコードと実際の画面動作を正として扱う。記述が食い違う場合は次の順番で確認する。

1. `static/data/scenario.json`、TypeScript（`src/ts/`）、HTML（`index.html`, `game.html`）、CSS の実装
2. ローカルで動かした実際の画面、入力、音声、演出
3. [docs/specs/実装済み仕様.md](docs/specs/実装済み仕様.md)
4. [docs/specs/開始画面仕様.md](docs/specs/開始画面仕様.md)、[docs/specs/ゲーム冒頭仕様.md](docs/specs/ゲーム冒頭仕様.md)、[docs/specs/ゲーム後半仕様.md](docs/specs/ゲーム後半仕様.md)
5. [docs/specs/script.md](docs/specs/script.md)、およびローカルの `private/docs/` 配下の企画資料

ただし、`private/docs/前提.md`（存在する場合）の内容にはソースコード側も反してはならない。

ソースコードと文書が食い違っている場合は、ソースコードを古い文書へ戻さず、ローカルで動作を確認したうえで文書をソースコードへ合わせる。ユーザーの依頼が既存動作の変更である場合は、その依頼を目標仕様として実装し、実装後に関係する文書も更新する。

## 各文書の役割

| パス | 役割 | 公開区分 |
| --- | --- | --- |
| `README.md` | 作品概要、できること、クイックスタート、ドキュメント目次 | Public |
| `AGENTS.md` | AI エージェント向けの開発・運用ルール（`flake.nix` の参照維持のためルート配置） | Public |
| `CREDITS.md` | 音源・素材のクレジット、抽出禁止の案内、ライセンス管理方針 | Public |
| `LICENSE` | 本リポジトリのソースコード・自作素材のライセンス（MIT） | Public |
| `docs/architecture.md` | システム構成、TypeScript モジュール責務、`scenario.json` スキーマ・演出 ID | Public |
| `docs/development.md` | 環境構築、Vite 起動、スマホ確認、Private 音源配置、テスト、台詞更新手順 | Public |
| `docs/deployment.md` | リポジトリ構成、Cloudflare Pages 公開構成、Vite 静的ビルド、公開前チェック手順 | Public |
| `docs/assets-policy.md` | Public / Private 分離基準、音源ライセンス整理、個人情報・Git 履歴対策 | Public |
| `docs/specs/実装済み仕様.md` | タイトル〜END の総合仕様（進行表・演出時間・共通 UI・使用素材） | Public |
| `docs/specs/開始画面仕様.md` | タイトル画面の表示、BGM、アニメーション、操作の詳細 | Public |
| `docs/specs/ゲーム冒頭仕様.md` | 本編開始から2曲目カードまでの詳細 | Public |
| `docs/specs/ゲーム後半仕様.md` | 2曲目カードから END 画面までの詳細 | Public |
| `docs/specs/script.md` | 台詞と演出指示を記録した台本資料 | Public |
| `private/docs/前提.md` | 変更禁止の物語上の前提（実在の学校・団体名を含むため非公開） | Private |
| `private/docs/概要.md` | 物語全体の初期企画メモ（内部検討メモを含むため非公開） | Private |
| `private/docs/詳細.md` | 物語の詳しい構成と意図（実在の学校名を含むため非公開） | Private |

細かな演出時間や画面ごとの動作を `AGENTS.md` へ重複記載せず、該当する仕様書を参照する。動作を変更した場合は、[docs/specs/実装済み仕様.md](docs/specs/実装済み仕様.md) と該当する詳細仕様書をあわせて更新する。

## 実装の構成と方針

モジュール一覧や `scenario.json` の構造は [docs/architecture.md](docs/architecture.md) を参照する。

- 通常の台詞、章、背景、表情、音源を追加するときは、まず `static/data/scenario.json` で表現できるか確認し、`src/ts/game.ts` へシナリオデータを直接埋め込まない
- 新しい種類の演出が必要な場合だけ、汎用的な演出 ID、検証処理、再生処理、テストを追加する
- 画面は 1600×900 の 16:9 を基準とし、文字・余白を含む全要素を同率で縮小する
- 操作要素には実際の `button` 要素を使い、タップ・クリック・キーボード・読み上げの既存動作とフォーカス制御を壊さない
- 外部フォント、外部 JavaScript ライブラリ、実行時に外部通信が必要な素材は追加しない
- macOS などの「視差効果を減らす」が有効でも演出時間を短縮しない（CSS へ `prefers-reduced-motion` を追加して既存アニメーションを止めない）

## 画像と音源

- 元画像は `img_background/` と `img_character/` に残し、配信用画像は `static/images/` に置く
- 音源ファイル（元音源 `BGM/`・`SE/` および配信用 `static/audio/`）はライセンス方針に従い Private リポジトリ `yuttei/novel_app_replies_assets` 側で管理する（詳細は [docs/assets-policy.md](docs/assets-policy.md)）
- 新しい背景や音源を本編で使う場合は、実ファイルだけでなく `static/data/scenario.json` の `assets` にも登録する
- DOVA-SYNDROME の元 BGM を変更した場合は、`./scripts/process_dova_audio.sh` で公開用 BGM を再生成する
- 音源を追加・削除・差し替えた場合は、`CREDITS.md` と `index.html` のクレジット表記も確認する

「配信用ディレクトリへコピーする」ルールは画像と音源の元素材にのみ適用し、HTML / CSS / TypeScript の不要な複製は作らない。

## 開発環境と依存関係

- 開発コマンド群（Node.js、npm、Git、GitHub CLI、curl、FFmpeg）は `flake.nix` で管理する
- TypeScript / Vite / Playwright などの開発依存ライブラリは `package.json` と `package-lock.json` で管理する
- グローバル環境へ Node.js のライブラリをインストールしない
- 環境構築と起動手順の詳細は [docs/development.md](docs/development.md) を参照する

## 作業の完了条件

作業前に `git status --short --branch` で既存差分を確認する。実装後は原則として以下を実行する。

```sh
nix develop --command zsh -lc './scripts/check.sh'
```

画面、音声、演出、入力を変更した場合は自動テストだけで完了とせず、可能な範囲でブラウザまたは実機でも以下を確認する（未確認項目は未確認と明記する）。

- タイトル画面から END 画面まで進めること
- 667×375、844×390、1920×1080 でゲーム画面全体が収まること
- タップ、クリック、Enter、Space、Escape、Tab の既存操作を壊していないこと
- BGM の自動再生制限、再開、フェード、SE のタイミングが正しいこと
- スマートフォン横向きでも文字、ボタン、立ち絵が画面外へ出ないこと
- 変更した動作と [docs/specs/実装済み仕様.md](docs/specs/実装済み仕様.md) および該当詳細仕様が一致すること
