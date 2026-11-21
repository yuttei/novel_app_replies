import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { inflateSync } from "node:zlib";

import type { Scenario, SongCardCompletion } from "../../src/ts/scenario-runtime.ts";
import { skipWithoutPublicAudio, skipWithoutSourceAudio } from "./audio-assets.ts";

/*
 * タイトル画面・本編画面のHTML、ビルド成果物、CSS、画像（PNG透過・ICOサイズ）、
 * 加工済みBGM、開発ドキュメントの整合を確認するテストです。
 */

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

interface PngInfo {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  idatChunks: Buffer[];
}

// 外部画像ライブラリを使わず、PNGのIHDR情報とIDATチャンクを読み取ります。
function parsePng(bytes: Buffer): PngInfo {
  assert.equal(bytes.subarray(0, 8).equals(PNG_SIGNATURE), true, "PNGシグネチャが不正です。");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === "IHDR") {
      width = bytes.readUInt32BE(dataStart);
      height = bytes.readUInt32BE(dataStart + 4);
      bitDepth = bytes[dataStart + 8];
      colorType = bytes[dataStart + 9];
    } else if (type === "IDAT") {
      idatChunks.push(bytes.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4;
  }

  return { width, height, bitDepth, colorType, idatChunks };
}

function paethPredictor(left: number, up: number, upLeft: number): number {
  const initial = left + up - upLeft;
  const distLeft = Math.abs(initial - left);
  const distUp = Math.abs(initial - up);
  const distUpLeft = Math.abs(initial - upLeft);
  if (distLeft <= distUp && distLeft <= distUpLeft) {
    return left;
  }
  if (distUp <= distUpLeft) {
    return up;
  }
  return upLeft;
}

// 8bit RGBA PNGを展開し、四隅のアルファ値（0が完全透明）を取り出します。
function readRgbaCornerAlphas(bytes: Buffer): [number, number, number, number] {
  const png = parsePng(bytes);
  assert.equal(png.bitDepth, 8, "8bit PNGを想定しています。");
  assert.equal(png.colorType, 6, "透過付きRGBA PNGである必要があります。");

  const raw = inflateSync(Buffer.concat(png.idatChunks));
  const bytesPerPixel = 4;
  const stride = png.width * bytesPerPixel;
  const pixels = new Uint8Array(png.height * stride);

  let rawOffset = 0;
  for (let row = 0; row < png.height; row += 1) {
    const filterType = raw[rawOffset];
    rawOffset += 1;
    const rowStart = row * stride;

    for (let column = 0; column < stride; column += 1) {
      const value = raw[rawOffset];
      rawOffset += 1;
      const left = column >= bytesPerPixel ? pixels[rowStart + column - bytesPerPixel] : 0;
      const up = row > 0 ? pixels[rowStart - stride + column] : 0;
      const upLeft =
        row > 0 && column >= bytesPerPixel
          ? pixels[rowStart - stride + column - bytesPerPixel]
          : 0;

      let reconstructed = value;
      if (filterType === 1) {
        reconstructed = (value + left) & 0xff;
      } else if (filterType === 2) {
        reconstructed = (value + up) & 0xff;
      } else if (filterType === 3) {
        reconstructed = (value + ((left + up) >> 1)) & 0xff;
      } else if (filterType === 4) {
        reconstructed = (value + paethPredictor(left, up, upLeft)) & 0xff;
      }
      pixels[rowStart + column] = reconstructed;
    }
  }

  const alphaAt = (x: number, y: number): number => pixels[(y * png.width + x) * 4 + 3];
  return [
    alphaAt(0, 0),
    alphaAt(png.width - 1, 0),
    alphaAt(0, png.height - 1),
    alphaAt(png.width - 1, png.height - 1),
  ];
}

// ICOヘッダから格納されているアイコンサイズ一覧を読み取ります。
function readIcoSizes(bytes: Buffer): Set<string> {
  assert.equal(bytes.readUInt16LE(0), 0);
  assert.equal(bytes.readUInt16LE(2), 1);
  const count = bytes.readUInt16LE(4);
  const sizes = new Set<string>();
  for (let index = 0; index < count; index += 1) {
    const entryOffset = 6 + index * 16;
    const width = bytes[entryOffset] === 0 ? 256 : bytes[entryOffset];
    const height = bytes[entryOffset + 1] === 0 ? 256 : bytes[entryOffset + 1];
    sizes.add(`${width}x${height}`);
  }
  return sizes;
}

test("タイトル画面HTMLに必要な要素とクレジットが含まれること", async () => {
  const html = await readFile("index.html", "utf8");

  assert.ok(html.includes("青春再演劇場"));
  assert.ok(html.includes("リプライズ"));
  assert.ok(html.includes('id="start-button"'));
  assert.ok(html.includes('data-game-url="./game.html"'));
  assert.ok(html.includes('id="title-bgm"'));
  assert.ok(html.includes('id="title-audio-button"'));
  assert.ok(html.includes('id="credits-button"'));
  assert.ok(html.includes('id="credits-dialog"'));
  assert.ok(html.includes("OtoLogic（CC BY 4.0）"));
  assert.ok(html.includes("DOVA-SYNDROME"));
  assert.ok(html.includes("効果音ラボ"));
  assert.ok(
    html.includes(
      "ゲーム内から音源ファイルを抽出し、本ゲームのプレイ以外の用途へ利用・再配布することを禁止します。",
    ),
    "クレジットに音源の抽出・別用途利用の禁止文言がありません。",
  );
  assert.ok(html.includes("tap to start"));
  assert.ok(html.includes('type="module"'));
  assert.ok(html.includes('src="/src/ts/title.ts"'));
});

test("本編画面HTMLが共通背景と構造化シナリオを読み込むこと", async () => {
  const html = await readFile("game.html", "utf8");

  assert.ok(html.includes('id="game-stage"'));
  assert.ok(html.includes('data-scenario-url="./data/scenario.json"'));
  assert.ok(html.includes('data-background-base="./images/background"'));
  assert.ok(html.includes('data-character-base="./images/character/chroko"'));
  assert.ok(html.includes('data-audio-base="./audio"'));
  assert.ok(html.includes('id="background-primary"'));
  assert.ok(html.includes('id="background-secondary"'));
  assert.ok(html.includes('id="scene-camera"'));
  assert.equal(html.split('class="scene-background').length - 1, 2);
  assert.ok(html.includes('id="dialog-box"'));
  assert.ok(html.includes('id="protagonist-dialog"'));
  assert.ok(html.includes('id="character-layer"'));
  assert.ok(html.includes('id="song-card"'));
  assert.equal(html.includes('id="song-advance-hint"'), false);
  assert.ok(html.includes('id="ending-card"'));
  assert.ok(html.includes('id="ending-button"'));
  assert.ok(html.includes("tap to end"));
  assert.ok(html.includes('id="advance-label"'));
  assert.ok(html.includes('id="game-error"'));
  assert.ok(html.includes('src="/src/ts/game.ts"'));
  assert.equal(html.includes("<audio"), false);
});

test("タイトルと本編が用途別のブラウザアイコンを参照し、画像仕様を満たすこと", async () => {
  const iconHrefs = [
    "./images/icons/favicon.ico",
    "./images/icons/favicon-32x32.png",
    "./images/icons/apple-touch-icon-180.png",
    "./images/icons/site-icon-512.png",
  ];
  for (const pageFile of ["index.html", "game.html"]) {
    const html = await readFile(pageFile, "utf8");
    assert.ok(html.includes('rel="apple-touch-icon"'));
    for (const href of iconHrefs) {
      assert.ok(html.includes(href), `${pageFile} に ${href} がありません。`);
    }
  }

  const pngExpectations: readonly [string, number, number][] = [
    ["static/images/icons/favicon-32x32.png", 32, 32],
    ["static/images/icons/apple-touch-icon-180.png", 180, 180],
    ["static/images/icons/site-icon-512.png", 512, 512],
  ];
  for (const [imagePath, expectedWidth, expectedHeight] of pngExpectations) {
    const bytes = await readFile(imagePath);
    const png = parsePng(bytes);
    assert.equal(png.width, expectedWidth);
    assert.equal(png.height, expectedHeight);
    assert.equal(png.colorType, 2, `${imagePath} はRGB PNGである必要があります。`);
  }

  const icoBytes = await readFile("static/images/icons/favicon.ico");
  assert.deepEqual(readIcoSizes(icoBytes), new Set(["16x16", "32x32", "48x48"]));
});

// ビルド出力のファイルが存在し、空でないことを確認します。
async function assertBuiltFiles(outputPaths: readonly string[]): Promise<void> {
  for (const outputPath of outputPaths) {
    const info = await stat(outputPath);
    assert.ok(info.isFile(), `${outputPath} が生成されていません。`);
    assert.ok(info.size > 100, `${outputPath} のサイズが小さすぎます。`);
  }
}

test("ビルド出力distにHTML・CSS・データ・背景・アイコンが揃うこと", async () => {
  await assertBuiltFiles([
    "dist/index.html",
    "dist/game.html",
    "dist/data/scenario.json",
    "dist/css/common.css",
    "dist/css/title.css",
    "dist/css/game.css",
    "dist/images/icons/favicon.ico",
    "dist/images/icons/favicon-32x32.png",
    "dist/images/icons/apple-touch-icon-180.png",
    "dist/images/icons/site-icon-512.png",
    "dist/images/background/underwater_dark.png",
    "dist/images/background/underwater_light.png",
    "dist/images/background/music_room.png",
    "dist/images/background/hole.png",
    "dist/images/background/hole_stage.png",
  ]);
});

// 音源は Private リポジトリで管理するため、未配置の環境ではこの確認だけをスキップします。
test("ビルド出力distに配信用音源が揃うこと", { skip: skipWithoutPublicAudio }, async () => {
  await assertBuiltFiles([
    "dist/audio/se/decision.mp3",
    "dist/audio/se/cancel.mp3",
    "dist/audio/se/bubble.mp3",
    "dist/audio/se/footsteps.mp3",
    "dist/audio/bgm/metronome.mp3",
    "dist/audio/bgm/title.mp3",
    "dist/audio/bgm/corridor.mp3",
    "dist/audio/bgm/eternal-earth.mp3",
    "dist/audio/bgm/star-remnants.mp3",
  ]);
});

// 元音源（BGM/）と配信用音源の両方が必要なため、どちらかが未配置ならスキップします。
// ただし REQUIRE_AUDIO_ASSETS=1 のときは、配信用音源がなければスキップせずに失敗します。
// 元音源は公開ビルドに不要なため、REQUIRE_AUDIO_ASSETS=1 でも BGM/ がなければスキップします。
test("DOVAの配布元MP3をそのままブラウザへ公開していないこと", { skip: skipWithoutSourceAudio }, async () => {
  const pairs: readonly [string, string][] = [
    ["BGM/私は口を閉ざす.mp3", "static/audio/bgm/title.mp3"],
    ["BGM/朝日溢れる回廊_2.mp3", "static/audio/bgm/corridor.mp3"],
    ["BGM/悠久の大地.mp3", "static/audio/bgm/eternal-earth.mp3"],
    ["BGM/星の名残り.mp3", "static/audio/bgm/star-remnants.mp3"],
  ];

  for (const [sourcePath, publicPath] of pairs) {
    const sourceHash = createHash("sha256").update(await readFile(sourcePath)).digest("hex");
    const publicBytes = await readFile(publicPath);
    const publicHash = createHash("sha256").update(publicBytes).digest("hex");
    assert.notEqual(sourceHash, publicHash, `${publicPath} が元音源と一致しています。`);
    assert.ok(publicBytes.length > 100_000);
  }
});

// 加工スクリプト自体は Public リポジトリにあるため、音源の有無に関係なく常に確認します。
test("DOVAのBGMを再エンコードする加工スクリプトが用意されていること", async () => {
  const audioScriptStat = await stat("scripts/process_dova_audio.sh");
  assert.ok((audioScriptStat.mode & 0o100) !== 0, "process_dova_audio.sh に実行権限が必要です。");
  const scriptText = await readFile("scripts/process_dova_audio.sh", "utf8");
  assert.equal(scriptText.split('convert_bgm "BGM/').length - 1, 4);
  assert.ok(scriptText.includes("-map 0:a:0"));
  assert.ok(scriptText.includes("-vn"));
  assert.ok(scriptText.includes("-codec:a libmp3lame"));
});

test("クロコの7種類の表情が透明PNGとして用意されていること", async () => {
  const expressions = ["blush", "default", "grin", "sad", "smile", "smirk", "surprise"];
  for (const expression of expressions) {
    const imagePath = `static/images/character/chroko/chroko_${expression}.png`;
    const bytes = await readFile(imagePath);
    assert.deepEqual(
      readRgbaCornerAlphas(bytes),
      [0, 0, 0, 0],
      `${imagePath} の四隅が透明ではありません。`,
    );
  }
});

test("端末の視差設定でタイトル・本編の演出時間を変えないこと", async () => {
  for (const cssPath of ["static/css/title.css", "static/css/game.css"]) {
    const css = await readFile(cssPath, "utf8");
    assert.equal(css.includes("prefers-reduced-motion"), false);
  }
});

test("共通の16:9枠と、タイトル・本編固有のレイアウトスタイルがあること", async () => {
  const commonCss = await readFile("static/css/common.css", "utf8");
  const titleCss = await readFile("static/css/title.css", "utf8");
  const gameCss = await readFile("static/css/game.css", "utf8");

  assert.ok(commonCss.includes("aspect-ratio: 16 / 9"));
  assert.ok(commonCss.includes("container-type: inline-size"));
  assert.ok(commonCss.includes("@media (min-aspect-ratio: 16 / 9)"));

  for (const selector of [
    ".scene-background.is-active",
    ".protagonist-line.is-selected",
    ".song-card.is-first-song",
    ".scene-camera.is-hesitating",
    ".ending-card.is-content-visible",
    ".game-error",
  ]) {
    assert.ok(gameCss.includes(selector));
  }
  for (const timingVariable of [
    "--protagonist-selection-ms",
    "--hesitation-total-ms",
    "--ending-darken-ms",
    "--ending-text-fade-ms",
  ]) {
    assert.ok(gameCss.includes(timingVariable));
  }

  for (const token of [
    "font-size: 9cqw",
    "font-size: 4.3875cqw",
    "min-width: 20cqw",
    "width: 3.75cqw",
    "width: 2cqw",
    ".start-button:active",
    ".credits-button",
    ".credits-dialog::backdrop",
    "-webkit-tap-highlight-color: transparent",
  ]) {
    assert.ok(titleCss.includes(token));
  }
  assert.equal(titleCss.includes("vmin"), false);
  assert.equal(titleCss.includes("vw"), false);
});

test("曲カード・END設定、タイトルBGM、表情フェードと名前変更演出が保たれていること", async () => {
  const scenario = JSON.parse(await readFile("static/data/scenario.json", "utf8")) as Scenario;
  const songCards = scenario.chapters
    .map((chapter) => chapter.completion)
    .filter((completion): completion is SongCardCompletion => completion.kind === "song-card");
  assert.equal(scenario.version, 2);
  assert.equal(songCards.every((card) => card.advanceMode === "timer"), true);
  assert.deepEqual(
    songCards.map((card) => card.cardVariant),
    ["first", "second", "interlude", "interlude"],
  );
  assert.deepEqual(scenario.chapters.at(-1)?.completion, { kind: "ending" });

  const titleSource = await readFile("src/ts/title.ts", "utf8");
  assert.ok(titleSource.includes("TITLE_BGM_VOLUME = 0.30"));
  assert.ok(titleSource.includes("import { AudioGainController }"));
  assert.ok(titleSource.includes('titleBgmGain.setVolume("title"'));
  assert.ok(titleSource.includes("creditsDialog.showModal()"));
  assert.ok(titleSource.includes("event.stopPropagation()"));

  const gameSource = await readFile("src/ts/game.ts", "utf8");
  const configSource = await readFile("src/ts/game-config.ts", "utf8");
  const gameCss = await readFile("static/css/game.css", "utf8");

  assert.ok(configSource.includes("EXPRESSION_OUTGOING_FADE_DURATION_MS = 600"));
  assert.ok(gameSource.includes('"--expression-outgoing-fade-ms"'));
  assert.ok(gameSource.includes("await preloadCharacterSprite(expression)"));
  assert.ok(gameSource.includes("await wait(EXPRESSION_OUTGOING_FADE_DURATION_MS)"));
  assert.ok(gameSource.includes("await setCharacterExpression(expression, wasHidden)"));
  assert.ok(configSource.includes("NAME_FADE_OUT_DURATION_MS = 500"));
  assert.ok(configSource.includes("NAME_BLANK_HOLD_DURATION_MS = 150"));
  assert.ok(configSource.includes("NAME_FADE_IN_DURATION_MS = 500"));
  assert.ok(gameSource.includes('nameLabel.textContent = "???"'));
  assert.ok(gameSource.includes('nameLabel.textContent = ""'));
  assert.ok(gameSource.includes('nameLabel.textContent = "クロコ"'));
  assert.ok(gameSource.includes('speakerName.classList.add("is-name-fade-out")'));
  assert.ok(gameSource.includes('speakerName.classList.add("is-name-fade-in")'));
  assert.ok(gameCss.includes(".character-sprite.is-rear"));
  assert.ok(gameCss.includes(".character-sprite.is-front.is-fading-out"));
  assert.ok(gameCss.includes(".speaker-name__label--incoming"));
  assert.ok(gameCss.includes(".speaker-name.is-name-fade-out"));
  assert.ok(gameCss.includes(".speaker-name.is-name-fade-in"));
  assert.equal(gameSource.includes("is-name-crossfade"), false);
  assert.equal(gameCss.includes("is-name-crossfade"), false);
  assert.ok(gameCss.includes("opacity var(--expression-outgoing-fade-ms)"));
  assert.ok(gameCss.includes("cubic-bezier(0.4, 0, 0.2, 1)"));
  assert.equal(gameCss.includes("opacity 280ms"), false);
});

test("同じWi-Fiのスマートフォンから確認する起動手順が開発ドキュメントにあること", async () => {
  const readme = await readFile("README.md", "utf8");
  const developmentDoc = await readFile("docs/development.md", "utf8");

  assert.ok(readme.includes("docs/development.md"));
  assert.ok(developmentDoc.includes("npm run dev:lan"));
  assert.ok(developmentDoc.includes("ipconfig getifaddr en0"));
  assert.ok(developmentDoc.includes("`127.0.0.1`はスマートフォン自身"));
});
