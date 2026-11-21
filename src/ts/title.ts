import { AudioGainController } from "./audio-gain-controller.ts";

// 開始画面にあるボタンと、16:9のゲーム画面を取得します。
const startButton = document.querySelector<HTMLButtonElement>("#start-button");
const gameStage = document.querySelector<HTMLElement>(".game-stage");
const startTransition = document.querySelector<HTMLElement>(".start-transition");
const titleBgm = document.querySelector<HTMLAudioElement>("#title-bgm");
const titleAudioButton = document.querySelector<HTMLButtonElement>("#title-audio-button");
const creditsButton = document.querySelector<HTMLButtonElement>("#credits-button");
const creditsDialog = document.querySelector<HTMLDialogElement>("#credits-dialog");
const creditsCloseButton = document.querySelector<HTMLButtonElement>("#credits-close-button");
const TITLE_BGM_VOLUME = 0.30;
const START_FADE_DURATION_MS = 1800;

if (
  startButton &&
  gameStage &&
  startTransition &&
  titleBgm &&
  titleAudioButton &&
  creditsButton &&
  creditsDialog &&
  creditsCloseButton
) {
  const titleBgmGain = new AudioGainController([
    { id: "title", audio: titleBgm, volume: TITLE_BGM_VOLUME },
  ]);
  let titleBgmFadeFrame: number | null = null;

  // 音源クレジットを開きます。タイトルBGMはそのまま再生を続けます。
  const openCredits = (event: MouseEvent): void => {
    // ゲーム画面全体に設定した開始処理へ、クリックを伝えないようにします。
    event.stopPropagation();

    if (!creditsDialog.open) {
      creditsDialog.showModal();
    }
  };

  // 閉じた後にクレジットボタンへ戻れるよう、キーボードの位置も復元します。
  const closeCredits = (event?: MouseEvent): void => {
    event?.stopPropagation();

    if (creditsDialog.open) {
      creditsDialog.close();
      creditsButton.focus({ preventScroll: true });
    }
  };

  // モーダル内のリンクや閉じるボタンを押しても、ゲームを開始しません。
  const keepCreditsInteractionInsideDialog = (event: Event): void => {
    event.stopPropagation();
  };

  // 指定時間が過ぎるまで待つための、小さな補助処理です。
  const wait = (milliseconds: number): Promise<void> =>
    new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });

  // SEが最後まで鳴るのを待ちます。再生できない場合は、すぐに処理を続けます。
  const playUntilEnd = (audio: HTMLAudioElement): Promise<void> =>
    new Promise((resolve) => {
      let isFinished = false;

      const finish = (): void => {
        if (isFinished) {
          return;
        }

        isFinished = true;
        window.clearTimeout(fallbackTimer);
        resolve();
      };

      // 音源の読み込みが止まった場合も、画面が固まらないようにします。
      const fallbackTimer = window.setTimeout(finish, 2500);
      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });

      audio.play().catch(finish);
    });

  // 実際の再生状態に合わせて、左上のアイコンと読み上げ内容を更新します。
  const updateTitleAudioButton = (isPlaying: boolean): void => {
    titleAudioButton.classList.toggle("is-playing", isPlaying);
    titleAudioButton.setAttribute("aria-pressed", String(isPlaying));
    titleAudioButton.setAttribute(
      "aria-label",
      isPlaying ? "BGMを一時停止" : "BGMを再生",
    );
  };

  // 左上のボタンだけでBGMを再生・一時停止します。
  const toggleTitleBgm = async (event: MouseEvent): Promise<void> => {
    // 親要素のクリック処理へ伝えず、音量操作だけを行います。
    event.stopPropagation();

    if (titleAudioButton.disabled) {
      return;
    }

    if (!titleBgm.paused && titleBgmGain.isRunning()) {
      titleBgm.pause();
      updateTitleAudioButton(false);
      return;
    }

    titleBgmGain.setVolume("title", TITLE_BGM_VOLUME);

    try {
      // resumeとplayを同じタップの中で始め、iPhoneの再生制限を解除します。
      const [canOutput] = await Promise.all([
        titleBgmGain.resume(),
        titleBgm.play(),
      ]);
      updateTitleAudioButton(canOutput);
    } catch {
      // 再生が拒否された場合は停止表示を保ち、ゲームの開始操作は妨げません。
      updateTitleAudioButton(false);
    }
  };

  // タイトルBGMを、画面の暗転と同じ時間で徐々に小さくします。
  const fadeOutTitleBgm = (): Promise<void> => {
    // 利用者がBGMを止めている場合は、ゲーム開始時に勝手に再開しません。
    if (titleBgm.paused) {
      titleBgmGain.setVolume("title", TITLE_BGM_VOLUME);
      titleBgm.currentTime = 0;
      updateTitleAudioButton(false);
      return Promise.resolve();
    }

    const fadeStartedAt = window.performance.now();
    const fadeStartedVolume = titleBgmGain.getVolume("title") ?? TITLE_BGM_VOLUME;

    return new Promise((resolve) => {
      const updateVolume = (currentTime: number): void => {
        const progress = Math.min(
          (currentTime - fadeStartedAt) / START_FADE_DURATION_MS,
          1,
        );
        titleBgmGain.setVolume("title", fadeStartedVolume * (1 - progress));

        if (progress < 1) {
          titleBgmFadeFrame = window.requestAnimationFrame(updateVolume);
          return;
        }

        titleBgmFadeFrame = null;
        titleBgm.pause();
        titleBgm.currentTime = 0;
        titleBgmGain.setVolume("title", TITLE_BGM_VOLUME);
        updateTitleAudioButton(false);
        resolve();
      };

      titleBgmFadeFrame = window.requestAnimationFrame(updateVolume);
    });
  };

  // ブラウザが許可する場合は、タイトル表示と同時にBGMを始めます。
  const tryStartTitleBgm = (): void => {
    titleBgmGain.setVolume("title", TITLE_BGM_VOLUME);
    const resumeResult = titleBgmGain.resume();
    const playResult = titleBgm.play();
    if (playResult !== undefined) {
      Promise.all([resumeResult, playResult])
        .then(([canOutput]) => {
          updateTitleAudioButton(canOutput && !titleBgm.paused);
        })
        .catch(() => {
          // 拒否された場合は、左上のスピーカーボタンから再生できます。
          updateTitleAudioButton(false);
        });
      return;
    }

    updateTitleAudioButton(!titleBgm.paused);
  };

  // ボタンでも背景でも、同じ開始処理を呼び出します。
  const startGame = async (): Promise<void> => {
    // 連打されてもSEと画面遷移が一度だけ実行されるようにします。
    if (startButton.disabled) {
      return;
    }

    // ゲーム開始のタップを使い、iPhoneで停止中の音声出力を再開します。
    void titleBgmGain.resume();

    startButton.disabled = true;
    titleAudioButton.disabled = true;
    creditsButton.disabled = true;
    gameStage.classList.add("is-starting");
    gameStage.setAttribute("aria-busy", "true");

    // 決定SEと、ゆっくりしたフェードアウトを同時に始めます。
    const decisionSound = new Audio(startButton.dataset.startSoundUrl ?? "");
    const soundFinished = playUntilEnd(decisionSound);
    const titleBgmFinished = fadeOutTitleBgm();

    // 今回指定された開始フェードは、端末の設定にかかわらず1.8秒表示します。
    const fadeFinished = wait(START_FADE_DURATION_MS);

    // SEとフェードの両方が終わるまで、本編へ移動しません。
    await Promise.all([soundFinished, titleBgmFinished, fadeFinished]);
    if (titleBgmFadeFrame !== null) {
      window.cancelAnimationFrame(titleBgmFadeFrame);
    }
    window.location.assign(startButton.dataset.gameUrl ?? "./game.html");
  };

  updateTitleAudioButton(false);
  tryStartTitleBgm();
  titleAudioButton.addEventListener("click", (event) => {
    void toggleTitleBgm(event);
  });
  creditsButton.addEventListener("click", openCredits);
  creditsCloseButton.addEventListener("click", closeCredits);
  creditsDialog.addEventListener("click", keepCreditsInteractionInsideDialog);
  creditsDialog.addEventListener("cancel", keepCreditsInteractionInsideDialog);
  startButton.addEventListener("click", () => {
    void startGame();
  });
  gameStage.addEventListener("click", () => {
    void startGame();
  });
}
