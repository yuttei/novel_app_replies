# 公開・デプロイ設計（Cloudflare Pages）

本ドキュメントでは、TypeScript + Vite で静的サイトを生成し、コードは Public リポジトリ、ライセンス制限のある音源と非公開の企画資料は Private リポジトリへ分けて、Cloudflare Pages（無料枠）でブラウザ完結の Web ゲームとして公開する構成と手順をまとめる。

## 現在の移行ステータス

| 段階 | 状態 | 内容 |
| --- | --- | --- |
| 1. ドキュメント・構成整理 | 実施済み | `README.md`、`CREDITS.md`、`LICENSE`、`AGENTS.md`、`docs/` の整備、非公開企画資料の `private/docs/` 退避 |
| 2. TypeScript / Vite 化 | 実施済み | Python / Flask / Render 依存を廃止し、Vite（`npm run build`）で `dist/` を静的出力する構成へ移行（旧 URL の扱いは[旧公開先 Render からの転送](#旧公開先-render-からの転送)を参照） |
| 3. クレジット表記追記・音源分離テスト対応 | 実施済み | タイトル画面クレジットへの音源抽出禁止文言追記、音源未配置時に音源の確認だけをスキップする単体テスト（`REQUIRE_AUDIO_ASSETS=1` のときは配信用音源 `static/audio/` が欠けていればスキップせず失敗させる。元音源 `BGM/` は必須にしない） |
| 4. GitHub リポジトリ分離 | 実施済み | 旧リポジトリの `yuttei/novel_app_replies_archive`（Private）への改名・保存、履歴を作り直した `yuttei/novel_app_replies`（Public）の作成、音源と企画資料の `yuttei/novel_app_replies_assets`（Private）への移動（構成は[リポジトリ構成](#リポジトリ構成)を参照） |
| 5. Cloudflare Pages 連携 | 実施済み（2026-11-22） | 音源用リポジトリ（`yuttei/novel_app_replies_assets`）の Secrets（`CLOUDFLARE_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID`）を登録し、手動実行したデプロイ用ワークフローで初回デプロイが成功した。Cloudflare Pages のプロジェクト `novel-app-replies` は、ワークフローの「なければ作る」手順で自動作成された。公開 URL は https://novel-app-replies.pages.dev 。公開版で確認済みの項目と未確認の項目は、[公開後の動作確認](#public-リポジトリのチェックリスト)を参照 |

## リポジトリ構成

3つのリポジトリの役割と公開範囲は次のとおりである。ほかの文書からは、この表を参照する。

| リポジトリ | 公開範囲 | 置くもの | 役割 |
| --- | --- | --- | --- |
| `yuttei/novel_app_replies` | **Public** | ソースコード（`index.html`, `game.html`, `vite.config.ts`, `src/ts/`, `static/css/`, `static/data/`, `scripts/`, `tests/`）、文書（`README.md`, `CREDITS.md`, `AGENTS.md`, `LICENSE`, `docs/`）、画像（`static/images/`, `img_background/`, `img_character/`） | 開発の本体。音源（`static/audio/`, `BGM/`, `SE/`）と企画資料（`private/`）は含めず、`.gitignore` で除外する |
| `yuttei/novel_app_replies_assets` | **Private** | 配信用音源 `static/audio/`、元音源 `BGM/`・`SE/`、企画資料 `private/docs/`（コード側と同じパスで置く） | 音源と企画資料の保管。Cloudflare Pages へデプロイする GitHub Actions と、その認証情報（Secrets）もここに置く |
| `yuttei/novel_app_replies_archive` | **Private**（公開しない） | 旧 `yuttei/novel_app_replies` の全履歴（本名・端末名・元音源を含む） | 古い履歴の保存専用。改名して残したもので、新しい開発には使わない。Render の旧サービスがこのリポジトリに接続されたままだが、自動デプロイは Off にしている（[旧公開先 Render からの転送](#旧公開先-render-からの転送)を参照） |

## 公開アーキテクチャの全体像

ゲームの実行処理（シナリオ読込・文字送り・演出・BGM/SE 再生）はすべてブラウザ側で完結するため、本番公開時にアプリサーバーを常駐させる必要はない。

| 要素 | 担当場所 | 公開範囲 | 役割 |
| --- | --- | --- | --- |
| アプリ本体・文書・画像 | `yuttei/novel_app_replies` | **Public** | ゲームのコードと公開できる素材を管理する |
| 外部音源・非公開企画資料 | `yuttei/novel_app_replies_assets` | **Private** | 配信用音源、元音源、企画資料を管理する |
| ビルド・デプロイ実行 | `yuttei/novel_app_replies_assets` の GitHub Actions | **Private** | Public のコードと Private の `static/audio/` を組み合わせ、テストとビルドを通した `dist/` を Cloudflare Pages へ配信する |
| ホスティング先 | Cloudflare Pages（無料枠）のプロジェクト `novel-app-replies` | 一般公開（Web ゲーム） | 静的ファイル（`dist/`）を HTTPS 配信する。公開 URL は https://novel-app-replies.pages.dev |
| 旧 URL の転送 | Render の無料 Web Service `novel_app_replies` | 一般公開（転送のみ） | 旧公開先の URL（https://novel-app-replies.onrender.com）へのアクセスを、公開版の同じパスへ 301 で転送する。ゲームのファイルは配信しない（[旧公開先 Render からの転送](#旧公開先-render-からの転送)を参照） |

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
6. 手順4で生成された `dist/` を、Cloudflare Pages のプロジェクト `novel-app-replies` へそのままデプロイする（ビルドを別に実行し直さない。ワークフローは実行のたびにプロジェクトの有無を確かめ、なければ作成する。2026-11-22 の初回の実行で作成済み）

ワークフローが終わったら、人が公開 URL（https://novel-app-replies.pages.dev）で、[公開後の動作確認](#public-リポジトリのチェックリスト)の項目を確かめる。

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

## 旧公開先 Render からの転送

以前は、旧版（Python / Flask）を Render で公開し、その URL を人に教えて遊んでもらっていた。旧 URL を開いた人が新しい公開版へたどり着けるように、2026-11-22 に Render のサービスを「旧 URL へのアクセスを Cloudflare Pages の公開版へ転送するだけ」に変えた。

### サービスの設定

| 項目 | 設定 |
| --- | --- |
| サービスの種類 | Render の無料 Web Service（Python 3） |
| サービス名 | `novel_app_replies` |
| 旧 URL | https://novel-app-replies.onrender.com |
| 接続しているリポジトリ | `yuttei/novel_app_replies_archive` の `main`（改名前の `yuttei/novel_app_replies` への接続が、改名に自動で追従したもの） |
| ビルドコマンド | `echo` でビルドが不要な旨を表示するだけ（何もビルドしない） |
| 起動コマンド | Python 標準ライブラリ `http.server` のワンライナー（全文と説明は[起動コマンド](#起動コマンド)を参照） |
| Health Check Path | `/healthz` |
| 自動デプロイ | Off |

- 自動デプロイを Off にした理由：
  - 段階2以降、旧リポジトリには Render 用の設定（`render.yaml`・`app.py`・`requirements.txt`）がない。そのため転送へ切り替える前は、自動デプロイが3回失敗し、4か月前の旧版が配信され続けていた
  - Off にしたことで、`yuttei/novel_app_replies_archive` へ push してもデプロイは動かない

### 転送の動作

| 開いたパス | 応答 |
| --- | --- |
| ちょうど `/healthz`（クエリ文字列なし） | 200（本文なし） |
| `/` で始まる、それ以外のすべてのパス | 301 で、`https://novel-app-replies.pages.dev` の同じパス（クエリ文字列も含む）へ転送<br>例：`/game?x=1` → `https://novel-app-replies.pages.dev/game?x=1`<br>例：`/healthz?x=1` → `https://novel-app-replies.pages.dev/healthz?x=1` |
| `/` で始まらない要求（例：`@example.com`） | 301 で、公開版のトップ `https://novel-app-replies.pages.dev/` へ転送 |

- 転送先のホスト名は `novel-app-replies.pages.dev` に固定しており、`/` で始まるパスだけをその後ろにつなげる。`/` で始まらない要求をそのままつなげると、`https://novel-app-replies.pages.dev@example.com` のように別のホストを指す URL になるため、トップ `/` へ転送する
- 旧 URL では、`/` で始まらない要求は Render の前段で 400 になり、起動コマンドのサーバーまで届かなかった（下の確認結果を参照）。上の `/` へ転送する処理は、前段がこの要求を通した場合の備えである
- 旧版の音源のパス（`/static/audio/...`）も転送されるだけで、Render からはファイルを何も配信しない
- 応答するのは GET と HEAD のリクエストだけ。POST などほかの方法のリクエストには、`http.server` の既定どおり 501 を返す（同じ起動コマンドを手元で動かして確認。旧 URL へは送っていない）

旧 URL での確認結果は次のとおりである（2026-11-22、新しい起動コマンドのデプロイ後に確認）。

| 開いたパス | 旧 URL の応答 |
| --- | --- |
| `/` | `https://novel-app-replies.pages.dev/` へ 301 |
| `/game` | `https://novel-app-replies.pages.dev/game` へ 301 |
| `/game?x=1` | `https://novel-app-replies.pages.dev/game?x=1` へ 301 |
| `/healthz` | 200 |
| `@example.com`（`/` で始まらない要求） | Render の前段で 400 Bad Request |

- 転送をたどった先（pages.dev）が 200 になることは、新しい起動コマンドに替える前の確認（2026-11-22）で確かめた

### 起動コマンド

Render の起動コマンドに設定している全文である。

```sh
python3 -c "import os,http.server as s;T='https://novel-app-replies.pages.dev';f=lambda r:(r.send_response(200 if r.path=='/healthz' else 301),r.send_header('Location',T+(r.path if r.path.startswith('/') else '/')),r.send_header('Content-Length','0'),r.end_headers());H=type('H',(s.BaseHTTPRequestHandler,),{'do_GET':f,'do_HEAD':f});s.ThreadingHTTPServer(('0.0.0.0',int(os.environ.get('PORT','10000'))),H).serve_forever()"
```

`python3 -c` は、続く文字列を Python のプログラムとして実行する。文字列の中身は、`;` で区切った次の処理である。

| 部分 | していること |
| --- | --- |
| `import os,http.server as s` | 環境変数を読むための `os` と、簡単な Web サーバーを作る標準ライブラリ `http.server`（以下 `s`）を読み込む |
| `T='https://novel-app-replies.pages.dev'` | 転送先（固定）を `T` に入れる |
| `f=lambda r:(...)` | リクエストを1件受けたときの処理 `f` を作る。`r` は受けたリクエストで、次の順に応答する<br>1. パス（`r.path`、クエリ文字列を含む）がちょうど `/healthz` なら 200、それ以外なら 301 の応答番号を送る（`/healthz?x=1` は一致しないので 301）<br>2. `r.path.startswith('/')` で、パスが `/` で始まるかを確かめる。始まるなら `r.path`、始まらないなら `/` を `T` の後ろにつなげ、転送先を示す `Location` ヘッダーに入れる（`/healthz` の 200 にも付くが、200 ではブラウザは転送しない）<br>3. 本文の長さを 0 と送り、ヘッダーを送り終える |
| `H=type('H',(s.BaseHTTPRequestHandler,),{'do_GET':f,'do_HEAD':f})` | 標準の処理役 `BaseHTTPRequestHandler` をもとに、GET と HEAD のリクエストで `f` を呼ぶ処理役 `H` を作る。`class` 文は `;` の後に続けて書けないため、`type` で作っている |
| `s.ThreadingHTTPServer((...),H).serve_forever()` | すべての接続元から受け付ける `0.0.0.0` と、Render が環境変数 `PORT` で指定する番号（指定がなければ 10000）でサーバーを起動し、止めるまで待ち受け続ける。`ThreadingHTTPServer` は、複数のリクエストを並行して処理するサーバーである |

### 注意点

- 無料プランは、15分アクセスがないと休止する。休止中に旧 URL を開くと、すぐには転送されず、復帰を待つあいだ Render の読み込み中の画面が表示される。復帰には1分ほどかかる（[Render の文書](https://render.com/docs/free)による。実際にかかる時間は未確認）
- 新しく案内するときは、旧 URL ではなく公開版の URL（https://novel-app-replies.pages.dev）を使う

### 転送をやめる・再開する

- やめる：Render の画面でサービスを停止（Suspend）する。旧 URL は「Service Suspended」（503）になる（2026-11-22 に実際に停止し、`curl` で 503 と、本文の「Service Suspended」「This service has been suspended by its owner.」を確認）
- 再開する：Render の画面で Resume を実行する

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
- **公開後の動作確認**（2026-11-22 時点の確認状況を各項目の下に記す）：
  - 行う場面：初回の公開時と、画面の表示・演出・音源・ページの移動を変えた更新の公開後は、下の全項目を確かめる。文書や小さな修正だけの更新の公開後は、「タイトル画面（`/`）と本編画面（`/game`）が 200 で表示されること」の項目と、コンソールにエラーが出ないことだけを確かめる
  - PC およびスマートフォンでタイトル画面（`/`）と本編画面（`/game`）が 200 で表示されること（`/game.html` は `/game` へ 308 で転送される）
    - 確認済み：PC のブラウザでタイトル画面の表示と、「tap to start」から本編へ移って最初の台詞が表示されること（`/game.html` は `/game` へ 308 で転送され、転送先は 200）。シナリオ・CSS・favicon の配信（200）
    - 未確認：スマートフォン実機
  - タイトル BGM、メトロノーム、朝日 BGM、悠久の大地、星の名残り、各 SE が再生・フェードされること
    - 確認済み：音源9件の配信（200）、タイトル BGM の読み込みと再生状態、本編で使う音源8件（BGM 4件・SE 4件）のうち4件（泡・キャンセル・決定音・メトロノーム）のブラウザでの読み込み（200/206）
    - 未確認：本編の残りの音源4件（朝日・悠久の大地・星の名残り・足音）のブラウザでの読み込み、実際に音が聞こえること、フェード、タイトル BGM 以外の曲と SE の再生
  - ブラウザタブの favicon と音源クレジットダイアログが正常に表示されること
    - 確認済み：クレジットの禁止文言
    - 未確認：公開版での favicon と音源クレジットダイアログの見た目
  - タイトルから END を経てタイトルへ戻るまでエラーなく進行すること
    - 確認済み：本編の最初の台詞まで、コンソールにエラーが出ないこと
    - 未確認：公開版での END までの通しプレイ
