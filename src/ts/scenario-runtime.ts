/*
 * シナリオの順番だけを扱う、小さな再生エンジンです。
 * HTMLや音声には触れないため、ブラウザを起動しなくてもテストできます。
 */

import {
  EFFECT_PHASES,
  getEffectDefinition,
  getRequiredAudioIds,
} from "./scenario-effects.ts";
import type { EffectId, EffectPhase } from "./scenario-effects.ts";

export type EntryKind = "dialogue" | "protagonist";
export type TextTone = "default" | "red";
export type CardVariant = "first" | "second" | "interlude";
export type AdvanceMode = "timer";
export type TransitionKind = "dark-song-interlude";

export interface ScenarioAudioAsset {
  kind: "bgm" | "se";
  path: string;
  loop?: boolean;
  volume?: number;
}

export interface ScenarioAssets {
  backgrounds: Record<string, string>;
  characterExpressions: string[];
  audio: Record<string, ScenarioAudioAsset>;
}

interface BaseEntry {
  sourceText: string;
  background: string;
  character?: string;
  forceDialogTransition?: boolean;
  enterEffects?: EffectId[];
  completeEffects?: EffectId[];
}

export interface DialogueEntry extends BaseEntry {
  kind: "dialogue";
  speaker: string | null;
  speakerId?: string;
  pages?: string[];
  selectEffects?: undefined;
  textTone?: undefined;
}

export interface ProtagonistEntry extends BaseEntry {
  kind: "protagonist";
  lines?: string[];
  linePages?: string[][];
  textTone?: TextTone;
  selectEffects?: EffectId[];
}

export type ScenarioEntry = DialogueEntry | ProtagonistEntry;

export interface SongCardCompletion {
  kind: "song-card";
  number: string;
  title: string;
  cardVariant: CardVariant;
  advanceMode: AdvanceMode;
  transition: TransitionKind;
  durationMs: number;
  nextChapter: string;
  background?: string;
  darkenDurationMs?: number;
  fadeOutAudio?: string;
}

export interface EndingCompletion {
  kind: "ending";
  nextChapter?: undefined;
}

export type ChapterCompletion = SongCardCompletion | EndingCompletion;

export interface ScenarioChapter {
  id: string;
  entries: ScenarioEntry[];
  completion: ChapterCompletion;
}

export interface Scenario {
  version: 2;
  startChapter: string;
  assets: ScenarioAssets;
  chapters: ScenarioChapter[];
}

interface ViewMetadata {
  readonly chapterId: string;
  readonly entryIndex: number;
  readonly pageIndex: number;
  readonly isFirstPage: boolean;
  readonly isLastPage: boolean;
  readonly text: string;
  readonly viewId: string;
}

export type DialogueView = Readonly<DialogueEntry & ViewMetadata>;
export type ProtagonistView = Readonly<
  ProtagonistEntry & ViewMetadata & { readonly lines: readonly string[] }
>;
export type ScenarioView = DialogueView | ProtagonistView;

export type SpeakerIdentityTarget =
  | { kind: "protagonist"; forceDialogTransition?: boolean }
  | { kind: "dialogue"; speaker: string | null; speakerId?: string; forceDialogTransition?: boolean };

export type AdvanceResult =
  | { type: "view"; view: ScenarioView }
  | { type: "completion"; completion: Readonly<ChapterCompletion> };

export interface ScenarioRuntime {
  getCurrentView(): ScenarioView;
  getCurrentChapterId(): string;
  advance(): AdvanceResult;
  enterNextChapter(): ScenarioView;
}

const ENTRY_KINDS = new Set<string>(["dialogue", "protagonist"]);
const COMPLETION_KINDS = new Set<string>(["song-card", "ending"]);
const ADVANCE_MODES = new Set<string>(["timer"]);
const TEXT_TONES = new Set<string>(["default", "red"]);
const EFFECT_PHASE_BY_PROPERTY: Readonly<Record<EffectPropertyName, EffectPhase>> = Object.freeze({
  enterEffects: EFFECT_PHASES.ENTER,
  selectEffects: EFFECT_PHASES.SELECT,
  completeEffects: EFFECT_PHASES.COMPLETE,
});
type EffectPropertyName = "enterEffects" | "selectEffects" | "completeEffects";
const TRANSITIONS = new Set<string>(["dark-song-interlude"]);
const CARD_VARIANTS = new Set<string>(["first", "second", "interlude"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`シナリオ設定エラー: ${message}`);
  }
}

function validateEffectList(
  entry: Record<string, unknown>,
  propertyName: EffectPropertyName,
  chapterId: string,
  entryIndex: number,
): void {
  const effects = entry[propertyName] ?? [];
  const expectedPhase = EFFECT_PHASE_BY_PROPERTY[propertyName];
  requireCondition(
    Array.isArray(effects),
    `${chapterId}の${entryIndex + 1}番目にある${propertyName}は配列で指定してください。`,
  );

  requireCondition(
    new Set(effects).size === effects.length,
    `${chapterId}の${entryIndex + 1}番目にある${propertyName}で演出IDが重複しています。`,
  );
  effects.forEach((effect) => {
    const definition = typeof effect === "string" ? getEffectDefinition(effect) : null;
    requireCondition(
      definition?.phases.includes(expectedPhase),
      `${chapterId}の${entryIndex + 1}番目に、${propertyName}では使えない演出「${String(effect)}」があります。`,
    );
  });
}

function validateEntry(
  entry: unknown,
  chapterId: string,
  entryIndex: number,
  assets: ScenarioAssets,
): void {
  const location = `${chapterId}の${entryIndex + 1}番目`;
  requireCondition(isRecord(entry), `${location}がオブジェクトではありません。`);
  requireCondition(typeof entry.kind === "string" && ENTRY_KINDS.has(entry.kind), `${location}のkindが不正です。`);
  requireCondition(
    typeof entry.sourceText === "string" && entry.sourceText.length > 0,
    `${location}にsourceTextがありません。`,
  );
  requireCondition(
    typeof entry.background === "string" && Object.hasOwn(assets.backgrounds, entry.background),
    `${location}の背景「${String(entry.background)}」がassetsにありません。`,
  );

  if (entry.character !== undefined) {
    requireCondition(
      typeof entry.character === "string" && assets.characterExpressions.includes(entry.character),
      `${location}の表情「${String(entry.character)}」がassetsにありません。`,
    );
  }

  if (entry.kind === "dialogue") {
    requireCondition(
      entry.speaker === null || typeof entry.speaker === "string",
      `${location}のspeakerは文字列またはnullにしてください。`,
    );
    if (entry.speaker === null) {
      requireCondition(
        entry.speakerId === undefined,
        `${location}の地の文にはspeakerIdを指定しないでください。`,
      );
    } else {
      requireCondition(
        typeof entry.speakerId === "string" && entry.speakerId.length > 0,
        `${location}の発話台詞にspeakerIdがありません。`,
      );
    }

    const pages = entry.pages ?? [entry.sourceText];
    requireCondition(
      Array.isArray(pages) &&
        pages.length > 0 &&
        pages.every((page) => typeof page === "string" && page.length > 0),
      `${location}のpagesが不正です。`,
    );
    requireCondition(
      pages.join("") === entry.sourceText,
      `${location}のpagesを連結した文章がsourceTextと一致しません。`,
    );
  }

  if (entry.kind === "protagonist") {
    const hasLines = entry.lines !== undefined;
    const hasLinePages = entry.linePages !== undefined;
    requireCondition(
      hasLines !== hasLinePages,
      `${location}の主人公台詞はlinesまたはlinePagesのどちらか一方で指定してください。`,
    );
    const linePages = hasLinePages ? entry.linePages : [entry.lines];
    requireCondition(
      Array.isArray(linePages) &&
        linePages.length > 0 &&
        linePages.every(
          (lines) =>
            Array.isArray(lines) &&
            lines.length >= 1 &&
            lines.length <= 2 &&
            lines.every((line) => typeof line === "string" && line.length > 0),
        ),
      `${location}の主人公台詞は各画面1個または2個で指定してください。`,
    );
    requireCondition(
      (linePages as string[][]).flat().join("") === entry.sourceText,
      `${location}の主人公台詞を連結した文章がsourceTextと一致しません。`,
    );
    const tone = entry.textTone ?? "default";
    requireCondition(
      typeof tone === "string" && TEXT_TONES.has(tone),
      `${location}のtextTone「${String(entry.textTone)}」が不正です。`,
    );
  } else {
    requireCondition(
      entry.textTone === undefined,
      `${location}のtextToneは主人公の台詞だけに指定できます。`,
    );
  }

  if (entry.forceDialogTransition !== undefined) {
    requireCondition(
      typeof entry.forceDialogTransition === "boolean",
      `${location}のforceDialogTransitionはtrueまたはfalseで指定してください。`,
    );
  }

  (["enterEffects", "selectEffects", "completeEffects"] as const).forEach((propertyName) => {
    validateEffectList(entry, propertyName, chapterId, entryIndex);
  });
  requireCondition(
    entry.kind === "protagonist" || entry.selectEffects === undefined,
    `${location}のselectEffectsは主人公台詞だけに指定できます。`,
  );
}

/*
 * 表示名ではなく、実際に誰が話しているかを返します。
 * 「???」から「クロコ」へ表示名が変わっても、speakerIdが同じなら同一人物です。
 */
export function getViewSpeakerIdentity(view: SpeakerIdentityTarget): string {
  if (view.kind === "protagonist") {
    return "protagonist";
  }
  if (view.kind === "dialogue" && view.speaker === null) {
    return "narration";
  }
  if (view.kind === "dialogue") {
    return `speaker:${view.speakerId}`;
  }
  throw new Error(`シナリオ設定エラー: 未知の表示形式「${String((view as { kind?: unknown }).kind)}」です。`);
}

/* メインボックスの表示形式または話者が変わる場合だけ、ボックスを切り替えます。 */
export function shouldFadeMainDialog(
  previousView: SpeakerIdentityTarget,
  nextView: SpeakerIdentityTarget,
): boolean {
  if (nextView.forceDialogTransition === true) {
    return true;
  }
  const previousUsesMainDialog = previousView.kind === "dialogue";
  const nextUsesMainDialog = nextView.kind === "dialogue";

  if (previousUsesMainDialog !== nextUsesMainDialog) {
    return true;
  }
  if (!previousUsesMainDialog) {
    return false;
  }
  return getViewSpeakerIdentity(previousView) !== getViewSpeakerIdentity(nextView);
}

export function validateScenario(scenario: unknown): Scenario {
  requireCondition(isRecord(scenario), "ルートがオブジェクトではありません。");
  requireCondition(scenario.version === 2, "対応しているversionは2です。");
  requireCondition(isRecord(scenario.assets), "assetsがありません。");
  const assets = scenario.assets;
  requireCondition(isRecord(assets.backgrounds), "背景素材の一覧がありません。");
  requireCondition(
    Array.isArray(assets.characterExpressions),
    "立ち絵表情の一覧がありません。",
  );
  requireCondition(isRecord(assets.audio), "音源素材の一覧がありません。");
  Object.entries(assets.backgrounds).forEach(([id, filename]) => {
    requireCondition(
      typeof filename === "string" && filename.length > 0,
      `背景「${id}」のファイル名が不正です。`,
    );
  });
  Object.entries(assets.audio).forEach(([id, definition]) => {
    requireCondition(
      isRecord(definition) && typeof definition.path === "string" && definition.path.length > 0,
      `音源「${id}」のpathが不正です。`,
    );
    requireCondition(
      definition.kind === "bgm" || definition.kind === "se",
      `音源「${id}」のkindはbgmまたはseで指定してください。`,
    );
    if (definition.volume !== undefined) {
      requireCondition(
        typeof definition.volume === "number" &&
          Number.isFinite(definition.volume) &&
          definition.volume >= 0 &&
          definition.volume <= 1,
        `音源「${id}」のvolumeは0から1で指定してください。`,
      );
    }
    if (definition.loop !== undefined) {
      requireCondition(typeof definition.loop === "boolean", `音源「${id}」のloopが不正です。`);
    }
  });
  requireCondition(
    new Set(assets.characterExpressions).size === assets.characterExpressions.length,
    "立ち絵表情の一覧に重複があります。",
  );
  requireCondition(Array.isArray(scenario.chapters) && scenario.chapters.length > 0, "chaptersがありません。");

  const typedAssets = assets as unknown as ScenarioAssets;
  const chapterIds = new Set<string>();
  scenario.chapters.forEach((chapter) => {
    requireCondition(isRecord(chapter), "章がオブジェクトではありません。");
    requireCondition(typeof chapter.id === "string" && chapter.id.length > 0, "章にidがありません。");
    requireCondition(!chapterIds.has(chapter.id), `章ID「${chapter.id}」が重複しています。`);
    chapterIds.add(chapter.id);
    requireCondition(
      Array.isArray(chapter.entries) && chapter.entries.length > 0,
      `章「${chapter.id}」にentriesがありません。`,
    );
    chapter.entries.forEach((entry, index) => {
      validateEntry(entry, chapter.id as string, index, typedAssets);
    });

    const completion = chapter.completion;
    requireCondition(
      isRecord(completion) && typeof completion.kind === "string" && COMPLETION_KINDS.has(completion.kind),
      `章「${chapter.id}」のcompletionが不正です。`,
    );

    if (completion.kind === "ending") {
      requireCondition(
        completion.nextChapter === undefined,
        `最終章「${chapter.id}」のendingにはnextChapterを指定できません。`,
      );
      return;
    }

    requireCondition(typeof completion.number === "string", `章「${chapter.id}」の曲番号がありません。`);
    requireCondition(typeof completion.title === "string", `章「${chapter.id}」の曲名がありません。`);
    requireCondition(
      typeof completion.cardVariant === "string" && CARD_VARIANTS.has(completion.cardVariant),
      `章「${chapter.id}」のcardVariantが不正です。`,
    );
    requireCondition(
      typeof completion.advanceMode === "string" && ADVANCE_MODES.has(completion.advanceMode),
      `章「${chapter.id}」のadvanceModeが不正です。`,
    );
    requireCondition(
      typeof completion.transition === "string" && TRANSITIONS.has(completion.transition),
      `章「${chapter.id}」のtransitionが不正です。`,
    );
    requireCondition(
      typeof completion.durationMs === "number" &&
        Number.isFinite(completion.durationMs) &&
        completion.durationMs > 0,
      `章「${chapter.id}」のdurationMsが不正です。`,
    );
    requireCondition(
      typeof completion.nextChapter === "string",
      `章「${chapter.id}」にnextChapterがありません。`,
    );
    if (completion.background !== undefined) {
      requireCondition(
        typeof completion.background === "string" &&
          Object.hasOwn(typedAssets.backgrounds, completion.background),
        `章「${chapter.id}」の終了背景がassetsにありません。`,
      );
    }
    if (completion.darkenDurationMs !== undefined) {
      requireCondition(
        completion.transition === "dark-song-interlude" &&
          typeof completion.darkenDurationMs === "number" &&
          Number.isFinite(completion.darkenDurationMs) &&
          completion.darkenDurationMs > 0,
        `章「${chapter.id}」のdarkenDurationMsは暗転カードへ正の数で指定してください。`,
      );
    }
    if (completion.fadeOutAudio !== undefined) {
      requireCondition(
        typeof completion.fadeOutAudio === "string" &&
          Object.hasOwn(typedAssets.audio, completion.fadeOutAudio),
        `章「${chapter.id}」のfadeOutAudio「${String(completion.fadeOutAudio)}」がassetsにありません。`,
      );
      requireCondition(
        typedAssets.audio[completion.fadeOutAudio]?.kind === "bgm",
        `章「${chapter.id}」のfadeOutAudioにはBGMを指定してください。`,
      );
    }
  });

  const typedScenario = scenario as unknown as Scenario;
  requireCondition(
    typeof typedScenario.startChapter === "string" && chapterIds.has(typedScenario.startChapter),
    "startChapterに対応する章がありません。",
  );
  typedScenario.chapters.forEach((chapter) => {
    const nextChapter = chapter.completion.nextChapter;
    if (nextChapter !== undefined) {
      requireCondition(chapterIds.has(nextChapter), `次章「${nextChapter}」が見つかりません。`);
    }
  });

  const endingChapters = typedScenario.chapters.filter((chapter) => chapter.completion.kind === "ending");
  requireCondition(endingChapters.length === 1, "endingの章は1つだけ指定してください。");

  // 現在のゲームは分岐しないため、開始章から1本の経路で全章とENDへ到達できることを確認します。
  const chapterById = new Map(typedScenario.chapters.map((chapter) => [chapter.id, chapter]));
  const visitedChapterIds = new Set<string>();
  let currentChapterId: string | undefined = typedScenario.startChapter;
  while (currentChapterId !== undefined) {
    requireCondition(
      !visitedChapterIds.has(currentChapterId),
      `章「${currentChapterId}」を含む循環があります。`,
    );
    visitedChapterIds.add(currentChapterId);
    const currentChapter = chapterById.get(currentChapterId);
    requireCondition(currentChapter !== undefined, `次章「${currentChapterId}」が見つかりません。`);
    if (currentChapter.completion.kind === "ending") {
      currentChapterId = undefined;
    } else {
      currentChapterId = currentChapter.completion.nextChapter;
    }
  }
  requireCondition(
    visitedChapterIds.size === typedScenario.chapters.length,
    "開始章から到達できない章があります。",
  );

  getRequiredAudioIds(typedScenario).forEach((audioId) => {
    requireCondition(
      Object.hasOwn(typedScenario.assets.audio, audioId),
      `本編で必要な音源「${audioId}」がassetsにありません。`,
    );
  });

  return typedScenario;
}

function makeView(chapter: ScenarioChapter, entryIndex: number, pageIndex: number): ScenarioView {
  const entry = chapter.entries[entryIndex];
  if (entry.kind === "dialogue") {
    const pages = entry.pages ?? [entry.sourceText];
    const pageCount = pages.length;
    return Object.freeze({
      ...entry,
      chapterId: chapter.id,
      entryIndex,
      pageIndex,
      isFirstPage: pageIndex === 0,
      isLastPage: pageIndex === pageCount - 1,
      text: pages[pageIndex],
      viewId: `${chapter.id}:${entryIndex}:${pageIndex}`,
    });
  }

  const linePages = entry.linePages ?? [entry.lines ?? []];
  const pageCount = linePages.length;
  const lines = linePages[pageIndex];
  const suppressSelectEffects = pageIndex < pageCount - 1;
  return Object.freeze({
    ...entry,
    // 複数ページの主人公台詞では、最後のボックスを選んだときだけ演出を実行します。
    ...(suppressSelectEffects ? { selectEffects: [] } : {}),
    lines,
    chapterId: chapter.id,
    entryIndex,
    pageIndex,
    isFirstPage: pageIndex === 0,
    isLastPage: pageIndex === pageCount - 1,
    text: lines.join(""),
    viewId: `${chapter.id}:${entryIndex}:${pageIndex}`,
  });
}

export function createScenarioRuntime(scenario: unknown): ScenarioRuntime {
  const validatedScenario = validateScenario(scenario);
  const chapterById = new Map(validatedScenario.chapters.map((chapter) => [chapter.id, chapter]));
  let chapter = chapterById.get(validatedScenario.startChapter)!;
  let entryIndex = 0;
  let pageIndex = 0;
  let isWaitingAtCompletion = false;

  const currentView = (): ScenarioView => makeView(chapter, entryIndex, pageIndex);

  return Object.freeze({
    getCurrentView(): ScenarioView {
      return currentView();
    },

    getCurrentChapterId(): string {
      return chapter.id;
    },

    advance(): AdvanceResult {
      requireCondition(!isWaitingAtCompletion, "章終了演出の完了前には進めません。");
      const entry = chapter.entries[entryIndex];
      const pageCount = entry.kind === "dialogue"
        ? (entry.pages ?? [entry.sourceText]).length
        : (entry.linePages ?? [entry.lines ?? []]).length;

      if (pageIndex < pageCount - 1) {
        pageIndex += 1;
        return { type: "view", view: currentView() };
      }

      if (entryIndex < chapter.entries.length - 1) {
        entryIndex += 1;
        pageIndex = 0;
        return { type: "view", view: currentView() };
      }

      isWaitingAtCompletion = true;
      return { type: "completion", completion: Object.freeze({ ...chapter.completion }) };
    },

    enterNextChapter(): ScenarioView {
      requireCondition(isWaitingAtCompletion, "章が終了していないため次章へ進めません。");
      const nextChapterId = chapter.completion.nextChapter;
      requireCondition(nextChapterId, "次章がない終了場面の先には進めません。");
      const nextChapter = chapterById.get(nextChapterId);
      requireCondition(nextChapter !== undefined, `次章「${nextChapterId}」が見つかりません。`);
      chapter = nextChapter;
      entryIndex = 0;
      pageIndex = 0;
      isWaitingAtCompletion = false;
      return currentView();
    },
  });
}
