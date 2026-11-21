import { access } from "node:fs/promises";

/*
 * 外部音源（Private リポジトリで管理する素材）がローカルに置かれているかを判定し、
 * 音源が必要なテストを「実行する」か「理由を付けてスキップする」かを決める共通処理です。
 *
 * 音源は次の2種類があり、扱いが異なります。
 * - 配信用音源（static/audio/）：公開ビルドに含める音源です。
 * - DOVA の元音源（BGM/）：音源を加工する人の手元にだけある素材で、公開ビルドには使いません。
 *
 * 動きは次のとおりです。
 * - Public リポジトリだけをクローンした環境では音源がないため、音源の確認だけをスキップします。
 * - 公開用のビルド（Private 側のデプロイ）では、配信用音源の配置漏れを見逃さないよう、
 *   環境変数 REQUIRE_AUDIO_ASSETS=1 を付けて実行します。このとき static/audio/ が欠けていても
 *   スキップせず、テストを失敗させます。
 * - 元音源（BGM/）はデプロイ環境に置かないため、REQUIRE_AUDIO_ASSETS=1 のときでも、
 *   BGM/ がなければ元音源との比較テストだけを理由付きでスキップします。
 * - REQUIRE_AUDIO_ASSETS に 1 以外の値（true、yes など）を指定した場合は、
 *   指定ミスに気づけるよう、エラーにしてテストの読み込みを止めます。
 */

// 配信用音源（static/audio/）と DOVA の元音源（BGM/）の置き場所です。
const PUBLIC_AUDIO_DIR = "static/audio";
const SOURCE_BGM_DIR = "BGM";

/*
 * 環境変数 REQUIRE_AUDIO_ASSETS を読み取り、配信用音源を必須にするかどうかを返します。
 * - 未設定または空文字：必須にしない（false）
 * - "1"：必須にする（true）
 * - それ以外の値：例外を投げます。たとえば "true" を「有効」のつもりで指定しても
 *   黙って無視されると、音源の配置漏れを見逃したままデプロイしてしまうためです。
 */
function readAudioAssetsRequired(): boolean {
  const value = process.env.REQUIRE_AUDIO_ASSETS;
  if (value === undefined || value === "") {
    return false;
  }
  if (value === "1") {
    return true;
  }
  throw new Error(`REQUIRE_AUDIO_ASSETS には 1 だけを指定できます（指定された値：${value}）`);
}

// 公開用ビルドなど、配信用音源が必ずそろっているべき実行かどうかを表します。
const publicAudioRequired = readAudioAssetsRequired();

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/*
 * node:test の skip オプションへそのまま渡せる値を作ります。
 * missing（未配置のフォルダ一覧）が空なら false を返してテストを実行し、
 * 空でなければ、スキップの理由となる文字列を返します。
 */
function toSkipOption(missing: readonly string[]): false | string {
  if (missing.length === 0) {
    return false;
  }
  return `${missing.join("、")} が未配置のため音源の確認をスキップしました（配置すると実行されます）`;
}

/*
 * 未配置のフォルダを調べて「フォルダ名/」の形で一覧にします。
 * フォルダ自体が存在する場合は「配置済み」とみなして実行するため、
 * 一部のファイルだけが欠けているときはスキップされずに失敗します。
 */
async function findMissingDirectories(directories: readonly string[]): Promise<string[]> {
  const missing: string[] = [];
  for (const directory of directories) {
    if (!(await pathExists(directory))) {
      missing.push(`${directory}/`);
    }
  }
  return missing;
}

/*
 * 配信用音源（static/audio/）を使うテストのスキップ判定です。
 * REQUIRE_AUDIO_ASSETS=1 のときは、未配置でもスキップせずに実行して失敗させます。
 */
async function decideSkipWithoutPublicAudio(): Promise<false | string> {
  if (publicAudioRequired) {
    return false;
  }
  const missing = await findMissingDirectories([PUBLIC_AUDIO_DIR]);
  return toSkipOption(missing);
}

/*
 * 配信用音源と DOVA の元音源（BGM/）の両方を使うテストのスキップ判定です。
 * - static/audio/ は、REQUIRE_AUDIO_ASSETS=1 のときだけ必須として扱います。
 * - BGM/ は公開ビルドに不要な素材のため、REQUIRE_AUDIO_ASSETS=1 のときでも、
 *   なければスキップします。
 */
async function decideSkipWithoutSourceAudio(): Promise<false | string> {
  const directoriesToCheck: string[] = [];
  if (!publicAudioRequired) {
    directoriesToCheck.push(PUBLIC_AUDIO_DIR);
  }
  directoriesToCheck.push(SOURCE_BGM_DIR);
  const missing = await findMissingDirectories(directoriesToCheck);
  return toSkipOption(missing);
}

// 配信用音源（static/audio/）を使うテストのスキップ判定です。
export const skipWithoutPublicAudio = await decideSkipWithoutPublicAudio();

// 配信用音源に加え、DOVA の元音源（BGM/）も使うテストのスキップ判定です。
export const skipWithoutSourceAudio = await decideSkipWithoutSourceAudio();
