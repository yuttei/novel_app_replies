# 素材・ライセンス・プライバシー管理方針

本ドキュメントでは、Public リポジトリと Private リポジトリの管理境界、外部音源のライセンス根拠、および個人情報・Git 履歴の管理ルールを定める。

## Public / Private の管理境界

ライセンス上 Public リポジトリに同梱できない素材と、実在の学校名・団体名・内部検討メモを含む企画資料は Private リポジトリへ分離する。下の表の「Public」は `yuttei/novel_app_replies`、「Private」は音源用リポジトリ `yuttei/novel_app_replies_assets` を指す。3つのリポジトリの役割と公開範囲は [deployment.md のリポジトリ構成](deployment.md#リポジトリ構成) を参照する。

| 対象 | 管理場所 | 理由・方針 |
| --- | --- | --- |
| ソースコード（`index.html`, `game.html`, `vite.config.ts`, `src/ts/`, `static/css/`, `scripts/`, `tests/`） | **Public** | 自作コード。`LICENSE`（MIT）を適用（ビルド出力 `dist/` は `.gitignore` 除外） |
| シナリオ・仕様書・台本（`static/data/scenario.json`, `docs/`, `README.md`, `CREDITS.md`, `AGENTS.md`, `LICENSE`） | **Public** | 実在の学校名・団体名・個人情報を含まないことを確認済み |
| 自作画像（`static/images/`, `img_background/`, `img_character/`） | **Public** | メタデータ（Exif / PNG チャンク）に個人情報・GPS・生成プロンプトが含まれないことを確認済み |
| DOVA-SYNDROME 音源（元音源・加工済み `title.mp3`, `corridor.mp3`, `eternal-earth.mp3`, `star-remnants.mp3`, `bubble.mp3`） | **Private** | 単体再配布および容易な複製可能状態での公開が禁止されているため Public 同梱不可 |
| 効果音ラボ音源（元音源・配信用 `decision.mp3`, `cancel.mp3`, `footsteps.mp3`） | **Private** | ゲーム組み込み配信は許可されているが、Public リポジトリ同梱による単体取得可能状態を避けるため分離 |
| OtoLogic 音源（`metronome.mp3`） | **Private**（運用統一） | CC BY 4.0 のためクレジット表記があれば Public 同梱可能だが、`static/audio/` 全体を Private 管理へ統一してミスを防止 |
| 企画原典（`private/docs/前提.md`, `概要.md`, `詳細.md`） | **Private** | 実在の高校名・OB/OG 団体名・演奏会内部のアンケートメモを含むため非公開管理（内容は変更しない） |

コード側のリポジトリでは、Private の対象（`static/audio/`, `BGM/`, `SE/`, `private/`）を `.gitignore` で除外する。`.gitignore` はまだ追跡していないファイルにしか効かないため、追跡済みのファイルが残っていないことを `git ls-files` で確認する。

## 外部音源ライセンスの確認結果と運用ルール

各配布元の公開規約に基づく整理（確認日：2026年11月21日）である。規約は改定される場合があるため、公開前および音源差し替え時は必ず公式サイトの最新規約を再確認する。

| 配布元 | ライセンス・規約の要点 | 本プロジェクトでの対応 |
| --- | --- | --- |
| **DOVA-SYNDROME**（現 OpenTracks） | ・音源単体の再配布・二次配布は禁止<br>・コンバート等を行わず容易にアクセス・複製できる状態での利用は原則禁止<br>・システム制約により容易にアクセス可能な状態になる場合は、利用規約等で「ゲーム内からの音源抽出・別用途利用の禁止」を明記し遵守を求めることで利用可能 | ・元音源と加工済み音源をすべて音源用の Private リポジトリへ分離<br>・BGM は `scripts/process_dova_audio.sh` で FFmpeg 再エンコード・メタデータ削除を実施<br>・`CREDITS.md` およびタイトル画面のクレジットダイアログに「音源抽出・別用途利用の禁止」を明記 |
| **効果音ラボ** | ・商用・非商用を問わずゲーム組み込み利用は無料、クレジット任意<br>・音声ファイル単体の再配布・直リンク・抜き出し用途での公開は禁止 | ・Public リポジトリへ同梱せず音源用の Private リポジトリへ分離<br>・ゲーム本体の操作音・演出音としてのみ配信 |
| **OtoLogic** | ・CC BY 4.0（適切なクレジット表示とリンクを条件に再配布・加工可） | ・タイトル画面のクレジットダイアログと `CREDITS.md` に `OtoLogic（CC BY 4.0）` と公式サイトリンクを明記 |

## 個人情報・プライバシー・機密情報の管理ルール

Public リポジトリへ追加するすべてのファイルおよびコミット履歴について、以下を徹底する。

### 公開前に必ず排除・確認する項目

- **Git コミット履歴の Author / Committer**：
  - 古い履歴には本名とローカル端末名が記録されており、さらに旧コミットには元音源ファイルおよび端末モデル名の記載が残っている
  - 古い履歴は、旧リポジトリを改名した `yuttei/novel_app_replies_archive` に Private のまま保存し、公開しない
  - Public リポジトリ `yuttei/novel_app_replies` には古い履歴を push せず、作り直した新しい履歴だけを置く
  - Public リポジトリのコミットでは、ハンドル名（`yuttei`）と Gmail アドレスを使用する。このアドレスは Public リポジトリのコミット履歴から誰でも閲覧できる
- **実在の個人名・学校名・団体名・所属**：
  - 企画原典（`前提.md`, `概要.md`, `詳細.md`）は音源用リポジトリの `private/docs/` で管理し、コード側では `.gitignore` により Public リポジトリから除外する
  - 公開ドキュメントおよびコード内に実在の学校名・団体名・本名・個人メールアドレス・電話番号・住所を記載しない
- **ローカル環境情報・シークレット**：
  - ホームディレクトリを含むローカルの絶対パス、端末名、実際の自宅 IP アドレス、API キー、PAT（Personal Access Token）、Cloudflare トークンをリポジトリへ記載しない
  - Cloudflare の認証情報（`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`）は、音源用リポジトリの GitHub Actions の Secrets で管理する
- **画像・音声ファイルのメタデータ**：
  - 新しい画像を追加した際は、Exif 情報（位置情報・カメラ情報・作成者名等）や不要なテキストチャンクが含まれていないことを確認する
  - DOVA-SYNDROME 音源は `-map_metadata -1` でメタデータを除去して配信用ファイルを生成する
