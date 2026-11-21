import { AudioManager } from "./audio-manager.ts";
import type { EasingFunction } from "./audio-manager.ts";
import { GameDialogView } from "./game-dialog-view.ts";
import {
  BUBBLE_EFFECT_DURATION_MS,
  CHARACTER_ENTRANCE_LOCK_DURATION_MS,
  CHARACTER_FADE_DURATION_MS,
  CHARACTER_SPRITE_LOAD_TIMEOUT_MS,
  CORRIDOR_BGM_FADE_IN_DURATION_MS,
  CORRIDOR_BGM_SLOW_FADE_OUT_DURATION_MS,
  CORRIDOR_BGM_TARGET_VOLUME,
  DARK_INTERLUDE_CARD_ENTER_DURATION_MS,
  DARK_INTERLUDE_CARD_LEAVE_DURATION_MS,
  DARK_INTERLUDE_REVEAL_DURATION_MS,
  DEFAULT_DARK_INTERLUDE_DARKEN_DURATION_MS,
  ENDING_BLACK_HOLD_DURATION_MS,
  ENDING_CLOSE_DURATION_MS,
  ENDING_DARKEN_DURATION_MS,
  ENDING_TEXT_FADE_IN_DURATION_MS,
  ETERNAL_EARTH_TARGET_VOLUME,
  EXPRESSION_OUTGOING_FADE_DURATION_MS,
  FINAL_CAMERA_PRE_ZOOM_HOLD_MS,
  FINAL_CAMERA_ZOOM_DURATION_MS,
  FINAL_DIALOG_PAUSE_DURATION_MS,
  HESITATION_HOLD_DURATION_MS,
  HESITATION_SHAKE_DURATION_MS,
  HESITATION_TOTAL_DURATION_MS,
  HESITATION_ZOOM_IN_DURATION_MS,
  HESITATION_ZOOM_OUT_DURATION_MS,
  LATER_CORRIDOR_FADE_IN_DURATION_MS,
  METRONOME_FADE_DURATION_MS,
  METRONOME_START_VOLUME,
  METRONOME_TARGET_VOLUME,
  NAME_BLANK_HOLD_DURATION_MS,
  NAME_FADE_IN_DURATION_MS,
  NAME_FADE_OUT_DURATION_MS,
  OPENING_FADE_DURATION_MS,
  PROTAGONIST_POST_SELECTION_HOLD_MS,
  PROTAGONIST_SELECTION_DURATION_MS,
  STAR_REMNANTS_FADE_IN_DURATION_MS,
  STAR_REMNANTS_TARGET_VOLUME,
  TYPEWRITER_DELAY_MS,
} from "./game-config.ts";
import {
  GAME_STATES,
  GameStateController,
} from "./game-state-controller.ts";
import { ScenarioEffectRunner } from "./scenario-effect-runner.ts";
import { EFFECT_PHASES } from "./scenario-effects.ts";
import {
  createScenarioRuntime,
  shouldFadeMainDialog,
  validateScenario,
} from "./scenario-runtime.ts";
import type {
  ChapterCompletion,
  Scenario,
  ScenarioRuntime,
  ScenarioView,
  SongCardCompletion,
} from "./scenario-runtime.ts";

/*
 * このファイルは、scenario.jsonに書かれた台本を画面へ表示する担当です。
 * 台詞を追加するときは、原則としてこのファイルではなくscenario.jsonを編集します。
 */

// 黒い幕とBGMを、ゆっくり始まりゆっくり終わる同じカーブで変化させます。
// CSS側の cubic-bezier(1/3, 0, 2/3, 1) と同じ計算です。
const DARK_INTERLUDE_EASING: EasingFunction = (progress) =>
  progress * progress * (3 - 2 * progress);

interface EffectExecutionContext {
  view?: ScenarioView;
  stage?: "prepare" | "after-selection";
}

interface CharacterSpritePreload {
  image: HTMLImageElement;
  ready: Promise<boolean>;
}

const gameStage = document.querySelector<HTMLElement>("#game-stage");
const sceneCamera = document.querySelector<HTMLElement>("#scene-camera");
const backgroundPrimary = document.querySelector<HTMLElement>("#background-primary");
const backgroundSecondary = document.querySelector<HTMLElement>("#background-secondary");
const dialogBox = document.querySelector<HTMLElement>("#dialog-box");
const speakerName = document.querySelector<HTMLElement>("#speaker-name");
const dialogText = document.querySelector<HTMLElement>("#dialog-text");
const dialogAnnouncement = document.querySelector<HTMLElement>("#dialog-announcement");
const nextMark = document.querySelector<HTMLElement>("#next-mark");
const protagonistDialog = document.querySelector<HTMLElement>("#protagonist-dialog");
const protagonistLines = document.querySelector<HTMLElement>("#protagonist-lines");
const songCard = document.querySelector<HTMLElement>("#song-card");
const songNumber = document.querySelector<HTMLElement>("#song-number");
const songTitle = document.querySelector<HTMLElement>("#song-title");
const endingCard = document.querySelector<HTMLElement>("#ending-card");
const endingButton = document.querySelector<HTMLButtonElement>("#ending-button");
const characterLayer = document.querySelector<HTMLElement>("#character-layer");
const characterSpritePrimary = document.querySelector<HTMLImageElement>("#character-sprite-primary");
const characterSpriteSecondary = document.querySelector<HTMLImageElement>("#character-sprite-secondary");
const advanceButton = document.querySelector<HTMLButtonElement>("#advance-button");
const advanceLabel = document.querySelector<HTMLElement>("#advance-label");
const titleButton = document.querySelector<HTMLButtonElement>("#title-button");
const returnDialog = document.querySelector<HTMLElement>("#return-dialog");
const cancelReturnButton = document.querySelector<HTMLButtonElement>("#cancel-return-button");
const confirmReturnButton = document.querySelector<HTMLButtonElement>("#confirm-return-button");
const transitionBubbles = document.querySelector<HTMLElement>("#transition-bubbles");
const sceneTransitionCurtain = document.querySelector<HTMLElement>("#scene-transition-curtain");
const openingCurtain = document.querySelector<HTMLElement>(".opening-curtain");
const gameError = document.querySelector<HTMLElement>("#game-error");
const gameErrorMessage = document.querySelector<HTMLElement>("#game-error-message");

if (
  gameStage &&
  sceneCamera &&
  backgroundPrimary &&
  backgroundSecondary &&
  dialogBox &&
  speakerName &&
  dialogText &&
  dialogAnnouncement &&
  nextMark &&
  protagonistDialog &&
  protagonistLines &&
  songCard &&
  songNumber &&
  songTitle &&
  endingCard &&
  endingButton &&
  characterLayer &&
  characterSpritePrimary &&
  characterSpriteSecondary &&
  advanceButton &&
  advanceLabel &&
  titleButton &&
  returnDialog &&
  cancelReturnButton &&
  confirmReturnButton &&
  transitionBubbles &&
  sceneTransitionCurtain &&
  openingCurtain &&
  gameError &&
  gameErrorMessage
) {
  let scenario: Scenario | null = null;
  let runtime: ScenarioRuntime | null = null;
  let audioManager: AudioManager | null = null;
  let effectRunner: ScenarioEffectRunner<EffectExecutionContext> | null = null;
  const gameState = new GameStateController();
  let currentView: ScenarioView | null = null;
  let currentBackground: string | null = null;
  let activeBackgroundLayer: HTMLElement = backgroundPrimary;
  let inactiveBackgroundLayer: HTMLElement = backgroundSecondary;
  let activeCharacterSprite: HTMLImageElement = characterSpritePrimary;
  let inactiveCharacterSprite: HTMLImageElement = characterSpriteSecondary;
  let currentExpression = "";
  let bubbleEffectTimer: number | null = null;
  let songTimer: number | null = null;
  let songTimerStartedAt = 0;
  let songTimeRemaining = 0;
  let currentCompletion: Readonly<SongCardCompletion> | null = null;
  let characterVisibilityTimer: number | null = null;
  const preparedBgmPlayPromises = new Map<string, Promise<boolean>>();
  const completedEffectViewIds = new Set<string>();
  let isScenarioReady = false;
  let isOpeningFadeFinished = false;
  let hasSceneStarted = false;
  let hasMetronomeStarted = false;
  let isMetronomeStarting = false;
  let hasCharacterAppeared = false;
  const characterSpritePreloads = new Map<string, CharacterSpritePreload>();

  const requireScenario = (): Scenario => {
    if (!scenario) {
      throw new Error("シナリオが初期化されていません。");
    }
    return scenario;
  };

  const requireRuntime = (): ScenarioRuntime => {
    if (!runtime) {
      throw new Error("シナリオ再生エンジンが初期化されていません。");
    }
    return runtime;
  };

  const requireAudioManager = (): AudioManager => {
    if (!audioManager) {
      throw new Error("音源管理が初期化されていません。");
    }
    return audioManager;
  };

  const requireEffectRunner = (): ScenarioEffectRunner<EffectExecutionContext> => {
    if (!effectRunner) {
      throw new Error("演出ランナーが初期化されていません。");
    }
    return effectRunner;
  };

  const requireCurrentView = (): ScenarioView => {
    if (!currentView) {
      throw new Error("現在の表示画面が初期化されていません。");
    }
    return currentView;
  };

  const isChangingState = (): boolean =>
    gameState.is(GAME_STATES.RUNNING_EFFECT, GAME_STATES.ENDING_TRANSITION);

  const wait = (milliseconds: number): Promise<void> =>
    new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });

  const clearSongTimer = (): void => {
    if (songTimer !== null) {
      window.clearTimeout(songTimer);
      songTimer = null;
    }
  };

  const showGameError = (error: unknown): void => {
    dialogView.clearTimer();
    clearSongTimer();
    gameState.fail();
    dialogBox.hidden = true;
    protagonistDialog.hidden = true;
    songCard.hidden = true;
    endingCard.hidden = true;
    endingButton.hidden = true;
    endingButton.disabled = true;
    advanceButton.hidden = true;
    advanceButton.disabled = true;
    openingCurtain.hidden = true;
    gameErrorMessage.textContent = error instanceof Error ? error.message : String(error);
    gameError.hidden = false;
    titleButton.disabled = false;
  };

  const getBackgroundUrl = (backgroundId: string): string => {
    const filename = requireScenario().assets.backgrounds[backgroundId];
    if (!filename) {
      throw new Error(`背景「${backgroundId}」がscenario.jsonに登録されていません。`);
    }
    return `${gameStage.dataset.backgroundBase ?? ""}/${filename}`;
  };

  /*
   * 2枚の背景を交互に手前へ出します。
   * immediateがtrueのときは暗転中なので、見えないところで即座に交換します。
   */
  const changeBackground = (
    backgroundId: string,
    durationMs = 0,
    immediate = false,
  ): Promise<void> => {
    if (currentBackground === backgroundId) {
      return Promise.resolve();
    }

    const backgroundUrl = `url("${getBackgroundUrl(backgroundId)}")`;
    gameStage.dataset.currentBackground = backgroundId;

    if (currentBackground === null || immediate) {
      activeBackgroundLayer.style.setProperty("--background-transition-ms", "0ms");
      activeBackgroundLayer.style.backgroundImage = backgroundUrl;
      activeBackgroundLayer.classList.add("is-active");
      inactiveBackgroundLayer.classList.remove("is-active");
      currentBackground = backgroundId;
      return Promise.resolve();
    }

    const previousLayer = activeBackgroundLayer;
    const nextLayer = inactiveBackgroundLayer;
    previousLayer.style.setProperty("--background-transition-ms", `${durationMs}ms`);
    nextLayer.style.setProperty("--background-transition-ms", `${durationMs}ms`);
    nextLayer.style.backgroundImage = backgroundUrl;
    void nextLayer.offsetWidth;
    nextLayer.classList.add("is-active");
    previousLayer.classList.remove("is-active");
    activeBackgroundLayer = nextLayer;
    inactiveBackgroundLayer = previousLayer;
    currentBackground = backgroundId;
    return durationMs > 0 ? wait(durationMs) : Promise.resolve();
  };

  const getCharacterUrl = (expression: string): string =>
    `${gameStage.dataset.characterBase ?? ""}/chroko_${expression}.png`;

  const waitForCharacterSprite = (image: HTMLImageElement): Promise<boolean> =>
    new Promise((resolve) => {
      let isFinished = false;
      const finish = (isReady: boolean): void => {
        if (isFinished) {
          return;
        }
        isFinished = true;
        window.clearTimeout(fallbackTimer);
        resolve(isReady);
      };
      const fallbackTimer = window.setTimeout(() => {
        finish(false);
      }, CHARACTER_SPRITE_LOAD_TIMEOUT_MS);

      image.addEventListener("error", () => finish(false), { once: true });

      // decodeが使えるブラウザでは、画面へ出す前に画像の展開まで済ませます。
      if (typeof image.decode === "function") {
        image.decode().then(() => finish(true)).catch(() => {
          // decodeに対応していても失敗した場合は、通常の読み込み結果で判断します。
          if (image.complete) {
            finish(image.naturalWidth > 0);
          } else {
            image.addEventListener("load", () => finish(true), { once: true });
          }
        });
        return;
      }

      image.addEventListener("load", () => finish(true), { once: true });
      if (image.complete) {
        finish(image.naturalWidth > 0);
      }
    });

  const preloadCharacterSprite = (expression: string): Promise<boolean> => {
    const existing = characterSpritePreloads.get(expression);
    if (existing) {
      return existing.ready;
    }

    const image = new Image();
    image.src = getCharacterUrl(expression);
    const ready = waitForCharacterSprite(image);
    characterSpritePreloads.set(expression, { image, ready });
    return ready;
  };

  const preloadCharacterSprites = (): void => {
    requireScenario().assets.characterExpressions.forEach((expression) => {
      void preloadCharacterSprite(expression);
    });
  };

  const setCharacterExpression = async (
    expression: string,
    immediately = false,
  ): Promise<boolean> => {
    if (!expression || expression === currentExpression) {
      return true;
    }

    const isReady = await preloadCharacterSprite(expression);
    if (!isReady) {
      // 読み込めなかった場合は、壊れた画像へ切り替えず現在の表情を残します。
      return false;
    }

    if (immediately || characterLayer.hidden) {
      activeCharacterSprite.src = getCharacterUrl(expression);
      activeCharacterSprite.classList.remove("is-hidden", "is-rear", "is-fading-out");
      activeCharacterSprite.classList.add("is-front");
      inactiveCharacterSprite.classList.remove("is-front", "is-rear", "is-fading-out");
      inactiveCharacterSprite.classList.add("is-hidden");
      currentExpression = expression;
      return true;
    }

    const previousSprite = activeCharacterSprite;
    const nextSprite = inactiveCharacterSprite;
    nextSprite.src = getCharacterUrl(expression);
    nextSprite.classList.remove("is-hidden", "is-front", "is-fading-out");
    nextSprite.classList.add("is-rear");
    void nextSprite.offsetWidth;
    previousSprite.classList.add("is-fading-out");
    currentExpression = expression;

    // 新しい画像は後ろではっきり表示したまま、前の古い画像だけを消します。
    // 完了まで待つことで、連打による途中の表情差し替えも防ぎます。
    await wait(EXPRESSION_OUTGOING_FADE_DURATION_MS);
    previousSprite.classList.remove("is-front", "is-fading-out", "is-rear");
    previousSprite.classList.add("is-hidden");
    nextSprite.classList.remove("is-rear");
    nextSprite.classList.add("is-front");
    activeCharacterSprite = nextSprite;
    inactiveCharacterSprite = previousSprite;
    return true;
  };

  const showCharacter = async (expression: string): Promise<void> => {
    if (characterVisibilityTimer !== null) {
      window.clearTimeout(characterVisibilityTimer);
      characterVisibilityTimer = null;
    }

    const wasHidden = Boolean(characterLayer.hidden);
    const isFirstEntrance = wasHidden && !hasCharacterAppeared;
    await setCharacterExpression(expression, wasHidden);

    if (wasHidden) {
      characterLayer.hidden = false;
      if (isFirstEntrance) {
        characterLayer.classList.add("is-entering");
      }
      void characterLayer.offsetWidth;
    }

    if (isFirstEntrance) {
      hasCharacterAppeared = true;
      void requireAudioManager().play("footsteps");
    }
    characterLayer.classList.add("is-visible");

    if (isFirstEntrance) {
      await wait(CHARACTER_ENTRANCE_LOCK_DURATION_MS);
      requireAudioManager().stop("footsteps");
      characterLayer.classList.remove("is-entering");
    }
  };

  const hideCharacterImmediately = (): void => {
    if (characterVisibilityTimer !== null) {
      window.clearTimeout(characterVisibilityTimer);
      characterVisibilityTimer = null;
    }
    characterLayer.classList.remove("is-visible", "is-entering");
    characterLayer.hidden = true;
  };

  const getProtagonistButtons = (): HTMLButtonElement[] =>
    dialogView.getProtagonistButtons();

  const isProtagonistSceneActive = (): boolean =>
    gameState.is(GAME_STATES.AWAITING_PROTAGONIST) &&
    !protagonistDialog.hidden &&
    currentView?.kind === "protagonist";

  const updateInputControls = (focus = false): void => {
    const isSongCard = gameState.is(GAME_STATES.SONG_CARD);
    const isProtagonist = isProtagonistSceneActive();
    const shouldDisable =
      isChangingState() ||
      gameState.is(
        GAME_STATES.LOADING,
        GAME_STATES.OPENING,
        GAME_STATES.RETURN_DIALOG,
        GAME_STATES.RETURNING,
        GAME_STATES.ERROR,
        GAME_STATES.ENDING_READY,
      ) ||
      !hasSceneStarted;

    advanceButton.hidden =
      isSongCard ||
      isProtagonist ||
      gameState.is(
        GAME_STATES.ERROR,
        GAME_STATES.ENDING_TRANSITION,
        GAME_STATES.ENDING_READY,
        GAME_STATES.RETURNING,
      );
    advanceButton.disabled = advanceButton.hidden || shouldDisable;
    advanceLabel.textContent = "物語を次へ進める";
    getProtagonistButtons().forEach((button) => {
      button.disabled = shouldDisable;
    });
    titleButton.disabled =
      isChangingState() ||
      gameState.is(GAME_STATES.RETURNING) ||
      (!hasSceneStarted && !gameState.is(GAME_STATES.ERROR));

    if (!focus || gameState.is(GAME_STATES.RETURN_DIALOG) || isChangingState()) {
      return;
    }
    if (isProtagonist) {
      getProtagonistButtons()[0]?.focus({ preventScroll: true });
    } else if (isSongCard) {
      titleButton.focus({ preventScroll: true });
    } else if (gameState.is(GAME_STATES.TYPING, GAME_STATES.AWAITING_ADVANCE)) {
      advanceButton.focus({ preventScroll: true });
    }
  };

  const runCompleteEffects = async (view: ScenarioView): Promise<void> => {
    await requireEffectRunner().run(EFFECT_PHASES.COMPLETE, view.completeEffects ?? [], { view });
  };

  const handleTypingFinished = (): void => {
    gameState.transition(GAME_STATES.AWAITING_ADVANCE);
    updateInputControls();

    const activeView = currentView;
    if (
      activeView &&
      activeView.isLastPage &&
      (activeView.completeEffects?.length ?? 0) > 0 &&
      !completedEffectViewIds.has(activeView.viewId)
    ) {
      const effectView = activeView;
      void runCompleteEffects(effectView)
        .then(() => completedEffectViewIds.add(effectView.viewId))
        .catch(showGameError);
    }
  };

  const renderCurrentView = (): Promise<void> => {
    const view = requireCurrentView();
    let characterEntrance: Promise<void> = Promise.resolve();
    if (view.character) {
      characterEntrance = showCharacter(view.character);
    }
    if (view.kind === "protagonist") {
      gameState.transition(GAME_STATES.AWAITING_PROTAGONIST);
      dialogView.renderProtagonist(view);
      updateInputControls();
    } else {
      gameState.transition(GAME_STATES.TYPING);
      dialogView.renderDialogue(view);
      updateInputControls();
    }
    return characterEntrance;
  };

  const startBubbleEffect = (): void => {
    if (bubbleEffectTimer !== null) {
      window.clearTimeout(bubbleEffectTimer);
    }
    transitionBubbles.classList.remove("is-active");
    void transitionBubbles.offsetWidth;
    transitionBubbles.classList.add("is-active");
    bubbleEffectTimer = window.setTimeout(() => {
      transitionBubbles.classList.remove("is-active");
      bubbleEffectTimer = null;
    }, BUBBLE_EFFECT_DURATION_MS);
  };

  const startWaterTransition = async (view: ScenarioView): Promise<void> => {
    const bubblePlayback = requireAudioManager().play("bubble");
    await Promise.race([bubblePlayback, wait(400)]);
    void changeBackground(view.background, 3000);
    startBubbleEffect();
  };

  const runEnterEffects = async (view: ScenarioView): Promise<void> => {
    const enterEffects = view.isFirstPage ? (view.enterEffects ?? []) : [];
    if (!enterEffects.includes("water-transition") && view.background !== currentBackground) {
      void changeBackground(view.background, 300);
    }
    await requireEffectRunner().run(EFFECT_PHASES.ENTER, enterEffects, { view });
  };

  const fadeInMetronome = (): void => {
    void requireAudioManager().fadeTo(
      "metronome",
      METRONOME_TARGET_VOLUME,
      METRONOME_FADE_DURATION_MS,
    );
  };

  const startMetronome = (): void => {
    if (runtime?.getCurrentChapterId() !== "opening" || hasMetronomeStarted || isMetronomeStarting) {
      return;
    }
    isMetronomeStarting = true;
    const audio = requireAudioManager();
    audio.setVolume("metronome", METRONOME_START_VOLUME);
    void audio.play("metronome", { restart: false }).then((canPlay) => {
      isMetronomeStarting = false;
      hasMetronomeStarted = canPlay;
      if (canPlay) {
        fadeInMetronome();
      }
    });
  };

  const fadeOutMetronome = async (durationMs: number, easing?: EasingFunction): Promise<void> => {
    const audio = requireAudioManager();
    if (!hasMetronomeStarted || audio.get("metronome").paused) {
      return;
    }
    await audio.fadeTo("metronome", 0, durationMs, {
      stopWhenFinished: true,
      easing,
    });
    hasMetronomeStarted = false;
  };

  const prepareBgmForGesture = (audioId: string): Promise<boolean> => {
    const audio = requireAudioManager();
    audio.stop(audioId);
    audio.setVolume(audioId, 0);
    const playPromise = audio.play(audioId, { restart: false });
    preparedBgmPlayPromises.set(audioId, playPromise);
    return playPromise;
  };

  const fadeInPreparedBgm = async (
    audioId: string,
    targetVolume: number,
    durationMs: number,
  ): Promise<void> => {
    const playPromise = preparedBgmPlayPromises.get(audioId);
    preparedBgmPlayPromises.delete(audioId);
    if (playPromise && await playPromise) {
      await requireAudioManager().fadeTo(audioId, targetVolume, durationMs);
    }
  };

  const startBgm = async (
    audioId: string,
    targetVolume: number,
    durationMs: number,
  ): Promise<boolean> => {
    const audio = requireAudioManager();
    audio.stop(audioId);
    audio.setVolume(audioId, 0);
    const canPlay = await audio.play(audioId, { restart: false });
    if (!canPlay) {
      return false;
    }
    void audio.fadeTo(audioId, targetVolume, durationMs).catch(showGameError);
    return true;
  };

  const playBgmImmediatelyForGesture = (
    audioId: string,
    targetVolume: number,
  ): Promise<boolean> => {
    const audio = requireAudioManager();
    audio.stop(audioId);
    audio.setVolume(audioId, targetVolume);
    return audio.play(audioId, { restart: false });
  };

  const setSongCard = (completion: Readonly<SongCardCompletion>): void => {
    songNumber.textContent = completion.number;
    songTitle.textContent = completion.title;
    songCard.classList.remove(
      "is-visible",
      "is-leaving",
      "is-first-song",
      "is-second-song",
      "is-interlude",
      "is-dark-interlude",
    );
    if (completion.cardVariant === "first") {
      songCard.classList.add("is-first-song");
    } else if (completion.cardVariant === "second") {
      songCard.classList.add("is-second-song");
    } else {
      songCard.classList.add("is-interlude");
    }
    if (completion.transition === "dark-song-interlude") {
      songCard.classList.add("is-dark-interlude");
    }
    songCard.hidden = false;
    void songCard.offsetWidth;
    songCard.classList.add("is-visible");
  };

  const beginNextChapter = async (): Promise<void> => {
    if (!gameState.is(GAME_STATES.SONG_CARD)) {
      return;
    }
    clearSongTimer();
    gameState.transition(GAME_STATES.RUNNING_EFFECT);
    updateInputControls();
    songCard.classList.add("is-leaving");
    songCard.classList.remove("is-visible");
    currentView = requireRuntime().enterNextChapter();

    await wait(DARK_INTERLUDE_CARD_LEAVE_DURATION_MS);

    songCard.hidden = true;
    songCard.classList.remove("is-visible", "is-leaving", "is-dark-interlude");
    currentCompletion = null;

    // 暗転中の区切りでは、黒画面の裏側で次の背景を先に準備します。
    await changeBackground(currentView.background, 0, true);
    await runEnterEffects(currentView);
    await renderCurrentView();

    sceneTransitionCurtain.classList.add("is-revealing");
    sceneTransitionCurtain.classList.remove("is-dark");
    await wait(DARK_INTERLUDE_REVEAL_DURATION_MS);
    sceneTransitionCurtain.hidden = true;
    sceneTransitionCurtain.classList.remove("is-revealing");
    updateInputControls(true);
  };

  const scheduleSongEnd = (): void => {
    if (
      !gameState.is(GAME_STATES.SONG_CARD) ||
      currentCompletion?.advanceMode !== "timer" ||
      songTimeRemaining <= 0
    ) {
      return;
    }
    clearSongTimer();
    songTimerStartedAt = window.performance.now();
    songTimer = window.setTimeout(() => {
      songTimer = null;
      songTimeRemaining = 0;
      void beginNextChapter().catch(showGameError);
    }, songTimeRemaining);
  };

  const pauseSongTimer = (): void => {
    if (songTimer === null) {
      return;
    }
    const elapsed = window.performance.now() - songTimerStartedAt;
    songTimeRemaining = Math.max(songTimeRemaining - elapsed, 0);
    clearSongTimer();
  };

  const showSongInterlude = async (completion: Readonly<SongCardCompletion>): Promise<void> => {
    dialogView.clearTimer();
    currentCompletion = completion;
    gameState.transition(GAME_STATES.RUNNING_EFFECT);
    songTimeRemaining = 0;
    nextMark.hidden = true;
    updateInputControls();

    const darkenDurationMs = completion.darkenDurationMs ??
      DEFAULT_DARK_INTERLUDE_DARKEN_DURATION_MS;
    sceneTransitionCurtain.style.setProperty(
      "--scene-darken-ms",
      `${darkenDurationMs}ms`,
    );
    sceneTransitionCurtain.classList.remove("is-dark", "is-revealing");
    sceneTransitionCurtain.hidden = false;
    void sceneTransitionCurtain.offsetWidth;
    sceneTransitionCurtain.classList.add("is-dark");

    const fadeOutAudio: Promise<unknown> = completion.fadeOutAudio === "metronome"
      ? fadeOutMetronome(darkenDurationMs, DARK_INTERLUDE_EASING)
      : completion.fadeOutAudio
        ? requireAudioManager().fadeTo(
          completion.fadeOutAudio,
          0,
          darkenDurationMs,
          {
            stopWhenFinished: true,
            easing: DARK_INTERLUDE_EASING,
          },
        )
        : Promise.resolve();
    await Promise.all([
      wait(darkenDurationMs),
      fadeOutAudio,
    ]);

    dialogBox.hidden = true;
    protagonistDialog.hidden = true;
    hideCharacterImmediately();
    gameState.transition(GAME_STATES.SONG_CARD);
    setSongCard(completion);
    await wait(DARK_INTERLUDE_CARD_ENTER_DURATION_MS);
    songTimeRemaining = completion.durationMs;
    updateInputControls(true);
    scheduleSongEnd();
  };

  const showEnding = async (): Promise<void> => {
    dialogView.clearTimer();
    clearSongTimer();
    currentCompletion = null;
    gameState.transition(GAME_STATES.ENDING_TRANSITION);
    nextMark.hidden = true;
    titleButton.hidden = true;
    updateInputControls();
    endingCard.classList.remove("is-black", "is-content-visible");
    endingCard.hidden = false;
    void endingCard.offsetWidth;
    endingCard.classList.add("is-black");
    await wait(ENDING_DARKEN_DURATION_MS);
    dialogBox.hidden = true;
    protagonistDialog.hidden = true;
    hideCharacterImmediately();
    // 何も表示しない黒画面を残し、最後の余韻を作ります。
    await wait(ENDING_BLACK_HOLD_DURATION_MS);
    endingCard.classList.add("is-content-visible");
    await wait(ENDING_TEXT_FADE_IN_DURATION_MS);
    gameState.transition(GAME_STATES.ENDING_READY);
    updateInputControls();
    endingButton.hidden = false;
    endingButton.disabled = false;
    endingButton.focus({ preventScroll: true });
  };

  const closeEndingAndReturnToTitle = async (): Promise<void> => {
    if (!gameState.is(GAME_STATES.ENDING_READY) || endingButton.disabled) {
      return;
    }
    gameState.transition(GAME_STATES.RETURNING);
    endingButton.disabled = true;
    gameStage.classList.add("is-ending-closing");

    // ENDでは決定音を鳴らさず、画面と最後のBGMを同じ長さで静かに消します。
    await Promise.all([
      requireAudioManager().fadeTo(
        "star-remnants",
        0,
        ENDING_CLOSE_DURATION_MS,
        { stopWhenFinished: true },
      ),
      wait(ENDING_CLOSE_DURATION_MS),
    ]);
    window.location.assign(titleButton.dataset.titleUrl ?? "/");
  };

  const handleChapterCompletion = async (completion: Readonly<ChapterCompletion>): Promise<void> => {
    if (completion.kind === "ending") {
      await showEnding();
      return;
    }
    if (completion.transition === "dark-song-interlude") {
      await showSongInterlude(completion);
      return;
    }
    throw new Error(`未実装の章終了演出です: ${String(completion.transition)}`);
  };

  const moveRuntimeForward = async (): Promise<void> => {
    const previousView = requireCurrentView();
    const result = requireRuntime().advance();
    if (result.type === "completion") {
      await handleChapterCompletion(result.completion);
      return;
    }

    gameState.transition(GAME_STATES.RUNNING_EFFECT);
    nextMark.hidden = true;
    updateInputControls();
    const shouldFadeDialog = shouldFadeMainDialog(previousView, result.view);

    if (shouldFadeDialog) {
      gameStage.classList.add("is-changing", "is-dialog-speaker-changing");
    }

    try {
      if (shouldFadeDialog) {
        await wait(140);
      }
      // 間やカメラ演出がある場面では、前のテキストを消してから演出を始めます。
      await runEnterEffects(result.view);
      currentView = result.view;
      await renderCurrentView();
      if (shouldFadeDialog) {
        await wait(160);
      }
    } finally {
      gameStage.classList.remove("is-changing", "is-dialog-speaker-changing");
      updateInputControls(true);
    }
  };

  const playNameRegistration = async (): Promise<void> => {
    gameState.transition(GAME_STATES.RUNNING_EFFECT);
    nextMark.hidden = true;
    updateInputControls();
    await wait(420);

    // ???を完全に消し、短い空白を挟んでからクロコを表示します。
    // 名前枠は残したまま、文字だけを順番に切り替えます。
    const nameLabel = document.createElement("span");
    nameLabel.className = "speaker-name__label";
    nameLabel.textContent = "???";
    speakerName.replaceChildren(nameLabel);
    void speakerName.offsetWidth;
    const expressionChange = setCharacterExpression("grin");

    speakerName.classList.add("is-name-fade-out");
    await wait(NAME_FADE_OUT_DURATION_MS);
    nameLabel.textContent = "";
    await wait(NAME_BLANK_HOLD_DURATION_MS);

    nameLabel.textContent = "クロコ";
    nameLabel.classList.add("speaker-name__label--incoming");
    speakerName.classList.remove("is-name-fade-out");
    void speakerName.offsetWidth;
    speakerName.classList.add("is-name-fade-in");
    await wait(NAME_FADE_IN_DURATION_MS);
    await expressionChange;

    speakerName.textContent = "クロコ";
    speakerName.classList.remove("is-name-fade-in");
    speakerName.classList.add("is-named");
    try {
      await moveRuntimeForward();
    } catch (error) {
      showGameError(error);
    }
  };

  const createScenarioEffectRunner = (): ScenarioEffectRunner<EffectExecutionContext> =>
    new ScenarioEffectRunner<EffectExecutionContext>({
      [EFFECT_PHASES.ENTER]: {
        "water-transition": ({ view }) => {
          if (view) {
            return startWaterTransition(view);
          }
          return Promise.resolve();
        },
        "start-corridor-bgm": () =>
          startBgm(
            "corridor",
            CORRIDOR_BGM_TARGET_VOLUME,
            LATER_CORRIDOR_FADE_IN_DURATION_MS,
          ),
        "fade-out-corridor-bgm": () =>
          requireAudioManager().fadeTo(
            "corridor",
            0,
            CORRIDOR_BGM_SLOW_FADE_OUT_DURATION_MS,
            { stopWhenFinished: true },
          ),
        "hesitation-zoom-shake": async () => {
          const audio = requireAudioManager();
          sceneCamera.classList.remove("is-hesitating");
          void sceneCamera.offsetWidth;
          sceneCamera.classList.add("is-hesitating");
          try {
            void audio.play("footsteps");
            await wait(HESITATION_ZOOM_IN_DURATION_MS);
            audio.stop("footsteps");
            await wait(HESITATION_HOLD_DURATION_MS);
            await wait(HESITATION_SHAKE_DURATION_MS);
            void audio.play("footsteps");
            await wait(HESITATION_ZOOM_OUT_DURATION_MS);
          } finally {
            audio.stop("footsteps");
            sceneCamera.classList.remove("is-hesitating");
          }
        },
        "final-dialog-pause": async () => {
          await wait(FINAL_DIALOG_PAUSE_DURATION_MS - EXPRESSION_OUTGOING_FADE_DURATION_MS);
          await setCharacterExpression("smirk");
        },
        "final-camera-zoom": async () => {
          await wait(FINAL_CAMERA_PRE_ZOOM_HOLD_MS);
          sceneCamera.classList.add("is-final-zoom");
          await Promise.all([
            setCharacterExpression("grin"),
            wait(FINAL_CAMERA_ZOOM_DURATION_MS),
          ]);
        },
      },
      [EFFECT_PHASES.SELECT]: {
        "start-corridor-bgm": async ({ stage }) => {
          if (stage === "prepare") {
            prepareBgmForGesture("corridor");
          } else {
            void fadeInPreparedBgm(
              "corridor",
              CORRIDOR_BGM_TARGET_VOLUME,
              CORRIDOR_BGM_FADE_IN_DURATION_MS,
            ).catch(showGameError);
          }
        },
        "start-eternal-earth-bgm": async ({ stage }) => {
          if (stage === "prepare") {
            void playBgmImmediatelyForGesture(
              "eternal-earth",
              ETERNAL_EARTH_TARGET_VOLUME,
            );
          }
        },
        "start-star-remnants-bgm": async ({ stage }) => {
          if (stage === "prepare") {
            prepareBgmForGesture("star-remnants");
            return;
          }
          void fadeInPreparedBgm(
            "star-remnants",
            STAR_REMNANTS_TARGET_VOLUME,
            STAR_REMNANTS_FADE_IN_DURATION_MS,
          ).catch(showGameError);
          await wait(PROTAGONIST_POST_SELECTION_HOLD_MS);
        },
        "hold-before-next-line": async ({ stage }) => {
          if (stage === "after-selection") {
            await wait(PROTAGONIST_POST_SELECTION_HOLD_MS);
          }
        },
        "set-character-surprise": async ({ stage }) => {
          if (stage === "after-selection") {
            await setCharacterExpression("surprise");
          }
        },
        "set-character-grin": async ({ stage }) => {
          if (stage === "after-selection") {
            await setCharacterExpression("grin");
          }
        },
      },
      [EFFECT_PHASES.COMPLETE]: {
        "register-name": () => playNameRegistration(),
        "stop-corridor-bgm": async () => {
          requireAudioManager().stop("corridor");
        },
      },
    });

  const handleProtagonistSelection = async (event: MouseEvent): Promise<void> => {
    if (!isProtagonistSceneActive()) {
      return;
    }
    const activeView = requireCurrentView();
    if (activeView.kind !== "protagonist") {
      return;
    }
    gameState.transition(GAME_STATES.RUNNING_EFFECT);
    const selectedEffects = activeView.selectEffects ?? [];
    await requireEffectRunner().run(EFFECT_PHASES.SELECT, selectedEffects, { stage: "prepare" });
    const selectedButton = event.currentTarget as HTMLButtonElement | null;
    if (selectedButton) {
      selectedButton.classList.add("is-selected");
      getProtagonistButtons().forEach((button) => {
        if (button !== selectedButton) {
          button.classList.add("is-dismissed");
        }
      });
    }
    updateInputControls();
    void requireAudioManager().play("decision");
    await wait(PROTAGONIST_SELECTION_DURATION_MS);
    await requireEffectRunner().run(EFFECT_PHASES.SELECT, selectedEffects, {
      stage: "after-selection",
    });
    try {
      await moveRuntimeForward();
    } catch (error) {
      showGameError(error);
    }
  };

  const dialogView = new GameDialogView({
    dialogBox,
    speakerName,
    dialogText,
    dialogAnnouncement,
    nextMark,
    protagonistDialog,
    protagonistLines,
    typewriterDelayMs: TYPEWRITER_DELAY_MS,
    onTypingFinished: handleTypingFinished,
    onProtagonistSelection: (event) => {
      void handleProtagonistSelection(event);
    },
  });

  const advanceScene = async (): Promise<void> => {
    if (isProtagonistSceneActive()) {
      return;
    }
    if (!gameState.is(GAME_STATES.TYPING, GAME_STATES.AWAITING_ADVANCE)) {
      return;
    }
    startMetronome();
    if (gameState.is(GAME_STATES.TYPING)) {
      dialogView.completeCurrentText();
      return;
    }
    try {
      await moveRuntimeForward();
    } catch (error) {
      showGameError(error);
    }
  };

  const maybeStartOpeningScene = (): void => {
    if (
      hasSceneStarted ||
      !gameState.is(GAME_STATES.OPENING) ||
      !isScenarioReady ||
      !isOpeningFadeFinished
    ) {
      return;
    }
    hasSceneStarted = true;
    openingCurtain.hidden = true;
    startMetronome();
    void renderCurrentView();
    updateInputControls(true);
  };

  const openReturnDialog = (): void => {
    if (titleButton.disabled || !gameState.openReturnDialog()) {
      return;
    }
    if (audioManager) {
      void audioManager.play("cancel");
    }
    dialogView.pauseTyping();
    pauseSongTimer();
    updateInputControls();
    returnDialog.hidden = false;
    cancelReturnButton.focus();
  };

  const closeReturnDialog = (): void => {
    if (gameState.is(GAME_STATES.RETURNING)) {
      return;
    }
    if (audioManager) {
      void audioManager.play("cancel");
    }
    returnDialog.hidden = true;
    if (!gameState.closeReturnDialog()) {
      return;
    }
    if (gameState.is(GAME_STATES.SONG_CARD)) {
      scheduleSongEnd();
    }
    updateInputControls(true);
    if (gameState.is(GAME_STATES.TYPING)) {
      dialogView.resumeTyping();
    }
    maybeStartOpeningScene();
  };

  const handleReturnDialogKeydown = (event: KeyboardEvent): void => {
    if (!gameState.is(GAME_STATES.RETURN_DIALOG)) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeReturnDialog();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    if (event.shiftKey && document.activeElement === cancelReturnButton) {
      event.preventDefault();
      confirmReturnButton.focus();
    } else if (!event.shiftKey && document.activeElement === confirmReturnButton) {
      event.preventDefault();
      cancelReturnButton.focus();
    }
  };

  const returnToTitle = async (): Promise<void> => {
    if (!gameState.is(GAME_STATES.RETURN_DIALOG)) {
      return;
    }
    gameState.transition(GAME_STATES.RETURNING);
    dialogView.clearTimer();
    clearSongTimer();
    updateInputControls();
    cancelReturnButton.disabled = true;
    confirmReturnButton.disabled = true;
    if (audioManager) {
      audioManager.stopAll();
      await audioManager.playUntilEnd("decision");
    }
    window.location.assign(titleButton.dataset.titleUrl ?? "/");
  };

  const initializeGame = async (): Promise<void> => {
    const scenarioUrl = gameStage.dataset.scenarioUrl;
    if (!scenarioUrl) {
      throw new Error("シナリオURLが設定されていません。");
    }
    const response = await fetch(scenarioUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`シナリオを読み込めませんでした（HTTP ${response.status}）。`);
    }
    scenario = validateScenario(await response.json());
    runtime = createScenarioRuntime(scenario);
    audioManager = new AudioManager(scenario.assets.audio, gameStage.dataset.audioBase ?? "");
    effectRunner = createScenarioEffectRunner();
    gameStage.style.setProperty(
      "--expression-outgoing-fade-ms",
      `${EXPRESSION_OUTGOING_FADE_DURATION_MS}ms`,
    );
    gameStage.style.setProperty("--character-fade-ms", `${CHARACTER_FADE_DURATION_MS}ms`);
    gameStage.style.setProperty(
      "--protagonist-selection-ms",
      `${PROTAGONIST_SELECTION_DURATION_MS}ms`,
    );
    gameStage.style.setProperty(
      "--hesitation-total-ms",
      `${HESITATION_TOTAL_DURATION_MS}ms`,
    );
    gameStage.style.setProperty("--final-camera-zoom-ms", `${FINAL_CAMERA_ZOOM_DURATION_MS}ms`);
    gameStage.style.setProperty("--ending-darken-ms", `${ENDING_DARKEN_DURATION_MS}ms`);
    gameStage.style.setProperty(
      "--ending-text-fade-ms",
      `${ENDING_TEXT_FADE_IN_DURATION_MS}ms`,
    );
    gameStage.style.setProperty("--ending-close-ms", `${ENDING_CLOSE_DURATION_MS}ms`);
    currentView = runtime.getCurrentView();
    preloadCharacterSprites();
    await changeBackground(currentView.background, 0, true);
    isScenarioReady = true;
    gameState.transition(GAME_STATES.OPENING);
    maybeStartOpeningScene();
  };

  // 読み込み中はタイトル復帰を含むすべての操作を無効にします。
  updateInputControls();
  // どのボタンを押した場合も、クリックの時点でiPhoneの音声出力を再開します。
  gameStage.addEventListener("click", () => {
    void audioManager?.resume();
  }, { capture: true });
  advanceButton.addEventListener("click", () => {
    void advanceScene();
  });
  endingButton.addEventListener("click", () => {
    void closeEndingAndReturnToTitle().catch(showGameError);
  });
  titleButton.addEventListener("click", openReturnDialog);
  cancelReturnButton.addEventListener("click", closeReturnDialog);
  confirmReturnButton.addEventListener("click", () => {
    void returnToTitle();
  });
  document.addEventListener("keydown", handleReturnDialogKeydown);
  window.setTimeout(() => {
    isOpeningFadeFinished = true;
    maybeStartOpeningScene();
  }, OPENING_FADE_DURATION_MS);
  initializeGame().catch(showGameError);
} else {
  // HTML自体が欠けている場合は画面内へ出せないため、開発者ツールへ残します。
  console.error("本編画面に必要なHTML要素が見つかりません。");
}
