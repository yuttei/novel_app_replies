# 公開・デプロイ設計（Cloudflare Pages）

本ドキュメントでは、TypeScript + Vite で静的サイトを生成し、コードは Public リポジトリ、ライセンス制限のある音源と非公開の企画資料は Private リポジトリへ分けて、Cloudflare Pages（無料枠）でブラウザ完結の Web ゲームとして公開する構成と手順をまとめる。

## 現在の移行ステータス

| 段階 | 状態 | 内容 |
| --- | --- | --- |
| 1. ドキュメント・構成整理 | 実施済み | `README.md`、`CREDITS.md`、`LICENSE`、`AGENTS.md`、`docs/` の整備、非公開企画資料の `private/docs/` 退避 |
| 2. TypeScript / Vite 化 | 実施済み | Python / Flask / Render 依存を廃止し、Vite（`npm run build`）で `dist/` を静的出力する構成へ移行 |
| 3. クレジット表記追記・音源分離テスト対応 | 実施済み | タイトル画面クレジットへの音源抽出禁止文言追記、音源未配置時に音源の確認だけをスキップする単体テスト（`REQUIRE_AUDIO_ASSETS=1` のときは配信用音源 `static/audio/` が欠けていればスキップせず失敗させる。元音源 `BGM/` は必須にしない） |
| 4. GitHub リポジトリ分離 | 実施済み | 旧リポジトリの `yuttei/novel_app_replies_archive`（Private）への改名・保存、履歴を作り直した `yuttei/novel_app_replies`（Public）の作成、音源と企画資料の `yuttei/novel_app_replies_assets`（Private）への移動（構成は[リポジトリ構成](#リポジトリ構成)を参照） |
| 5. Cloudflare Pages 連携 | 実施済み（2026-11-22） | 音源用リポジトリ（`yuttei/novel_app_replies_assets`）の Secrets（`CLOUDFLARE_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID`）を登録し、手動実行したデプロイ用ワークフローで初回デプロイが成功した。Cloudflare Pages のプロジェクト `novel-app-replies` は、ワークフローの「なければ作る」手順で自動作成された。公開 URL は https://novel-app-replies.pages.dev 。公開版で確認済みの項目と未確認の項目は、[公開後の動作確認](#public-リポジトリのチェックリスト)を参照 |

## リポジトリ構成

3つのリポジトリの役割と公開範囲は次のとおりである。ほかの文書からは、この表を参照する。

| リポジトリ | 公開範囲 | 置くもの | 役割 |
| --- | --- | --- | --- |
| `yuttei/novel_app_replies` | **Public** | ソースコード（`index.html`, `game.html`, `vite.config.ts`, `src/ts/`, `static/css/`, `static/data/`, `scripts/`, `tests/`）、文書（`README.md`, `CREDITS.md`, `AGENTS.md`, `LICENSE`, `docs/`）、画像（`static/images/`, `img_background/`, `img_character/`） | 開発の本体。音源（`static/audio/`, `BGM/`, `SE/`）と企画資料（`private/`）は含めず、`.gitignore` で除外する |
| `yuttei/novel_app_replies_assets` | **Private** | 配信用音源 `static/audio/`、元音源 `BGM/`・`SE/`、企画資料 `private/docs/`（コード側と同じパスで置く） | 音源と企画資料の保管。Cloudflare Pages へデプロイする GitHub Actions と、その認証情報（Secrets）もここに置く |
| `yuttei/novel_app_replies_archive` | **Private**（公開しない） | 旧 `yuttei/novel_app_replies` の全履歴（本名・端末名・元音源を含む） | 古い履歴の保存専用。改名して残したもので、新しい開発には使わない |

## 公開アーキテクチャの全体像

ゲームの実行処理（シナリオ読込・文字送り・演出・BGM/SE 再生）はすべてブラウザ側で完結するため、本番公開時にアプリサーバーを常駐させる必要はない。

| 要素 | 担当場所 | 公開範囲 | 役割 |
| --- | --- | --- | --- |
| アプリ本体・文書・画像 | `yuttei/novel_app_replies` | **Public** | ゲームのコードと公開できる素材を管理する |
| 外部音源・非公開企画資料 | `yuttei/novel_app_replies_assets` | **Private** | 配信用音源、元音源、企画資料を管理する |
| ビルド・デプロイ実行 | `yuttei/novel_app_replies_assets` の GitHub Actions | **Private** | Public のコードと Private の `static/audio/` を組み合わせ、テストとビルドを通した `dist/` を Cloudflare Pages へ配信する |
| ホスティング先 | Cloudflare Pages（無料枠）のプロジェクト `novel-app-replies` | 一般公開（Web ゲーム） | 静的ファイル（`dist/`）を HTTPS 配信する。公開 URL は https://novel-app-replies.pages.dev |

### GitHub Pages ではなく Cloudflare Pages を選ぶ理由

- **公開 Artifact からの音源流出を防止**：Public リポジトリ上で GitHub Pages 用の `actions/upload-pages-artifact` を実行すると、音源入り Artifact が Actions 画面から第三者へダウンロード可能な状態になる。Private の音源用リポジトリのワークフローから Cloudflare Pages へ直接デプロイすれば、Public リポジトリにも公開 Artifact にも音源を残さない
- **無料枠での運用性**：GitHub Free のまま Private リポジトリと組み合わせて無料公開でき、無料 Web サーバーのようなスリープ・再起動待ちが発生しない

## Vite 静的ビルドの仕組み

`vite.config.ts` でマルチページ入力（`index.html`、`game.html`）、`base: "./"`、`publicDir: "static"` を設定している。

- `npm run build` を実行すると、`src/ts/` が最適化された ES Modules（`dist/assets/*.js`）へ変換され、`index.html`・`game.html` および `static/` 配下の CSS・JSON・画像・音源が `dist/` へ一括出力される
- すべての参照が相対パス（`./`）のため、ルートドメインでもサブパス配下でもそのまま動作する

## デプロイフロー

デプロイ用の GitHub Actions は `yuttei/novel_app_replies_assets` に置く。ワークフローは下のきっかけのたびに動き、ビルドとテストを通したあと、Secrets を使って Cloudflare Pages へ公開する。Cloudflare の設定（段階5）は済んでいるため、現在はきっかけのたびに公開版が更新される。Secrets が登録されていない場合や API トークンが失効している場合は、公開の前で失敗して止まり、公開版は更新されない。

### デプロイのきっかけ

| きっかけ | 自動デプロイ | 使う場面 |
| --- | --- | --- |
| 音源用リポジトリの Actions 画面から手動で実行する | する | コード（Public 側）を変えたとき |
| 音源用リポジトリの `main` へ push する | する | 音源を追加・差し替えたとき |
| Public リポジトリへ push する | **しない** | ― |

Public リポジトリへ push しただけでは公開版は更新されない。コードの変更を公開版へ反映するときは、push の後に音源用リポジトリの Actions 画面からワークフローを手動で実行する。

### ワークフローの手順

ワークフローの本体は、音源用リポジトリの `.github/workflows/deploy.yml` である。各手順の詳しい説明は、音源用リポジトリの `README.md` にまとめている。

1. Public リポジトリ（`yuttei/novel_app_replies`）の `main` をチェックアウトする
2. 音源用リポジトリからは、`sparse-checkout`（一部だけの取得）のフォルダ単位の指定で、`static/audio/` と一番上の階層のファイル（`.gitignore`・`README.md`）だけを取得する。元音源 `BGM/`・`SE/` と企画資料 `private/docs/` はランナーに置かない。取得した `static/audio/` を、チェックアウトしたコードの `static/audio/` へ配置する
3. `npm ci --ignore-scripts` で依存ライブラリをインストールする（依存ライブラリのインストールスクリプトは動かさない）
4. `REQUIRE_AUDIO_ASSETS=1 npm run test:unit` を実行する。このコマンドは内部で `npm run build` を実行して `dist/` を生成し、続けて単体テストを行う。配信用音源の配置漏れなどでテストが失敗した場合はデプロイを止める（元音源 `BGM/` は配置しないため、DOVA 元音源との比較テストはスキップされる）
5. Cloudflare の操作に使う wrangler（Cloudflare の公式コマンド）を、Secrets を渡さない手順で先にインストールする
6. 手順4で生成された `dist/` を、Cloudflare Pages のプロジェクト `novel-app-replies` へそのままデプロイする（ビルドを別に実行し直さない。プロジェクトがまだなければ、初回の実行で作成する）
7. 公開 URL（https://novel-app-replies.pages.dev）で、タイトル画面・本編・BGM/SE・クレジット表記を確認する

### 公開版のページの URL

| ページ | URL | 備考 |
| --- | --- | --- |
| タイトル画面 | https://novel-app-replies.pages.dev/ | ― |
| 本編画面 | https://novel-app-replies.pages.dev/game | `/game.html` を開くと、Cloudflare Pages の仕様で `/game` へ 308 で転送される（転送先は 200）。タイトルの開始ボタンは `./game.html` へ移動するが、この転送を経て本編が表示される |

### 認証情報

Cloudflare へのデプロイに使う認証情報は、音源用リポジトリの GitHub Actions の Secrets に登録する。リポジトリのファイルには書かない。

| Secret 名 | 内容 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Pages へデプロイするための API トークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare のアカウント ID |

Cloudflare アカウントの作成、API トークンの作成、Secrets の登録は、ユーザーが自分で行う（2026-11-22 に設定済み）。初回設定の手順（アカウント作成、Account ID の確認、API トークンの作成、Secrets の登録、ワークフローの手動実行、公開 URL の確認）は、音源用リポジトリの `README.md` にまとめている。

現在の API トークンは、権限を Cloudflare Pages の Edit だけ、対象をこのアカウントだけに絞っており、**2027-11-22 に失効する**。失効するとデプロイできなくなるため、その前にトークンを作り直し、Secret `CLOUDFLARE_API_TOKEN` を更新する（手順は音源用リポジトリの `README.md` の「現在の設定状況」を参照）。

## Public リポジトリのチェックリスト

Public リポジトリへ push する前と、公開版を更新する前に、次の項目を確認する（詳細基準は [assets-policy.md](assets-policy.md) を参照）。

- **Git 履歴**：
  - 旧リポジトリの履歴には本名・ローカル端末名・元音源ファイルが含まれるため、Public リポジトリへは引き継がない（旧履歴は `yuttei/novel_app_replies_archive` に Private のまま保存する）
  - コミット時の `user.name` はハンドル名（`yuttei`）、`user.email` は Gmail アドレスを使用する（Public リポジトリではコミット履歴から誰でも閲覧できる）
- **非公開ファイルの除外確認**：
  - `BGM/`、`SE/`、`static/audio/`、`private/` が Public リポジトリのツリーおよび履歴に含まれないこと（`.gitignore` はまだ追跡していないファイルにしか効かないため、追跡済みのファイルが残っていないかも確認する）
  - `git ls-files` で `.mp3` ファイルや `前提.md`・`概要.md`・`詳細.md` が追跡されていないこと
  - `git ls-files -ci --exclude-standard`（追跡済みで、`.gitignore` の除外対象にも当たるファイルの一覧）の結果が0件であること
- **ゲーム内のクレジット・禁止事項表記**：
  - タイトル画面の音源クレジットダイアログに、OtoLogic（CC BY 4.0）表記およびリンクに加え、**ゲーム内からの音源ファイルの抽出・別用途利用を禁止する旨**が記載されていること
- **公開後の動作確認**（段階5の初回デプロイ後に行う。2026-11-22 時点の確認状況を各項目の下に記す）：
  - PC およびスマートフォンでタイトル画面（`/`）と本編画面（`game.html`）が 200 で表示されること
    - 確認済み：PC のブラウザでタイトル画面の表示と、「tap to start」から本編へ移って最初の台詞が表示されること（`/game.html` は `/game` へ 308 で転送され、転送先は 200）。シナリオ・CSS・favicon の配信（200）
    - 未確認：スマートフォン実機
  - タイトル BGM、メトロノーム、朝日 BGM、悠久の大地、星の名残り、各 SE が再生・フェードされること
    - 確認済み：音源9件の配信（200）、タイトル BGM の読み込みと再生状態、本編で使う音源の読み込み
    - 未確認：実際に音が聞こえること、フェード、タイトル BGM 以外の曲と SE の再生
  - ブラウザタブの favicon と音源クレジットダイアログが正常に表示されること
    - 確認済み：クレジットの禁止文言
    - 未確認：公開版での favicon と音源クレジットダイアログの見た目
  - タイトルから END を経てタイトルへ戻るまでエラーなく進行すること
    - 確認済み：本編の最初の台詞まで、コンソールにエラーが出ないこと
    - 未確認：公開版での END までの通しプレイ
