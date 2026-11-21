# クレジットと素材利用条件

このファイルには、本作品で使用する音源・画像などの制作者、配布元、利用条件、およびリポジトリ上の管理方針を記録する。

利用条件の最終確認日：2026年11月21日（音源配布元の初回確認日：2026年7月15日）

## 利用者へのお願い（音源の抽出・二次利用の禁止）

本ゲームで使用している外部音源素材の著作権は、各制作者および配布元に帰属する。公開版の Web ゲーム内から音源ファイルを抽出し、本ゲームのプレイ以外の用途へ利用・再配布することを禁止する。

## 外部音源素材

外部音源のファイル（`static/audio/` の配信用音源と、`BGM/`・`SE/` の元音源）は Public リポジトリ `yuttei/novel_app_replies` では管理せず、音源用の Private リポジトリ `yuttei/novel_app_replies_assets` で管理し、デプロイ時だけコードと組み合わせる（管理の基準は [docs/assets-policy.md](docs/assets-policy.md)、リポジトリの構成は [docs/deployment.md](docs/deployment.md#リポジトリ構成) を参照）。

### DOVA-SYNDROME（現 OpenTracks）

DOVA-SYNDROME の音源利用ライセンスに基づき、Web ゲームの背景音・効果音として使用する。クレジット表記は必須ではないが、制作者が分かるようタイトル画面のクレジットダイアログにも表示する。

| ゲーム内の用途 | 素材名 | 制作者 | 配布ページ | 公開用ファイル名 |
| --- | --- | --- | --- | --- |
| タイトル BGM | 私は口を閉ざす | のる | https://dova-s.jp/bgm/detail/19087 | `static/audio/bgm/title.mp3` |
| 朝日 BGM | 朝日溢れる回廊 | 畑中ゆう | https://dova-s.jp/bgm/detail/14149 | `static/audio/bgm/corridor.mp3` |
| 選択後の BGM | 悠久の大地 | 田中芳典 | https://dova-s.jp/bgm/detail/12925 | `static/audio/bgm/eternal-earth.mp3` |
| 終盤 BGM | 星の名残り | のる | https://dova-s.jp/bgm/detail/20908 | `static/audio/bgm/star-remnants.mp3` |
| 水中切り替え SE | 水の底から湧き出す泡の音 | Hupple | https://dova-s.jp/se/detail/1511 | `static/audio/se/bubble.mp3` |

- 音源利用ライセンス：https://dova-s.jp/contents/license
- Public リポジトリへの同梱：不可（元音源・加工済み音源ともに音源用の Private リポジトリで管理）
- 加工方針：
  - 公開用の DOVA BGM は FFmpeg で再エンコード・メタデータ削除を行い、配布元ファイルそのものを公開しない
  - 泡 SE は Logic Pro で編集・書き出した加工済み音源を使用する
- Web ゲーム配信時の対応：音源ファイルの抽出および別用途利用を禁止する旨を、タイトル画面のクレジットダイアログ下部「音源の利用について」に明記済み

### OtoLogic

- 素材名：メトロノーム01-06（クリック・ループ・遅）
- 配布ページ：https://otologic.jp/free/se/instruments01.html
- ライセンス：https://otologic.jp/free/license（CC BY 4.0）
- 公開用ファイル名：`static/audio/bgm/metronome.mp3`
- 必須表示：`音源：OtoLogic（CC BY 4.0）` および公式サイトへのリンク（タイトル画面のクレジットダイアログに表示済み）
- Public リポジトリへの同梱：CC BY 4.0 に基づき表記条件を満たせば可能だが、音声素材の運用統一のため `static/audio/` 全体を音源用の Private リポジトリで管理する

### 効果音ラボ

| ゲーム内の用途 | 素材名 | 配布ページ | 公開用ファイル名 |
| --- | --- | --- | --- |
| 決定 SE | 決定ボタンを押す33 | https://soundeffect-lab.info/sound/button/ | `static/audio/se/decision.mp3` |
| キャンセル SE | キャンセル3 | https://soundeffect-lab.info/sound/button/ | `static/audio/se/cancel.mp3` |
| 革靴 SE | 革靴で歩く | https://soundeffect-lab.info/sound/various/ | `static/audio/se/footsteps.mp3` |

- 利用規約：https://soundeffect-lab.info/agreement/
- ゲームへの組み込みは許可されており、クレジット表記は任意（タイトル画面のクレジットダイアログへ表示済み）
- Public リポジトリへの同梱：不可（単体再配布にあたるリスクを避けるため音源用の Private リポジトリで管理）
- 3ファイルは 2026年7月15日 に公式配布ファイルとの SHA-256 一致を確認済み

## 自作素材・コード・台本

- ソースコード（HTML / CSS / TypeScript）、シナリオデータ（`static/data/scenario.json`）、台本（[docs/specs/script.md](docs/specs/script.md)）、および背景・立ち絵・アイコン画像は制作者（yuttei）の著作物であり、[LICENSE](LICENSE)（MIT License）の適用対象とする
- 外部フォントおよび外部 JavaScript ライブラリは使用していない
