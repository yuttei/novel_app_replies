import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import type { Scenario, ScenarioEntry, SongCardCompletion } from "../../src/ts/scenario-runtime.ts";
import { skipWithoutPublicAudio } from "./audio-assets.ts";

/*
 * static/data/scenario.json の構造、画面分割、登録素材、
 * 後半で指定された表情・BGM・暗転・最終演出の位置を確認するテストです。
 */

const SCENARIO_PATH = "static/data/scenario.json";
const scenario = JSON.parse(await readFile(SCENARIO_PATH, "utf8")) as Scenario;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

test("画面分割した文章を連結すると、必ず原文へ戻ること", () => {
  for (const chapter of scenario.chapters) {
    for (const [index, entry] of chapter.entries.entries()) {
      if (entry.kind === "dialogue") {
        const pages = entry.pages ?? [entry.sourceText];
        assert.equal(
          pages.join(""),
          entry.sourceText,
          `${chapter.id} の ${index + 1} 番目で pages が原文と一致しません。`,
        );
      } else {
        const linePages = entry.linePages ?? [entry.lines ?? []];
        const joined = linePages.flat().join("");
        assert.equal(
          joined,
          entry.sourceText,
          `${chapter.id} の ${index + 1} 番目で主人公台詞が原文と一致しません。`,
        );
        for (const page of linePages) {
          assert.ok(page.length <= 2, `${chapter.id} の ${index + 1} 番目が 3 行以上です。`);
        }
      }
    }
  }
});

test("表示名が変わっても同一人物を判定できるspeakerIdがあること", () => {
  for (const chapter of scenario.chapters) {
    for (const entry of chapter.entries) {
      if (entry.kind !== "dialogue") {
        continue;
      }
      if (entry.speaker === null) {
        assert.equal(entry.speakerId, undefined);
      } else {
        assert.equal(typeof entry.speakerId, "string");
        assert.ok((entry.speakerId ?? "").length > 0);
      }
    }
  }
});

test("JSONへ登録した背景の実ファイルが存在すること", async () => {
  for (const filename of Object.values(scenario.assets.backgrounds)) {
    const targetPath = join("static/images/background", filename);
    assert.equal(await fileExists(targetPath), true, `背景が見つかりません: ${targetPath}`);
  }
});

// 音源は Private リポジトリで管理するため、未配置の環境ではこの確認だけをスキップします。
test("JSONへ登録した音源の実ファイルが存在すること", { skip: skipWithoutPublicAudio }, async () => {
  for (const definition of Object.values(scenario.assets.audio)) {
    const targetPath = join("static/audio", definition.path);
    assert.equal(await fileExists(targetPath), true, `音源が見つかりません: ${targetPath}`);
  }
});

test("本編プレイヤーが使用する音源IDを削除していないこと", () => {
  const requiredAudioIds = [
    "bubble",
    "cancel",
    "decision",
    "footsteps",
    "metronome",
    "corridor",
    "eternal-earth",
    "star-remnants",
  ];
  for (const audioId of requiredAudioIds) {
    assert.ok(
      Object.hasOwn(scenario.assets.audio, audioId),
      `必須音源ID「${audioId}」がありません。`,
    );
  }
});

test("同じ章IDを誤って2回登録していないこと", () => {
  const chapterIds = scenario.chapters.map((chapter) => chapter.id);
  assert.equal(chapterIds.length, new Set(chapterIds).size);
  assert.ok(chapterIds.includes(scenario.startChapter));
});

test("後半で指定された表情、BGM、暗転、最終演出の位置を保っていること", () => {
  const chapters = new Map(scenario.chapters.map((chapter) => [chapter.id, chapter]));
  const songCards = scenario.chapters
    .map((chapter) => chapter.completion)
    .filter((completion): completion is SongCardCompletion => completion.kind === "song-card");

  assert.equal(songCards.every((card) => card.advanceMode === "timer"), true);
  assert.equal(songCards.every((card) => card.durationMs === 5000), true);
  assert.equal(songCards.every((card) => card.transition === "dark-song-interlude"), true);
  assert.deepEqual(
    songCards.map((card) => card.darkenDurationMs),
    [1500, 1500, 1500, 12000],
  );
  assert.deepEqual(
    songCards.map((card) => card.fadeOutAudio),
    ["metronome", "corridor", "corridor", "eternal-earth"],
  );

  const afterSecond = chapters.get("after-second-song");
  const afterThirdChapter = chapters.get("after-third-song");
  const afterThirdPartChapter = chapters.get("after-third-part");
  const afterFirstChapter = chapters.get("after-first-song");
  assert.ok(afterSecond && afterThirdChapter && afterThirdPartChapter && afterFirstChapter);

  assert.equal(afterSecond.completion.kind, "song-card");
  assert.equal(afterThirdChapter.completion.kind, "song-card");
  if (afterSecond.completion.kind === "song-card") {
    assert.equal(afterSecond.completion.transition, "dark-song-interlude");
    assert.equal(afterSecond.completion.darkenDurationMs, 1500);
    assert.equal(afterSecond.completion.fadeOutAudio, "corridor");
  }
  if (afterThirdChapter.completion.kind === "song-card") {
    assert.equal(afterThirdChapter.completion.transition, "dark-song-interlude");
    assert.equal(afterThirdChapter.completion.darkenDurationMs, 12000);
    assert.equal(afterThirdChapter.completion.fadeOutAudio, "eternal-earth");
  }

  const entryByText = (entries: readonly ScenarioEntry[]): Map<string, ScenarioEntry> =>
    new Map(entries.map((entry) => [entry.sourceText, entry]));

  const afterThird = entryByText(afterThirdChapter.entries);
  assert.equal(afterThird.get("え？")?.character, undefined);
  assert.equal(afterThird.get("いいや、過去には留まらない。")?.selectEffects, undefined);
  assert.equal(
    afterThird.get(
      "このまま過去に留まりましょう。ここなら、好きな時間を何度でも再演できます。終わってしまった舞台も、離れてしまった仲間との時間も、望むかぎり続けられます",
    )?.character,
    "smirk",
  );
  assert.equal(afterThird.get("ずっと、ここに……")?.character, "smirk");
  assert.equal(
    afterThird.get("迷う必要はありません。あなたは、ここで確かに幸せだったのですから")?.character,
    "default",
  );
  assert.deepEqual(
    afterThird.get("迷う必要はありません。あなたは、ここで確かに幸せだったのですから")?.enterEffects,
    ["hesitation-zoom-shake"],
  );
  assert.equal(afterThird.get("だって、")?.character, "default");
  assert.deepEqual(
    afterThird.get("あの時も前に進んでたから。")?.selectEffects,
    ["start-eternal-earth-bgm", "set-character-surprise"],
  );
  assert.equal(afterThird.get("あの時も前に進んでたから。")?.character, "default");
  assert.equal(
    afterThirdChapter.entries.every((entry) => entry.background === "hall"),
    true,
  );
  assert.deepEqual(afterThirdChapter.entries[0].enterEffects, ["start-corridor-bgm"]);
  assert.deepEqual(
    afterThird.get("でしたら、もう帰る必要はありません")?.completeEffects,
    ["stop-corridor-bgm"],
  );

  const presentLine = afterThird.get("それに——『現在（いま）も楽しいってところを見せてあげる！』");
  assert.equal(presentLine?.kind, "protagonist");
  if (presentLine?.kind === "protagonist") {
    assert.deepEqual(presentLine.linePages, [
      ["それに——"],
      ["『現在（いま）も楽しいってところを見せてあげる！』"],
    ]);
    assert.deepEqual(presentLine.selectEffects, ["set-character-grin"]);
  }

  const afterPart = entryByText(afterThirdPartChapter.entries);
  assert.equal(
    afterThirdPartChapter.entries.every((entry) => entry.background === "hall-stage"),
    true,
  );
  assert.deepEqual(
    afterPart.get("どうだった？　現在の舞台も楽しかったでしょ")?.selectEffects,
    ["start-corridor-bgm"],
  );
  assert.deepEqual(afterPart.get("大丈夫だよ！")?.selectEffects, ["start-star-remnants-bgm"]);
  assert.deepEqual(
    afterPart.get("時間はそこに在るだけでいい。")?.selectEffects,
    ["hold-before-next-line"],
  );
  assert.equal(
    afterPart.get("なかなかの解釈ですね。もちろんわかっていましたよ。よく考えれば当然のことです。")
      ?.character,
    "blush",
  );
  assert.equal(afterPart.get("仕方ないですね")?.character, "smirk");
  assert.deepEqual(afterPart.get("仕方ないですね")?.enterEffects, ["final-dialog-pause"]);
  assert.deepEqual(
    afterPart.get("人類の未来は、この私にお任せください！")?.enterEffects,
    ["final-camera-zoom"],
  );

  const namingLine = entryByText(afterFirstChapter.entries).get(
    "急に責任が重い。うーん……じゃあ、クロコ",
  );
  assert.equal(namingLine?.kind, "protagonist");
  if (namingLine?.kind === "protagonist") {
    assert.deepEqual(namingLine.linePages, [
      ["急に責任が重い。"],
      ["うーん……"],
      ["じゃあ、クロコ"],
    ]);
  }
});
