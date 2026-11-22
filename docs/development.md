# 開発・テストガイド

本ドキュメントでは、開発環境の構築、Vite でのローカル起動、スマートフォン実機確認、Private 音源の配置、自動テスト、およびシナリオ更新手順をまとめる。

## 開発環境へ入る

プロジェクトルートへ移動し、Nix の開発シェルを起動する。

```sh
nix develop
```

終了するときは `exit` を実行する。

### ツールと依存関係の管理場所

| 管理ツール | 定義ファイル | 管理対象 |
| --- | --- | --- |
| Nix | `flake.nix` | Node.js、npm、Git、GitHub CLI、curl、FFmpeg |
| npm | `package.json` / `package-lock.json` | TypeScript（`tsc`）、Vite、`@types/node`、Playwright（すべて開発・ビルド・テスト専用） |

初回および依存更新時は `npm ci` でプロジェクトローカルの `node_modules/` を用意する。グローバル環境へ Node.js ライブラリをインストールしない。

## ローカルサーバーの起動（Vite）

`nix develop` で開発環境へ入った後、開発用サーバーを起動する。

```sh
npm ci
npm run dev
```

ブラウザで `http://127.0.0.1:5001` を開く。本編画面は `/game.html`（または `/game`）で表示できる。

本番ビルド結果（`dist/`）をローカルで確認する場合は、次のコマンドを使用する。

```sh
npm run build
npm run preview
```

### 同じ Wi-Fi のスマートフォンで確認する

Mac とスマートフォンを同じ Wi-Fi へ接続し、Mac 側で LAN 公開用の開発サーバーを起動する。接続中の Wi-Fi 内にのみ公開する確認用手順であり、公共 Wi-Fi や信頼できないネットワークでは使用しない。

```sh
npm run dev:lan
```

別のターミナルで Mac の Wi-Fi 用 IP アドレスを確認する。

```sh
ipconfig getifaddr en0
```

- 例：`192.168.0.18` と表示された場合は、スマートフォンのブラウザで `http://192.168.0.18:5001` を開く
- `127.0.0.1`はスマートフォン自身を表すため、スマートフォンからの確認には使用できない
- macOS から着信接続の確認が表示された場合は許可する
- 確認後はサーバーを起動したターミナルで `Control+C` を押して停止する

## Private 音源の配置と加工

ライセンス上 Public リポジトリで管理できない外部音源と、非公開の企画資料は、音源用の Private リポジトリ `yuttei/novel_app_replies_assets` で管理している（リポジトリの役割は [deployment.md のリポジトリ構成](deployment.md#リポジトリ構成)、管理の基準は [assets-policy.md](assets-policy.md) を参照）。音源用リポジトリには、コード側と同じパスでファイルを置いている。

### 開発者（音源用リポジトリへアクセスできる場合）

1. 音源用リポジトリを、コード側のリポジトリと同じ階層の `../novel_app_replies_assets` へ clone する（コード側のルートで実行する）
   ```sh
   gh repo clone yuttei/novel_app_replies_assets ../novel_app_replies_assets
   ```
2. 必要なフォルダを、コード側の同じ場所へコピーする（コード側のルートで実行する）
   ```sh
   # コピー先のフォルダがないと失敗する環境があるため、先に作っておく
   mkdir -p static/audio BGM SE private/docs
   # 配信用音源（起動・テストに使う）
   rsync -a ../novel_app_replies_assets/static/audio/ static/audio/
   # 元音源（音源を加工するときだけ使う）
   rsync -a ../novel_app_replies_assets/BGM/ BGM/
   rsync -a ../novel_app_replies_assets/SE/ SE/
   # 企画資料（参照するときだけ使う）
   rsync -a ../novel_app_replies_assets/private/docs/ private/docs/
   ```
3. コピーしたフォルダはコード側の `.gitignore` で除外されているため、Public リポジトリへはコミットされない。`git status --short` で音源や企画資料が表示されないことを確認する

音源用リポジトリが更新されたときは、`git -C ../novel_app_replies_assets pull` で最新にしてから、手順2をもう一度実行する。

### 音源を追加・差し替えるとき

音源の正本は音源用リポジトリ側である。コード側でだけ差し替えると、次のコピーで上書きされたり、デプロイに反映されなかったりするため、必ず音源用リポジトリへコミットする。

1. 元音源を差し替えた場合は、コード側の `BGM/`・`SE/` へ置く。DOVA-SYNDROME の元 BGM を差し替えた場合は、次のコマンドで再エンコード済みの配信用 BGM（`static/audio/bgm/`）を作り直す
   ```sh
   ./scripts/process_dova_audio.sh
   ```
2. コード側で起動・テストし、音が正しく再生されることを確認する
3. 変更したファイルを、音源用リポジトリの同じ場所へコピーする（コード側のルートで実行する。例は配信用音源と元音源の場合）
   ```sh
   rsync -a static/audio/ ../novel_app_replies_assets/static/audio/
   rsync -a BGM/ ../novel_app_replies_assets/BGM/
   rsync -a SE/ ../novel_app_replies_assets/SE/
   ```
4. 音源用リポジトリ側でコミットし、`main` へ反映する。Cloudflare の設定（[deployment.md](deployment.md#現在の移行ステータス) の段階5）は済んでいるため、音源用リポジトリの `main` への push で公開版のデプロイが始まる（[deployment.md のデプロイフロー](deployment.md#デプロイフロー) を参照）
5. 音源を追加・削除・差し替えた場合は、コード側の `CREDITS.md` と `index.html` のクレジット表記も確認する

`rsync -a` はコピー元にないファイルを削除しないため、音源を削除した場合は、音源用リポジトリ側でも同じファイルを削除する。

### 外部閲覧者（Public リポジトリのみクローンした場合）

- Public リポジトリには外部音源が含まれないため、音声再生はスキップされる（ブラウザの自動再生・音声読み込み失敗時でも物語の進行自体は停止しない設計）
- 音源の有無によるテストの動きは、下の「音源を配置していない環境でのテスト」を参照する

## 自動テストの実行

### 初回のみ：Playwright の準備

E2E テスト用の Chromium をローカルへ用意する（開発専用であり、公開成果物には含めない）。

```sh
npm ci
npx playwright install chromium
```

### 各テストの実行コマンド

| テスト種別 | 確認内容 | コマンド |
| --- | --- | --- |
| TypeScript 型チェック | `src/ts/`・`scripts/`・テスト・設定ファイルの厳格型チェック | `npm run typecheck` |
| 静的サイトビルド | Vite による `dist/` 生成 | `npm run build` |
| TypeScript 単体テスト | Vite ビルド後、HTML・CSS・ビルド成果物・PNG 透過・ICO サイズ・DOVA 加工確認・シナリオ構造・状態遷移・BGM 制御・演出カタログを検証 | `npm run test:unit` |
| Playwright E2E テスト | Vite ビルド後、3種類の画面サイズ、キーボード操作、復帰確認、エラー表示、タイトル〜END の通し進行を検証 | `npm run test:e2e` |
| 一括実行 | 型チェック・ビルド・単体テスト・E2E テスト・`git diff --check` | `./scripts/check.sh` |

### 音源を配置していない環境でのテスト

Public リポジトリだけをクローンした環境でもテストが通るよう、単体テストは音源の有無で動きを切り替える。

音源の確認は、使う音源によって次の2種類に分かれる。

- 配信用音源の確認：`dist/audio/` に配信用音源がそろうこと、`scenario.json` に登録した音源の実ファイルがあること（`static/audio/` を使う）
- DOVA 元音源との比較：配信用 BGM が DOVA の配布元 MP3 そのままでないこと（`static/audio/` と `BGM/` の両方を使う）

| 状況 | 配信用音源の確認 | DOVA 元音源との比較 | その他のテスト |
| --- | --- | --- | --- |
| `static/audio/` がない | スキップ（理由をテスト結果へ表示） | スキップ（理由をテスト結果へ表示） | 実行 |
| `BGM/` がない | 実行 | スキップ（理由をテスト結果へ表示） | 実行 |
| フォルダはあるが一部のファイルが欠けている | 確認対象のファイルが1つでも欠けていれば失敗（現在は `static/audio/` の全9ファイルが確認対象） | 比較する BGM 4曲（`BGM/` の元音源4曲と、`static/audio/bgm/` の title・corridor・eternal-earth・star-remnants）のどれかが欠けていれば失敗（それ以外のファイルの欠けでは成功） | 実行 |
| `REQUIRE_AUDIO_ASSETS=1` を付けて実行し、`static/audio/` がない | スキップせず失敗 | `BGM/` がなければスキップ、あれば失敗 | 実行 |
| `REQUIRE_AUDIO_ASSETS=1` を付けて実行し、`static/audio/` だけがある（デプロイ時の状態） | 実行 | スキップ（理由をテスト結果へ表示） | 実行 |

公開用のビルドでは、配信用音源の配置漏れを見逃さないよう `REQUIRE_AUDIO_ASSETS=1` を付けて実行する。`REQUIRE_AUDIO_ASSETS=1` で必須になるのは配信用音源の `static/audio/` だけである。元音源の `BGM/` は音源を加工する人の手元にだけ置く素材で、公開ビルドには使わないため、`REQUIRE_AUDIO_ASSETS=1` のときでも `BGM/` がなければ DOVA 元音源との比較だけをスキップする。

```sh
REQUIRE_AUDIO_ASSETS=1 npm run test:unit
```

`REQUIRE_AUDIO_ASSETS` に指定できる値は `1` だけである。未設定または空文字のときは通常の動き（音源がなければスキップ）になる。`true` や `yes` など `1` 以外の値を指定すると、指定ミスを見逃さないよう、「REQUIRE_AUDIO_ASSETS には 1 だけを指定できます（指定された値：true）」のようなエラーで単体テストの読み込みが止まる。

E2E テストは音声の再生処理をテスト用に置き換えているため、音源がなくても実行できる。

## 台詞とシナリオを変更するときの手順

ブラウザで使用する台詞と演出の正本は `static/data/scenario.json` である。[docs/specs/script.md](specs/script.md) は人間が読むための台本資料として扱う。

1. `static/data/scenario.json` の `sourceText` へゲームで使用する原文を記録
2. 発話台詞には表示名とは別に人物を識別する `speakerId` を指定（例：`???` と `クロコ` の両方に `chroko`）
3. 通常の長い台詞や地の文は `pages` で画面ごとに分割
4. 主人公の台詞は `lines` または `linePages` で各画面 1〜2 個のボックスへ分割
5. 背景（`background`）、立ち絵の表情（`character`）、必要な演出 ID を指定
6. 曲名カードは `advanceMode: "timer"` で 5 秒後の自動進行を指定
7. 関係する仕様書（[docs/specs/実装済み仕様.md](specs/実装済み仕様.md) および該当詳細仕様書）を更新
8. 台本資料も更新する依頼がある場合は、次のコマンドで差分を確認してから [docs/specs/script.md](specs/script.md) を更新
   ```sh
   npm run compare:script
   ```
9. `./scripts/check.sh` を実行し、台詞の連結整合・素材存在・画面動作を確認
