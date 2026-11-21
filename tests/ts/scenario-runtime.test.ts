import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createScenarioRuntime,
  getViewSpeakerIdentity,
  shouldFadeMainDialog,
  validateScenario,
} from "../../src/ts/scenario-runtime.ts";
import type {
  AdvanceResult,
  ChapterCompletion,
  ProtagonistView,
  Scenario,
  ScenarioView,
  SongCardCompletion,
  SpeakerIdentityTarget,
} from "../../src/ts/scenario-runtime.ts";

const scenarioUrl = new URL("../../static/data/scenario.json", import.meta.url);
const scenario = JSON.parse(await readFile(scenarioUrl, "utf8")) as Scenario;

function scenarioStartingAt(chapterId: string): Scenario {
  const laterScenario = structuredClone(scenario);
  const startIndex = laterScenario.chapters.findIndex((chapter) => chapter.id === chapterId);
  laterScenario.startChapter = chapterId;
  laterScenario.chapters = laterScenario.chapters.slice(startIndex);
  return laterScenario;
}

// 不正データの検証テスト用に、意図的に型制約を外した複製を作ります。
function cloneMutableScenario(): any {
  return structuredClone(scenario);
}

function expectViewResult(result: AdvanceResult): ScenarioView {
  if (result.type !== "view") {
    assert.fail(`view結果が必要ですが ${result.type} でした。`);
  }
  return result.view;
}

function expectProtagonistView(view: ScenarioView): ProtagonistView {
  if (view.kind !== "protagonist") {
    assert.fail(`主人公台詞が必要ですが ${view.kind} でした。`);
  }
  return view;
}

function expectSongCardCompletion(completion: Readonly<ChapterCompletion>): Readonly<SongCardCompletion> {
  if (completion.kind !== "song-card") {
    assert.fail(`song-cardが必要ですが ${completion.kind} でした。`);
  }
  return completion;
}

test("現在のscenario.jsonを検証できる", () => {
  assert.equal(validateScenario(scenario), scenario);
});

test("冒頭の原文を10画面へ分けてから1曲目カードへ進む", () => {
  const runtime = createScenarioRuntime(scenario);
  const views: ScenarioView[] = [runtime.getCurrentView()];
  let result: AdvanceResult;

  while (true) {
    result = runtime.advance();
    if (result.type === "completion") {
      break;
    }
    views.push(result.view);
  }

  assert.equal(views.length, 10);
  assert.equal(views[0].text, "夢見るままに、過去を体験したいと思ったことはありませんか？");
  assert.equal(views[7].text, "チクタク、チクタク、メトロノームが時を刻んでいる。");
  const completion = expectSongCardCompletion(result.completion);
  assert.equal(completion.title, "基礎練・ダイジェスト");
  assert.equal(completion.advanceMode, "timer");
});

test("1曲目カードの後は1曲目後の最初の主人公台詞へ進む", () => {
  const runtime = createScenarioRuntime(scenario);
  let result: AdvanceResult;
  do {
    result = runtime.advance();
  } while (result.type !== "completion");

  const nextView = expectProtagonistView(runtime.enterNextChapter());
  assert.equal(runtime.getCurrentChapterId(), "after-first-song");
  assert.equal(nextView.lines.length, 2);
});

test("1曲目後を最後まで進めると5秒で自動進行する2曲目カードになる", () => {
  const runtime = createScenarioRuntime(scenario);
  let result: AdvanceResult;
  do {
    result = runtime.advance();
  } while (result.type !== "completion");
  runtime.enterNextChapter();
  do {
    result = runtime.advance();
  } while (result.type !== "completion");

  const completion = expectSongCardCompletion(result.completion);
  assert.equal(completion.title, "過去の音楽劇メドレー");
  assert.equal(completion.advanceMode, "timer");
  assert.equal(completion.durationMs, 5000);
  assert.equal(runtime.enterNextChapter().chapterId, "after-second-song");
});

test("2曲目から第3部を経て最後のENDまで順番に進む", () => {
  const runtime = createScenarioRuntime(scenario);
  const completions: Readonly<ChapterCompletion>[] = [];

  while (true) {
    let result: AdvanceResult;
    do {
      result = runtime.advance();
    } while (result.type !== "completion");
    completions.push(result.completion);
    if (result.completion.kind === "ending") {
      break;
    }
    runtime.enterNextChapter();
  }

  assert.deepEqual(
    completions.map((completion) => (completion.kind === "ending" ? "END" : completion.title)),
    ["基礎練・ダイジェスト", "過去の音楽劇メドレー", "宝島", "ポップスステージ", "END"],
  );
  assert.deepEqual(
    completions
      .slice(1, 4)
      .map((completion) => (completion.kind === "song-card" ? completion.advanceMode : null)),
    ["timer", "timer", "timer"],
  );
  assert.throws(() => runtime.enterNextChapter(), /先には進めません/);
});

test("未知の演出IDは開始前に拒否する", () => {
  const invalidScenario = cloneMutableScenario();
  invalidScenario.chapters[0].entries[0].enterEffects = ["unknown-effect"];
  assert.throws(() => validateScenario(invalidScenario), /使えない演出/);
});

test("演出IDを誤ったタイミングへ指定した場合も拒否する", () => {
  const invalidScenario = cloneMutableScenario();
  invalidScenario.chapters[0].entries[0].selectEffects = ["water-transition"];
  assert.throws(() => validateScenario(invalidScenario), /selectEffectsでは使えない/);

  const invalidHoldPosition = cloneMutableScenario();
  invalidHoldPosition.chapters[0].entries[0].enterEffects = ["hold-before-next-line"];
  assert.throws(() => validateScenario(invalidHoldPosition), /enterEffectsでは使えない/);
});

test("主人公の台詞ボックスが3個以上なら拒否する", () => {
  const invalidScenario = cloneMutableScenario();
  const protagonist = invalidScenario.chapters[1].entries[0];
  protagonist.lines = ["一", "二", "三"];
  protagonist.sourceText = "一二三";
  assert.throws(() => validateScenario(invalidScenario), /1個または2個/);
});

test("主人公の4つの台詞を2個ずつ2画面で表示できる", () => {
  const laterScenario = scenarioStartingAt("after-second-song");
  const runtime = createScenarioRuntime(laterScenario);

  const firstView = expectProtagonistView(runtime.getCurrentView());
  assert.deepEqual(firstView.lines, ["ああ、これも懐かしい。", "曲だけじゃない。"]);
  const secondView = expectProtagonistView(expectViewResult(runtime.advance()));
  assert.deepEqual(secondView.lines, [
    "練習して、衣装を用意して、",
    "みんなで一つの舞台を作ったことまで思い出したよ",
  ]);
});

test("名前を決める台詞を原文どおり3画面で表示できる", () => {
  const laterScenario = scenarioStartingAt("after-first-song");
  const runtime = createScenarioRuntime(laterScenario);
  let view = runtime.getCurrentView();

  while (view.sourceText !== "急に責任が重い。うーん……じゃあ、クロコ") {
    view = expectViewResult(runtime.advance());
  }

  assert.deepEqual(expectProtagonistView(view).lines, ["急に責任が重い。"]);
  assert.deepEqual(expectProtagonistView(expectViewResult(runtime.advance())).lines, ["うーん……"]);
  assert.deepEqual(expectProtagonistView(expectViewResult(runtime.advance())).lines, ["じゃあ、クロコ"]);
});

test("複数ページの選択演出は最後の台詞を選んだ後だけ実行する", () => {
  const laterScenario = scenarioStartingAt("after-third-song");
  const runtime = createScenarioRuntime(laterScenario);
  let view = runtime.getCurrentView();
  const target = "それに——『現在（いま）も楽しいってところを見せてあげる！』";

  while (view.sourceText !== target) {
    view = expectViewResult(runtime.advance());
  }

  const firstPage = expectProtagonistView(view);
  assert.deepEqual(firstPage.lines, ["それに——"]);
  assert.deepEqual(firstPage.selectEffects, []);
  const lastPage = expectProtagonistView(expectViewResult(runtime.advance()));
  assert.deepEqual(lastPage.lines, ["『現在（いま）も楽しいってところを見せてあげる！』"]);
  assert.deepEqual(lastPage.selectEffects, ["set-character-grin"]);
});

test("廃止した入力進行と不正な音源指定を開始前に拒否する", () => {
  const manualAdvance = cloneMutableScenario();
  manualAdvance.chapters[1].completion.advanceMode = "timer-or-input";
  assert.throws(() => validateScenario(manualAdvance), /advanceModeが不正/);

  const unknownAudio = cloneMutableScenario();
  unknownAudio.chapters[3].completion.fadeOutAudio = "unknown-audio";
  assert.throws(() => validateScenario(unknownAudio), /fadeOutAudio/);

  const invalidDarkenDuration = cloneMutableScenario();
  invalidDarkenDuration.chapters[3].completion.darkenDurationMs = 0;
  assert.throws(() => validateScenario(invalidDarkenDuration), /darkenDurationMs/);

  const retiredTransition = cloneMutableScenario();
  retiredTransition.chapters[1].completion.transition = "second-song-reveal";
  assert.throws(() => validateScenario(retiredTransition), /transitionが不正/);
});

test("主人公以外への文字色指定と未知の文字色を拒否する", () => {
  const dialogueTone = cloneMutableScenario();
  dialogueTone.chapters[0].entries[0].textTone = "red";
  assert.throws(() => validateScenario(dialogueTone), /主人公の台詞だけ/);

  const unknownTone = cloneMutableScenario();
  unknownTone.chapters[1].entries[0].textTone = "blue";
  assert.throws(() => validateScenario(unknownTone), /textTone/);
});

test("未知の章終了形式を拒否する", () => {
  const invalidScenario = cloneMutableScenario();
  invalidScenario.chapters.at(-1).completion.kind = "unknown";
  assert.throws(() => validateScenario(invalidScenario), /completionが不正/);
});

test("通常台詞の選択演出と重複演出を拒否する", () => {
  const dialogueSelection = cloneMutableScenario();
  dialogueSelection.chapters[0].entries[0].selectEffects = ["start-corridor-bgm"];
  assert.throws(() => validateScenario(dialogueSelection), /主人公台詞だけ/);

  const duplicateEffect = cloneMutableScenario();
  duplicateEffect.chapters[0].entries[0].enterEffects = [
    "water-transition",
    "water-transition",
  ];
  assert.throws(() => validateScenario(duplicateEffect), /重複/);
});

test("循環、到達不能章、複数ENDを開始前に拒否する", () => {
  const cycle = cloneMutableScenario();
  cycle.chapters.at(-2).completion.nextChapter = cycle.startChapter;
  assert.throws(() => validateScenario(cycle), /循環/);

  const unreachable = cloneMutableScenario();
  const unusedChapter = structuredClone(unreachable.chapters[0]);
  unusedChapter.id = "unused";
  unusedChapter.completion.nextChapter = "after-first-song";
  unreachable.chapters.splice(1, 0, unusedChapter);
  assert.throws(() => validateScenario(unreachable), /到達できない章/);

  const multipleEndings = cloneMutableScenario();
  multipleEndings.chapters.splice(1, 0, {
    id: "other-ending",
    entries: [structuredClone(multipleEndings.chapters[0].entries[0])],
    completion: { kind: "ending" },
  });
  assert.throws(() => validateScenario(multipleEndings), /endingの章は1つ/);

  const invalidKind = cloneMutableScenario();
  invalidKind.assets.audio.corridor.kind = "music";
  assert.throws(() => validateScenario(invalidKind), /kindはbgmまたはse/);
});

test("発話台詞にspeakerIdがなければ開始前に拒否する", () => {
  const invalidScenario = cloneMutableScenario();
  delete invalidScenario.chapters[0].entries[0].speakerId;
  assert.throws(() => validateScenario(invalidScenario), /発話台詞にspeakerIdがありません/);
});

test("同じ話者と地の文の続きではメインボックスを切り替えない", () => {
  const chrokoUnknown: SpeakerIdentityTarget = {
    kind: "dialogue",
    speaker: "???",
    speakerId: "chroko",
  };
  const chrokoNamed: SpeakerIdentityTarget = {
    kind: "dialogue",
    speaker: "クロコ",
    speakerId: "chroko",
  };
  const narration: SpeakerIdentityTarget = { kind: "dialogue", speaker: null };

  assert.equal(getViewSpeakerIdentity(chrokoUnknown), "speaker:chroko");
  assert.equal(getViewSpeakerIdentity(narration), "narration");
  assert.equal(shouldFadeMainDialog(chrokoUnknown, chrokoNamed), false);
  assert.equal(shouldFadeMainDialog(narration, narration), false);
});

test("人物交代と主人公ボックスへの切り替えではメインボックスを切り替える", () => {
  const chroko: SpeakerIdentityTarget = {
    kind: "dialogue",
    speaker: "クロコ",
    speakerId: "chroko",
  };
  const anotherPerson: SpeakerIdentityTarget = {
    kind: "dialogue",
    speaker: "別の人物",
    speakerId: "another",
  };
  const narration: SpeakerIdentityTarget = { kind: "dialogue", speaker: null };
  const protagonist: SpeakerIdentityTarget = { kind: "protagonist" };

  assert.equal(shouldFadeMainDialog(chroko, anotherPerson), true);
  assert.equal(shouldFadeMainDialog(narration, chroko), true);
  assert.equal(shouldFadeMainDialog(chroko, protagonist), true);
  assert.equal(shouldFadeMainDialog(protagonist, chroko), true);
  assert.equal(
    shouldFadeMainDialog(chroko, { ...chroko, forceDialogTransition: true }),
    true,
  );
});
